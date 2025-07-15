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
      <div className="space-y-0 h-full">
        {displayMessages.length === 0 && !isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[calc(100vh-200px)]">
            <div className="text-center space-y-4 max-w-md mx-auto px-6">
              <div className="text-4xl">💬</div>
              <h3 className="text-xl font-semibold text-foreground">새로운 대화를 시작하세요</h3>
              <p className="text-muted-foreground leading-relaxed">
                ITEasy AI Assistant와 대화를 시작해보세요.<br/>
                업무 관련 질문이나 기술적인 문제를 도와드릴 수 있습니다.
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>💡 예시 질문:</p>
                <p>• "Docker 컨테이너 실행 방법 알려줘"</p>
                <p>• "AWS EC2 설정 도움이 필요해"</p>
                <p>• "이 AI의 기능이 궁금해"</p>
              </div>
            </div>
          </div>
        ) : (
          displayMessages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))
        )}
        {isLoading && (
          <div className="w-full px-4 py-6 bg-muted/20">
            <div className="mx-auto max-w-4xl w-full flex gap-4">
              <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
                <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-muted-foreground">Thinking...</div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  )
}