'use client'

import { KeyboardEvent, useEffect, useRef } from 'react'
import { Send, Square } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Textarea } from '@/app/components/ui/textarea'

import { ChangeEvent } from 'react'

interface InputAreaProps {
  input: string
  setInput: (e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: () => void
  isLoading: boolean
  stop: () => void
}

export default function InputArea({
  input,
  setInput,
  handleSubmit,
  isLoading,
  stop,
}: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && input.trim()) {
        handleSubmit()
      }
    }
  }

  // Auto-resize textarea based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto'
      // Set height to scrollHeight, but limit to max height
      const maxHeight = 200 // Maximum height in pixels (about 8-10 lines)
      const newHeight = Math.min(textarea.scrollHeight, maxHeight)
      textarea.style.height = `${newHeight}px`
    }
  }

  // Adjust height when input changes
  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  // Adjust height on mount
  useEffect(() => {
    adjustTextareaHeight()
  }, [])

  return (
    <div className="border-t bg-background px-4 py-4">
      <div className="mx-auto max-w-4xl w-full">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e)
              // Trigger resize after state update
              setTimeout(adjustTextareaHeight, 0)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            className="min-h-[60px] max-h-[200px] pr-12 resize-none overflow-y-auto w-full"
            disabled={isLoading}
            rows={1}
          />
          <div className="absolute bottom-2 right-2">
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={stop}
                className="h-8 w-8"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="h-8 w-8"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  )
}