'use client'

import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { useChatStore } from '@/app/store/chat-store'
import MessageItem from './MessageItem'
import type { Message } from '@/app/types'

interface MessageListProps {
  messages: Message[]
  isLoading?: boolean
}

export default function MessageList({ messages, isLoading }: MessageListProps) {
  const { getCurrentChat } = useChatStore()
  const currentChat = getCurrentChat()
  
  // Use store messages if available (they have tokenUsage), fallback to useChat messages
  const displayMessages = currentChat?.messages || messages
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [displayMessages])

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-0">
        {displayMessages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
        {isLoading && (
          <div className="flex w-full gap-4 px-4 py-6 bg-muted/20">
            <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
              <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="text-muted-foreground">Thinking...</div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  )
}