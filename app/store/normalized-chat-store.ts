'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Chat, Message, TokenUsage } from '@/app/types'

// Normalized state structure for better performance and memory efficiency
interface NormalizedChatState {
  // Entities
  chats: Record<string, Omit<Chat, 'messages'>>
  messages: Record<string, Message>
  
  // Relations
  chatMessages: Record<string, string[]> // chatId -> messageIds[]
  
  // UI State
  currentChatId: string | null
}

interface NormalizedChatActions {
  // Chat actions
  createNewChat: () => string
  selectChat: (chatId: string) => void
  deleteChat: (chatId: string) => void
  updateChatTitle: (chatId: string, title: string) => void
  
  // Message actions
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'createdAt'>) => string
  updateMessage: (messageId: string, updates: Partial<Message>) => void
  updateMessageWithTokenUsage: (messageId: string, tokenUsage: TokenUsage) => void
  updateLastMessage: (chatId: string, content: string) => void
  
  // Selectors
  getCurrentChat: () => Chat | null
  getChatMessages: (chatId: string) => Message[]
  getAllChats: () => Chat[]
  
  // Utilities
  reset: () => void
}

type NormalizedChatStore = NormalizedChatState & NormalizedChatActions

const generateId = () => Math.random().toString(36).substring(2, 15)

const initialState: NormalizedChatState = {
  chats: {},
  messages: {},
  chatMessages: {},
  currentChatId: null,
}

