'use client'

import { useEffect, useState, useRef } from 'react'
import { useChatStore } from '@/app/store/chat-store'
import { useSettingsStore } from '@/app/store/settings-store'
import { useHydration } from '@/app/hooks/useHydration'
import { streamWithOpenAI, streamWithLocalLLM } from '@/app/lib/llm-providers'
import { FontProvider } from '../FontProvider'
import ChatSidebar from './ChatSidebar'
import MessageList from './MessageList'
import InputArea from './InputArea'
import SettingsModal from './SettingsModal'
import type { Message } from '@/app/types'

export default function ChatInterface() {
  const isHydrated = useHydration()
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Client-side state management
  
  const {
    chats,
    currentChatId,
    createNewChat,
    selectChat,
    deleteChat,
    addMessage,
    getCurrentChat,
    updateLastMessage,
    updateMessageWithTokenUsage,
    updateChatTitle,
  } = useChatStore()
  
  const {
    apiKey,
    model,
    temperature,
    maxTokens,
    llmProvider,
    localLLMEndpoint,
    localLLMModel,
    validateApiKey,
  } = useSettingsStore()
  
  // Trigger store hydration when component mounts on client
  useEffect(() => {
    if (isHydrated) {
      useChatStore.persist.rehydrate()
      // Settings store now auto-hydrates, but ensure it's complete
      useSettingsStore.persist.rehydrate()
      
      // Reset currentChatId to null on fresh load to show welcome screen
      useChatStore.setState({ currentChatId: null })
    }
  }, [isHydrated])

  const currentChat = getCurrentChat()

  // Client-side state
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Input handler
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // Submit handler with client-side LLM integration
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (!input.trim() || isLoading) return
    
    // Validate API key for OpenAI
    if (llmProvider === 'openai' && !apiKey) {
      setError(new Error('Please configure your OpenAI API key'))
      setSettingsOpen(true)
      return
    }
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date(),
    }
    
    // Add user message to store
    if (currentChatId) {
      addMessage(currentChatId, userMessage)
      
      // Set title from first message
      const chat = getCurrentChat()
      if (chat && chat.messages.length === 0) {
        const firstLine = userMessage.content.split('\\n')[0]
        const title = firstLine.length > 30 
          ? firstLine.substring(0, 30) + '...' 
          : firstLine
        updateChatTitle(currentChatId, title)
      }
    }
    
    // Clear input
    setInput('')
    setIsLoading(true)
    setError(null)
    
    // Add assistant message to store and get the actual ID
    let assistantMessageId = ''
    if (currentChatId) {
      assistantMessageId = addMessage(currentChatId, {
        role: 'assistant',
        content: '',
      })
      // Removed debug log
    }
    
    try {
      let fullContent = ''
      
      const onStream = (chunk: string) => {
        fullContent += chunk
        
        // Update store message
        if (currentChatId) {
          updateLastMessage(currentChatId, fullContent)
        }
      }
      
      const onFinish = (usage?: any) => {
        if (currentChatId) {
          const tokenUsage = {
            promptTokens: usage?.promptTokens || 0,
            completionTokens: usage?.completionTokens || 0,
            totalTokens: usage?.totalTokens || (usage?.promptTokens || 0) + (usage?.completionTokens || 0),
            model: llmProvider === 'openai' ? model : localLLMModel,
          }
          
          updateMessageWithTokenUsage(currentChatId, assistantMessageId, tokenUsage)
          
          // LangGraph Debug: Log intent classification result
          if (usage?.intent) {
            console.log('🧠 LangGraph Intent Analysis:', {
              intent: usage.intent,
              confidence: usage.confidence,
              systemPrompt: usage.systemPrompt ? usage.systemPrompt.substring(0, 100) + '...' : 'No system prompt'
            })
          }
        }
      }
      
      // Convert messages to format expected by LLM
      const currentMessages = currentChat?.messages || []
      const llmMessages = currentMessages.concat(userMessage).map((msg: Message) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      }))
      
      if (llmProvider === 'openai') {
        await streamWithOpenAI(
          llmMessages,
          {
            provider: 'openai',
            apiKey,
            model,
            temperature,
            maxTokens,
          },
          onStream,
          onFinish
        )
      } else {
        await streamWithLocalLLM(
          llmMessages,
          {
            provider: 'local',
            endpoint: localLLMEndpoint,
            model: localLLMModel,
            temperature,
            maxTokens,
          },
          onStream,
          onFinish
        )
      }
      
    } catch (err) {
      console.error('Chat error:', err)
      setError(err as Error)
      
      // If it's an API key error, open settings
      if ((err as Error).message.includes('API key') || (err as Error).message.includes('401')) {
        setSettingsOpen(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  // Helper functions
  const handleNewChat = () => {
    createNewChat()
  }

  const handleSelectChat = (chatId: string) => {
    selectChat(chatId)
  }

  const handleDeleteChat = (chatId: string) => {
    deleteChat(chatId)
  }

  const handleOpenSettings = () => {
    setSettingsOpen(true)
  }

  // Show loading state until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <div className="flex h-full">
        <div className="flex h-full w-64 flex-col border-r bg-muted/20">
          <div className="p-4">
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              ITEasy AI Agent
            </h1>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <FontProvider>
      <div className="flex h-full">
        <ChatSidebar
          chats={chats}
          currentChatId={currentChatId}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onOpenSettings={handleOpenSettings}
          onUpdateChatTitle={updateChatTitle}
        />
        
        <div className="flex flex-1 flex-col">
          {currentChat ? (
            <>
              <MessageList 
                messages={currentChat?.messages || []} 
                isLoading={isLoading}
              />
              <InputArea
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                stop={stop}
                disabled={!currentChatId}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-foreground mb-4">
                  ITEasy AI Agent
                </h1>
                <p className="text-muted-foreground mb-8">
                  {!validateApiKey() 
                    ? 'Please configure your OpenAI API key to start chatting'
                    : 'Start a conversation by creating a new chat'
                  }
                </p>
                <div className="space-x-4">
                  {!validateApiKey() ? (
                    <button
                      onClick={handleOpenSettings}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Configure API Key
                    </button>
                  ) : (
                    <button
                      onClick={handleNewChat}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      New Chat
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          

          {/* Error Display */}
          {error && (
            <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              <p className="text-sm">
                {error.message.includes('API key') 
                  ? 'Invalid API key. Please check your settings.' 
                  : `Error: ${error.message}`
                }
              </p>
            </div>
          )}
        </div>
      </div>
      
      <SettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </FontProvider>
  )
}