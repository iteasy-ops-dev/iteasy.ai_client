'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Chat, Message, TokenUsage, LangGraphMetadata } from '@/app/types'

interface ChatStore {
  chats: Chat[]
  currentChatId: string | null
  
  // Actions
  createNewChat: () => string
  selectChat: (chatId: string) => void
  deleteChat: (chatId: string) => void
  updateChatTitle: (chatId: string, title: string) => void
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'createdAt'>) => string
  getCurrentChat: () => Chat | null
  updateLastMessage: (chatId: string, content: string) => void
  updateMessageWithTokenUsage: (chatId: string, messageId: string, tokenUsage: TokenUsage) => void
  updateMessageWithLangGraphMetadata: (chatId: string, messageId: string, metadata: LangGraphMetadata) => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chats: [],
      currentChatId: null,

      createNewChat: () => {
        const newChatId = generateId()
        const newChat: Chat = {
          id: newChatId,
          title: 'New Chat',
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }

        set((state) => ({
          chats: [newChat, ...state.chats],
          currentChatId: newChatId,
        }))

        return newChatId
      },

      selectChat: (chatId: string) => {
        set({ currentChatId: chatId })
      },

      deleteChat: (chatId: string) => {
        set((state) => {
          const updatedChats = state.chats.filter((chat) => chat.id !== chatId)
          const newCurrentChatId = 
            state.currentChatId === chatId 
              ? (updatedChats.length > 0 ? updatedChats[0].id : null)
              : state.currentChatId

          return {
            chats: updatedChats,
            currentChatId: newCurrentChatId,
          }
        })
      },

      updateChatTitle: (chatId: string, title: string) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? { ...chat, title, updatedAt: new Date() }
              : chat
          ),
        }))
      },

      addMessage: (chatId: string, message: Omit<Message, 'id' | 'createdAt'>) => {
        const newMessage: Message = {
          ...message,
          id: generateId(),
          createdAt: new Date(),
        }
        
        // Removed debug log

        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: [...chat.messages, newMessage],
                  updatedAt: new Date(),
                }
              : chat
          ),
        }))

        // Auto-generate title from first user message
        const chat = get().chats.find((c) => c.id === chatId)
        if (chat && chat.messages.length === 1 && message.role === 'user') {
          const title = message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
          get().updateChatTitle(chatId, title)
        }

        return newMessage.id
      },

      updateLastMessage: (chatId: string, content: string) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((msg, index) =>
                    index === chat.messages.length - 1
                      ? { ...msg, content }
                      : msg
                  ),
                  updatedAt: new Date(),
                }
              : chat
          ),
        }))
      },

      getCurrentChat: () => {
        const { chats, currentChatId } = get()
        return chats.find((chat) => chat.id === currentChatId) || null
      },

      updateMessageWithTokenUsage: (chatId: string, messageId: string, tokenUsage: TokenUsage) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((msg) =>
                    msg.id === messageId
                      ? { ...msg, tokenUsage }
                      : msg
                  ),
                  updatedAt: new Date(),
                }
              : chat
          ),
        }))
      },

      updateMessageWithLangGraphMetadata: (chatId: string, messageId: string, metadata: LangGraphMetadata) => {
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: chat.messages.map((msg) =>
                    msg.id === messageId
                      ? { ...msg, langGraphMetadata: metadata }
                      : msg
                  ),
                  updatedAt: new Date(),
                }
              : chat
          ),
        }))
      },
    }),
    {
      name: 'chat-store',
      storage: createJSONStorage(() => {
        // Check if we're on the client side
        if (typeof window !== 'undefined') {
          return localStorage
        }
        // Return a no-op storage for server-side
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
      partialize: (state) => ({
        chats: state.chats.map(chat => ({
          ...chat,
          createdAt: chat.createdAt.toISOString(),
          updatedAt: chat.updatedAt.toISOString(),
          messages: chat.messages.map(msg => ({
            ...msg,
            createdAt: msg.createdAt?.toISOString(),
            tokenUsage: msg.tokenUsage, // Make sure tokenUsage is preserved
            langGraphMetadata: msg.langGraphMetadata, // Make sure langGraphMetadata is preserved
          }))
        })),
        currentChatId: state.currentChatId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.chats = state.chats.map(chat => ({
            ...chat,
            createdAt: new Date(chat.createdAt as any),
            updatedAt: new Date(chat.updatedAt as any),
            messages: chat.messages.map(msg => ({
              ...msg,
              createdAt: msg.createdAt ? new Date(msg.createdAt as any) : new Date(),
            }))
          }))
        }
      },
      skipHydration: true,
    }
  )
)