export const useNormalizedChatStore = create<NormalizedChatStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      createNewChat: () => {
        const newChatId = generateId()
        const newChat: Omit<Chat, 'messages'> = {
          id: newChatId,
          title: 'New Chat',
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        set((state) => ({
          chats: {
            ...state.chats,
            [newChatId]: newChat
          },
          chatMessages: {
            ...state.chatMessages,
            [newChatId]: []
          },
          currentChatId: newChatId,
        }))

        return newChatId
      },

      selectChat: (chatId: string) => {
        set({ currentChatId: chatId })
      },

      deleteChat: (chatId: string) => {
        set((state) => {
          const { [chatId]: deletedChat, ...remainingChats } = state.chats
          const { [chatId]: deletedChatMessages, ...remainingChatMessages } = state.chatMessages
          
          // Delete all messages for this chat
          const messagesToDelete = state.chatMessages[chatId] || []
          const updatedMessages = { ...state.messages }
          messagesToDelete.forEach(messageId => {
            delete updatedMessages[messageId]
          })

          // Find new current chat if the deleted one was selected
          const remainingChatIds = Object.keys(remainingChats)
          const newCurrentChatId = 
            state.currentChatId === chatId 
              ? (remainingChatIds.length > 0 ? remainingChatIds[0] : null)
              : state.currentChatId

          return {
            chats: remainingChats,
            messages: updatedMessages,
            chatMessages: remainingChatMessages,
            currentChatId: newCurrentChatId,
          }
        })
      },

      updateChatTitle: (chatId: string, title: string) => {
        set((state) => ({
          chats: {
            ...state.chats,
            [chatId]: {
              ...state.chats[chatId],
              title,
              updatedAt: new Date(),
            }
          }
        }))
      },

      addMessage: (chatId: string, message: Omit<Message, 'id' | 'createdAt'>) => {
        const messageId = generateId()
        const newMessage: Message = {
          ...message,
          id: messageId,
          createdAt: new Date(),
        }

        set((state) => ({
          messages: {
            ...state.messages,
            [messageId]: newMessage
          },
          chatMessages: {
            ...state.chatMessages,
            [chatId]: [...(state.chatMessages[chatId] || []), messageId]
          },
          chats: {
            ...state.chats,
            [chatId]: {
              ...state.chats[chatId],
              updatedAt: new Date(),
            }
          }
        }))

        // Auto-generate title from first user message
        const state = get()
        const chatMessageIds = state.chatMessages[chatId] || []
        if (chatMessageIds.length === 1 && message.role === 'user') {
          const title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
          get().updateChatTitle(chatId, title)
        }

        return messageId
      },

      updateMessage: (messageId: string, updates: Partial<Message>) => {
        set((state) => ({
          messages: {
            ...state.messages,
            [messageId]: {
              ...state.messages[messageId],
              ...updates
            }
          }
        }))
      },

      updateMessageWithTokenUsage: (messageId: string, tokenUsage: TokenUsage) => {
        get().updateMessage(messageId, { tokenUsage })
      },

      updateLastMessage: (chatId: string, content: string) => {
        const state = get()
        const messageIds = state.chatMessages[chatId] || []
        const lastMessageId = messageIds[messageIds.length - 1]
        
        if (lastMessageId) {
          get().updateMessage(lastMessageId, { content })
        }
      },

      // Selectors with memoization potential
      getCurrentChat: (): Chat | null => {
        const state = get()
        const { currentChatId, chats } = state
        
        if (!currentChatId || !chats[currentChatId]) {
          return null
        }

        return {
          ...chats[currentChatId],
          messages: get().getChatMessages(currentChatId)
        }
      },

      getChatMessages: (chatId: string): Message[] => {
        const state = get()
        const messageIds = state.chatMessages[chatId] || []
        return messageIds
          .map(id => state.messages[id])
          .filter(Boolean) // Filter out any undefined messages
          .sort((a, b) => {
            const aTime = a.createdAt?.getTime() || 0
            const bTime = b.createdAt?.getTime() || 0
            return aTime - bTime
          })
      },

      getAllChats: (): Chat[] => {
        const state = get()
        return Object.values(state.chats)
          .map(chat => ({
            ...chat,
            messages: get().getChatMessages(chat.id)
          }))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      },

      reset: () => {
        set(initialState)
      },
    }),
    {
      name: 'normalized-chat-store',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
      partialize: (state) => {
        // Custom serialization for dates
        const serializedChats: Record<string, any> = {}
        Object.entries(state.chats).forEach(([id, chat]) => {
          serializedChats[id] = {
            ...chat,
            createdAt: chat.createdAt.toISOString(),
            updatedAt: chat.updatedAt.toISOString(),
          }
        })

        const serializedMessages: Record<string, any> = {}
        Object.entries(state.messages).forEach(([id, message]) => {
          serializedMessages[id] = {
            ...message,
            createdAt: message.createdAt?.toISOString(),
            tokenUsage: message.tokenUsage,
          }
        })

        return {
          chats: serializedChats,
          messages: serializedMessages,
          chatMessages: state.chatMessages,
          currentChatId: state.currentChatId,
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Deserialize dates
          const deserializedChats: Record<string, any> = {}
          Object.entries(state.chats).forEach(([id, chat]) => {
            deserializedChats[id] = {
              ...chat,
              createdAt: new Date(chat.createdAt),
              updatedAt: new Date(chat.updatedAt),
            }
          })

          const deserializedMessages: Record<string, any> = {}
          Object.entries(state.messages).forEach(([id, message]) => {
            deserializedMessages[id] = {
              ...message,
              createdAt: message.createdAt ? new Date(message.createdAt) : new Date(),
            }
          })

          state.chats = deserializedChats
          state.messages = deserializedMessages
        }
      },
      skipHydration: true,
    }
  )
)

// Performance monitoring hook (development only)
export function useChatStoreStats() {
  const store = useNormalizedChatStore()
  
  if (process.env.NODE_ENV === 'development') {
    const stats = {
      totalChats: Object.keys(store.chats).length,
      totalMessages: Object.keys(store.messages).length,
      averageMessagesPerChat: Object.keys(store.messages).length / Math.max(Object.keys(store.chats).length, 1),
      memoryEstimate: `${Math.round(JSON.stringify(store).length / 1024)}KB`
    }
    
    return stats
  }
  
  return null
}