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
  
  // Actions
  setApiKey: (apiKey: string) => void
  setModel: (model: string) => void
  setTemperature: (temperature: number) => void
  setMaxTokens: (maxTokens: number) => void
  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setFont: (font: 'inter' | 'noto-sans-kr' | 'open-sans' | 'roboto' | 'poppins' | 'nunito' | 'comfortaa' | 'quicksand' | 'lato' | 'source-sans-3' | 'noto-serif-kr' | 'ibm-plex-sans-kr') => void
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