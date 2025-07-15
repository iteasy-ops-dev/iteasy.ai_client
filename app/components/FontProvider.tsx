'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/app/store/settings-store'

const fontClassMap = {
  'inter': 'font-inter',
  'noto-sans-kr': 'font-noto-sans-kr',
  'open-sans': 'font-open-sans',
  'roboto': 'font-roboto',
  'poppins': 'font-poppins',
  'nunito': 'font-nunito',
  'comfortaa': 'font-comfortaa',
  'quicksand': 'font-quicksand',
  'lato': 'font-lato',
  'source-sans-3': 'font-source-sans-3',
  'noto-serif-kr': 'font-noto-serif-kr',
  'ibm-plex-sans-kr': 'font-ibm-plex-sans-kr',
}

export function FontProvider({ children }: { children: React.ReactNode }) {
  const { font } = useSettingsStore()
  
  // Initialize font on mount
  useEffect(() => {
    console.log('FontProvider initialized with font:', font)
  }, [])

  useEffect(() => {
    // Remove all font classes from both html and body
    Object.values(fontClassMap).forEach(className => {
      document.documentElement.classList.remove(className)
      document.body.classList.remove(className)
    })
    
    // Add current font class to body
    const fontClass = fontClassMap[font] || fontClassMap.inter
    document.body.classList.add(fontClass)
    
    console.log(`Font changed to: ${font} (${fontClass})`)
  }, [font])

  return <>{children}</>
}