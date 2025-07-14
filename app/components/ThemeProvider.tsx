'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/app/store/settings-store'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useSettingsStore()

  // Apply theme immediately on mount (synchronous)
  useEffect(() => {
    const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
      const root = window.document.documentElement
      root.classList.remove('light', 'dark')
      
      if (newTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        root.classList.add(systemTheme)
      } else {
        root.classList.add(newTheme)
      }
    }

    // Wait for store hydration to complete, then sync with store
    const timer = setTimeout(() => {
      const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' || 'system'
      applyTheme(savedTheme)
      
      if (savedTheme !== theme) {
        setTheme(savedTheme)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // Apply theme whenever theme changes
    const applyTheme = (newTheme: 'light' | 'dark' | 'system') => {
      const root = window.document.documentElement
      root.classList.remove('light', 'dark')
      
      if (newTheme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        root.classList.add(systemTheme)
      } else {
        root.classList.add(newTheme)
      }
    }

    applyTheme(theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  return <>{children}</>
}