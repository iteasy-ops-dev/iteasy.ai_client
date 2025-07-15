'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface SettingsStore {
  apiKey: string
  model: string
  temperature: number
  maxTokens: number
  theme: 'light' | 'dark' | 'system'
  font: 'inter' | 'noto-sans-kr' | 'open-sans' | 'roboto' | 'poppins' | 'nunito' | 'comfortaa' | 'quicksand' | 'lato' | 'source-sans-3' | 'noto-serif-kr' | 'ibm-plex-sans-kr'
  
  // Local LLM settings
  llmProvider: 'openai' | 'local' | 'ollama'
  localLLMEndpoint: string
  localLLMModel: string
  
  // Actions
  setApiKey: (apiKey: string) => void
  setModel: (model: string) => void
  setTemperature: (temperature: number) => void
  setMaxTokens: (maxTokens: number) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setFont: (font: 'inter' | 'noto-sans-kr' | 'open-sans' | 'roboto' | 'poppins' | 'nunito' | 'comfortaa' | 'quicksand' | 'lato' | 'source-sans-3' | 'noto-serif-kr' | 'ibm-plex-sans-kr') => void
  setLLMProvider: (provider: 'openai' | 'local' | 'ollama') => void
  setLocalLLMEndpoint: (endpoint: string) => void
  setLocalLLMModel: (model: string) => void
  validateApiKey: () => boolean
  resetSettings: () => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      apiKey: '',
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000,
      theme: 'system' as 'light' | 'dark' | 'system',
      font: 'inter' as 'inter' | 'noto-sans-kr' | 'open-sans' | 'roboto' | 'poppins' | 'nunito' | 'comfortaa' | 'quicksand' | 'lato' | 'source-sans-3' | 'noto-serif-kr' | 'ibm-plex-sans-kr',
      
      // Local LLM defaults
      llmProvider: 'openai' as 'openai' | 'local' | 'ollama',
      localLLMEndpoint: 'http://localhost:11434/api/generate',
      localLLMModel: 'llama2',

      setApiKey: (apiKey: string) => {
        set({ apiKey: apiKey.trim() })
      },

      setModel: (model: string) => {
        set({ model })
      },

      setTemperature: (temperature: number) => {
        set({ temperature: Math.max(0, Math.min(2, temperature)) })
      },

      setMaxTokens: (maxTokens: number) => {
        set({ maxTokens: Math.max(1, Math.min(4000, maxTokens)) })
      },

      setTheme: (theme: 'light' | 'dark' | 'system') => {
        set({ theme })
      },

      setFont: (font: 'inter' | 'noto-sans-kr' | 'open-sans' | 'roboto' | 'poppins' | 'nunito' | 'comfortaa' | 'quicksand' | 'lato' | 'source-sans-3' | 'noto-serif-kr' | 'ibm-plex-sans-kr') => {
        set({ font })
      },
      
      setLLMProvider: (provider: 'openai' | 'local' | 'ollama') => {
        set({ llmProvider: provider })
      },
      
      setLocalLLMEndpoint: (endpoint: string) => {
        set({ localLLMEndpoint: endpoint })
      },
      
      setLocalLLMModel: (model: string) => {
        set({ localLLMModel: model })
      },

      validateApiKey: () => {
        const { apiKey } = get()
        return apiKey.length > 0 && apiKey.startsWith('sk-')
      },

      resetSettings: () => {
        set({
          apiKey: '',
          model: 'gpt-3.5-turbo',
          temperature: 0.7,
          maxTokens: 1000,
          theme: 'system' as 'light' | 'dark' | 'system',
          font: 'inter' as 'inter' | 'noto-sans-kr' | 'open-sans' | 'roboto' | 'poppins' | 'nunito' | 'comfortaa' | 'quicksand' | 'lato' | 'source-sans-3' | 'noto-serif-kr' | 'ibm-plex-sans-kr',
          llmProvider: 'openai' as 'openai' | 'local' | 'ollama',
          localLLMEndpoint: 'http://localhost:11434/api/generate',
          localLLMModel: 'llama2',
        })
      },
    }),
    {
      name: 'settings-store',
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
      skipHydration: false,
    }
  )
)