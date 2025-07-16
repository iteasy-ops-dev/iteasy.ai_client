'use client'

import { useState, useRef, useCallback } from 'react'
import { streamWithOpenAI, streamWithLocalLLM, type LLMConfig } from '@/app/lib/llm-providers'

export interface StreamingState {
  isStreaming: boolean
  error: Error | null
  abortController: AbortController | null
}

export interface UseStreamingChatOptions {
  onStream?: (chunk: string) => void
  onFinish?: (usage?: any) => void
  onLangGraphUpdate?: (metadata: any) => void
  onError?: (error: Error) => void
  maxRetries?: number
}

export function useStreamingChat(options: UseStreamingChatOptions = {}) {
  const {
    onStream,
    onFinish,
    onLangGraphUpdate,
    onError,
    maxRetries = 3
  } = options

  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    error: null,
    abortController: null
  })

  const retryCountRef = useRef(0)

  const updateState = useCallback((updates: Partial<StreamingState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const delay = useCallback((ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  }, [])

  const streamMessage = useCallback(async (
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    config: LLMConfig,
    streamCallbacks?: {
      onStream?: (chunk: string) => void
      onFinish?: (usage?: any) => void
      onLangGraphUpdate?: (metadata: any) => void
    }
  ) => {
    const abortController = new AbortController()
    updateState({ 
      isStreaming: true, 
      error: null, 
      abortController 
    })

    const attemptStream = async (attempt: number): Promise<void> => {
      try {
        console.log(`🔄 Streaming attempt ${attempt + 1}/${maxRetries}`)

        if (config.provider === 'openai') {
          await streamWithOpenAI(
            messages,
            config,
            streamCallbacks?.onStream || onStream || (() => {}),
            streamCallbacks?.onFinish || onFinish,
            streamCallbacks?.onLangGraphUpdate || onLangGraphUpdate
          )
        } else {
          await streamWithLocalLLM(
            messages,
            config,
            streamCallbacks?.onStream || onStream || (() => {}),
            streamCallbacks?.onFinish || onFinish,
            streamCallbacks?.onLangGraphUpdate || onLangGraphUpdate
          )
        }

        // 성공 시 재시도 카운터 리셋
        retryCountRef.current = 0
        console.log('✅ Streaming completed successfully')

      } catch (error) {
        const streamError = error as Error
        console.error(`❌ Streaming attempt ${attempt + 1} failed:`, streamError)

        // 중단된 경우는 재시도하지 않음
        if (abortController.signal.aborted) {
          throw new Error('Streaming was aborted by user')
        }

        // 최대 재시도 횟수 도달
        if (attempt >= maxRetries - 1) {
          throw streamError
        }

        // 지수 백오프로 재시도
        const backoffDelay = Math.pow(2, attempt) * 1000
        console.log(`⏳ Retrying in ${backoffDelay}ms...`)
        await delay(backoffDelay)

        // 재시도
        return attemptStream(attempt + 1)
      }
    }

    try {
      await attemptStream(0)
    } catch (error) {
      const finalError = error as Error
      updateState({ error: finalError })
      onError?.(finalError)
      throw finalError
    } finally {
      updateState({ 
        isStreaming: false, 
        abortController: null 
      })
    }
  }, [maxRetries, onStream, onFinish, onError, updateState, delay])

  const abortStream = useCallback(() => {
    if (state.abortController) {
      console.log('🛑 Aborting stream...')
      state.abortController.abort()
      updateState({ 
        isStreaming: false, 
        abortController: null,
        error: null 
      })
    }
  }, [state.abortController, updateState])

  const resetError = useCallback(() => {
    updateState({ error: null })
  }, [updateState])

  return {
    // State
    isStreaming: state.isStreaming,
    error: state.error,
    canAbort: !!state.abortController,

    // Actions
    streamMessage,
    abortStream,
    resetError,

    // Utils
    retryCount: retryCountRef.current
  }
}