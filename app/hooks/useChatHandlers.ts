'use client'

import { useCallback } from 'react'
import { useChatStore } from '@/app/store/chat-store'
import { useSettingsStore } from '@/app/store/settings-store'
import { useStreamingChat } from './useStreamingChat'
import type { Message } from '@/app/types'

export function useChatHandlers() {
  const {
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

  const { streamMessage, isStreaming, error, abortStream } = useStreamingChat()

  const handleSubmit = useCallback(async (input: string) => {
    if (!input.trim() || isStreaming) return

    // Validate API key for OpenAI
    if (llmProvider === 'openai' && !apiKey) {
      throw new Error('Please configure your OpenAI API key')
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

    // Add assistant message to store and get the actual ID
    let assistantMessageId = ''
    if (currentChatId) {
      assistantMessageId = addMessage(currentChatId, {
        role: 'assistant',
        content: '',
      })
    }

    let fullContent = ''

    const streamCallbacks = {
      onStream: (chunk: string) => {
        fullContent += chunk
        if (currentChatId) {
          updateLastMessage(currentChatId, fullContent)
        }
      },
      onFinish: (usage?: any) => {
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
    }

    // Convert messages to format expected by LLM
    const currentMessages = getCurrentChat()?.messages || []
    const llmMessages = currentMessages.concat(userMessage).map((msg: Message) => ({
      role: msg.role as 'user' | 'assistant' | 'system',
      content: msg.content,
    }))

    const config = {
      provider: llmProvider,
      apiKey,
      endpoint: localLLMEndpoint,
      model: llmProvider === 'openai' ? model : localLLMModel,
      temperature,
      maxTokens,
    } as const

    await streamMessage(llmMessages, config, streamCallbacks)
  }, [
    currentChatId,
    isStreaming,
    llmProvider,
    apiKey,
    model,
    temperature,
    maxTokens,
    localLLMEndpoint,
    localLLMModel,
    addMessage,
    getCurrentChat,
    updateLastMessage,
    updateMessageWithTokenUsage,
    updateChatTitle,
    streamMessage
  ])

  const handleNewChat = useCallback(() => {
    createNewChat()
  }, [createNewChat])

  const handleSelectChat = useCallback((chatId: string) => {
    selectChat(chatId)
  }, [selectChat])

  const handleDeleteChat = useCallback((chatId: string) => {
    deleteChat(chatId)
  }, [deleteChat])

  const handleStop = useCallback(() => {
    abortStream()
  }, [abortStream])

  return {
    handleSubmit,
    handleNewChat,
    handleSelectChat,
    handleDeleteChat,
    handleStop,
    isStreaming,
    error,
    validateApiKey: validateApiKey(),
  }
}