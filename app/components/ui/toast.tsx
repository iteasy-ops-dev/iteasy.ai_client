'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/app/lib/utils'

interface ToastProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  children: React.ReactNode
  duration?: number
}

export default function Toast({ open, onOpenChange, title, children, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (open && duration > 0) {
      const timer = setTimeout(() => {
        onOpenChange(false)
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [open, duration, onOpenChange])

  if (!open) return null

  return (
    <div className="fixed top-4 right-4 z-50">
      <div className={cn(
        "bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-[300px] max-w-[400px]",
        "animate-in slide-in-from-top-2 duration-200"
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {title && (
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                {title}
              </h4>
            )}
            <div className="text-sm text-gray-600">
              {children}
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}