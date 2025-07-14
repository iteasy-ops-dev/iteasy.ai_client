'use client'

import { useChat } from 'ai/react'
import { useEffect, useState } from 'react'
import { useChatStore } from '@/app/store/chat-store'
import { useSettingsStore } from '@/app/store/settings-store'
import { useHydration } from '@/app/hooks/useHydration'
import ChatSidebar from './ChatSidebar'
import MessageList from './MessageList'
import InputArea from './InputArea'
import SettingsModal from './SettingsModal'

export default function ChatInterface() {
  const isHydrated = useHydration()
  const [settingsOpen, setSettingsOpen] = useState(false)
  
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
    validateApiKey,
  } = useSettingsStore()
  
  // Trigger store hydration when component mounts on client
  useEffect(() => {
    if (isHydrated) {
      useChatStore.persist.rehydrate()
      // Settings store now auto-hydrates, but ensure it's complete
      useSettingsStore.persist.rehydrate()
    }
  }, [isHydrated])

  const currentChat = getCurrentChat()

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: originalHandleSubmit,
    isLoading,
    stop,
    setMessages,
    error,
  } = useChat({
    api: '/api/chat',
    body: {
      apiKey,
      model,
      temperature,
      maxTokens,
    },
    onFinish: (message, options) => {
      // Extract usage data and attach to the current chat
      if (options.usage && currentChatId) {
        const tokenUsage = {
          promptTokens: options.usage.promptTokens || 0,
          completionTokens: options.usage.completionTokens || 0,
          totalTokens: options.usage.totalTokens || 0,
          model: model,
        }
        
        // Use a slight delay to ensure the message is saved to store first
        setTimeout(() => {
          const currentChat = getCurrentChat()
          if (currentChat && currentChat.messages.length > 0) {
            const lastMessage = currentChat.messages[currentChat.messages.length - 1]
            if (lastMessage.role === 'assistant') {
              updateMessageWithTokenUsage(currentChatId, lastMessage.id, tokenUsage)
            }
          }
        }, 100)
      }
    },
    onError: (error) => {
      console.error('Chat error:', error)
      // If it's an API key error, open settings
      if (error.message.includes('API key') || error.message.includes('401')) {
        setSettingsOpen(true)
      }
    },
  })

  // Sync messages with store
  useEffect(() => {
    if (currentChat) {
      setMessages(currentChat.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt,
      })))
    } else {
      setMessages([])
    }
  }, [currentChatId, currentChat, setMessages])

  // Sync changes back to store when messages change
  useEffect(() => {
    if (currentChatId && messages.length > 0) {
      // Get the current chat from store
      const storeChat = getCurrentChat()
      const storeMessageCount = storeChat?.messages.length || 0
      
      // Only sync if we have NEW messages that aren't in the store yet
      // This prevents copying messages when switching chats
      if (messages.length > storeMessageCount) {
        const newMessages = messages.slice(storeMessageCount)
        // Only add messages that are actually new (not from store sync)
        newMessages.forEach(msg => {
          // Check if this message already exists in store to prevent duplicates
          const messageExists = storeChat?.messages.some(storeMsg => 
            storeMsg.content === msg.content && storeMsg.role === msg.role
          )
          
          if (!messageExists) {
            addMessage(currentChatId, {
              role: msg.role as 'user' | 'assistant' | 'system' | 'data',
              content: msg.content,
            })
          }
        })
      }
      
      // Update the last message if it's being streamed
      if (isLoading && messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage.role === 'assistant' && storeChat) {
          const lastStoreMessage = storeChat.messages[storeChat.messages.length - 1]
          if (lastStoreMessage && lastStoreMessage.role === 'assistant' && 
              lastStoreMessage.content !== lastMessage.content) {
            updateLastMessage(currentChatId, lastMessage.content)
          }
        }
      }
    }
  }, [messages, isLoading, currentChatId, addMessage, updateLastMessage, getCurrentChat])

  const handleSubmit = () => {
    if (!input.trim()) return

    // Check if hydration is complete and API key is set
    if (!isHydrated || !validateApiKey()) {
      if (isHydrated) {
        setSettingsOpen(true)
      }
      return
    }

    // Create new chat if none exists
    let chatId = currentChatId
    if (!chatId) {
      chatId = createNewChat()
    }

    // Submit to AI - the useEffect above will handle syncing to store
    originalHandleSubmit()
  }

  const handleNewChat = () => {
    createNewChat()
    // Clear the useChat messages when creating a new chat
    setMessages([])
  }

  const handleSelectChat = (chatId: string) => {
    selectChat(chatId)
    // Clear current messages when switching chats
    setMessages([])
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
      <div className="flex h-screen">
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
    <>
      <div className="flex h-screen">
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
                messages={messages} 
                isLoading={isLoading}
              />
              <InputArea
                input={input}
                setInput={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isLoading}
                stop={stop}
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
    </>
  )
}