'use client'

import { useEffect, useState } from 'react'
import { useChatStore } from '@/app/store/chat-store'
import { useSettingsStore } from '@/app/store/settings-store'
import { useHydration } from '@/app/hooks/useHydration'
import { useChatHandlers } from '@/app/hooks/useChatHandlers'
import { FontProvider } from '../FontProvider'
import { ErrorBoundary } from '@/app/components/ui/error-boundary'
import ChatSidebar from './ChatSidebar'
import MessageList from './MessageList'
import InputArea from './InputArea'
import SettingsModal from './SettingsModal'
import StatusBar from './StatusBar'
import WaveText from '../ui/wave-text'

export default function ChatInterface() {
  const isHydrated = useHydration()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Client-side state management
  
  const {
    chats,
    currentChatId,
    getCurrentChat,
    updateChatTitle,
  } = useChatStore()
  

  const {
    handleSubmit: handleChatSubmit,
    handleNewChat,
    handleSelectChat,
    handleDeleteChat,
    handleStop,
    isStreaming,
    error: chatError,
    validateApiKey,
  } = useChatHandlers()
  
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

  // Input handler
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // Submit handler with client-side LLM integration
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (!input.trim()) return
    
    try {
      await handleChatSubmit(input.trim())
      setInput('')
    } catch (err) {
      console.error('Chat error:', err)
      // If it's an API key error, open settings
      if ((err as Error).message.includes('API key') || (err as Error).message.includes('401')) {
        setSettingsOpen(true)
      }
    }
  }

  // Helper functions

  const handleOpenSettings = () => {
    setSettingsOpen(true)
  }

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed)
  }

  // Show loading state until hydrated to prevent hydration mismatch
  if (!isHydrated) {
    return (
      <div className="flex h-full">
        <div className={`flex h-full ${sidebarCollapsed ? 'w-16' : 'w-56'} flex-col border-r bg-muted/20`}>
          <div className="p-4">
            <div className="h-10 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground mb-4">
              ITEasy AI Agent
            </h1>
            <p className="text-muted-foreground">
              <WaveText text="Loading..." className="text-muted-foreground" duration={1.2} delay={0.08} />
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
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
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
        
        <div className="flex flex-1 flex-col">
          <StatusBar />
          {currentChat ? (
            <>
              <MessageList 
                messages={currentChat?.messages || []} 
                isLoading={isStreaming}
              />
              
              <InputArea
                input={input}
                handleInputChange={handleInputChange}
                handleSubmit={handleSubmit}
                isLoading={isStreaming}
                stop={handleStop}
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
                  {!validateApiKey 
                    ? 'Please configure your OpenAI API key to start chatting'
                    : 'Start a conversation by creating a new chat'
                  }
                </p>
                <div className="space-x-4">
                  {!validateApiKey ? (
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
          {chatError && (
            <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              <p className="text-sm">
                {chatError.message.includes('API key') 
                  ? 'Invalid API key. Please check your settings.' 
                  : `Error: ${chatError.message}`
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
    </ErrorBoundary>
  )
}