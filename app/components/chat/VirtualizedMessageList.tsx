'use client'

import { useEffect, useRef, useMemo, memo } from 'react'
import { VariableSizeList as List } from 'react-window'
import { useChatStore } from '@/app/store/chat-store'
import MessageItem from './MessageItem'
import WaveText from '../ui/wave-text'
import type { Message } from '@/app/types'

interface VirtualizedMessageListProps {
  messages: Message[]
  isLoading?: boolean
  height?: number
  width?: number | string
}

interface MessageRowProps {
  index: number
  style: React.CSSProperties
  data: {
    messages: Message[]
    isLoading: boolean
  }
}

// Memoized message row component for better performance
const MessageRow = memo(function MessageRow({ index, style, data }: MessageRowProps) {
  const { messages, isLoading } = data
  
  // Loading indicator at the end
  if (index === messages.length && isLoading) {
    return (
      <div style={style}>
        <div className="w-full px-4 py-6 bg-muted/20">
          <div className="mx-auto max-w-4xl w-full flex gap-4">
            <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
              <div className="h-4 w-4 rounded-full bg-primary animate-pulse" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="text-muted-foreground">
                <WaveText text="Thinking..." className="text-muted-foreground" duration={1.2} delay={0.08} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  const message = messages[index]
  if (!message) return null
  
  return (
    <div style={style}>
      <MessageItem message={message} />
    </div>
  )
})

// Hook for calculating dynamic item heights (advanced optimization)
function useMessageHeights(messages: Message[]) {
  const heightCache = useRef<Map<string, number>>(new Map())
  
  const getItemHeight = (index: number): number => {
    const message = messages[index]
    if (!message) return 100 // Default height
    
    const cached = heightCache.current.get(message.id)
    if (cached) return cached
    
    // Estimate height based on content length
    const baseHeight = 120 // Base message height
    const contentLines = Math.ceil(message.content.length / 80) // Rough estimate
    const estimatedHeight = Math.max(baseHeight, baseHeight + (contentLines - 1) * 20)
    
    heightCache.current.set(message.id, estimatedHeight)
    return estimatedHeight
  }
  
  return { getItemHeight }
}

export default function VirtualizedMessageList({ 
  messages, 
  isLoading = false, 
  height = 600,
  width = '100%'
}: VirtualizedMessageListProps) {
  const { getCurrentChat } = useChatStore()
  const currentChat = getCurrentChat()
  const listRef = useRef<List>(null)
  
  // Use store messages if available (they have tokenUsage), fallback to prop messages
  const displayMessages = currentChat?.messages || messages
  const { getItemHeight } = useMessageHeights(displayMessages)
  
  // Calculate total item count (messages + loading indicator)
  const itemCount = displayMessages.length + (isLoading ? 1 : 0)
  
  // Memoize list data to prevent unnecessary re-renders
  const listData = useMemo(() => ({
    messages: displayMessages,
    isLoading
  }), [displayMessages, isLoading])
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (listRef.current && displayMessages.length > 0) {
      // Scroll to the last item with a slight delay to ensure rendering
      setTimeout(() => {
        listRef.current?.scrollToItem(itemCount - 1, 'end')
      }, 100)
    }
  }, [displayMessages.length, itemCount])
  
  // Empty state
  if (displayMessages.length === 0 && !isLoading) {
    return (
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
    )
  }
  
  return (
    <div className="flex-1 h-full">
      <List
        ref={listRef}
        height={height}
        width={width}
        itemCount={itemCount}
        itemSize={(index) => {
          // Loading indicator has fixed height
          if (index === displayMessages.length && isLoading) {
            return 100
          }
          return getItemHeight(index)
        }}
        itemData={listData}
        overscanCount={5} // Render 5 extra items for smooth scrolling
        className="scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
      >
        {MessageRow}
      </List>
    </div>
  )
}