'use client'

import { memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, User, Bot, BarChart3 } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/lib/utils'
import Toast from '@/app/components/ui/toast'
import type { Message } from '@/app/types'

interface MessageItemProps {
  message: Message
}

const MessageItem = memo(function MessageItem({ message }: MessageItemProps) {
  const [showToast, setShowToast] = useState(false)
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const isUser = message.role === 'user'
  const hasTokenUsage = !isUser && message.tokenUsage

  return (
    <div className="w-full px-4 py-4">
      <div className="mx-auto max-w-4xl w-full">
        <div className={cn(
          "group relative flex gap-3 w-full",
          isUser 
            ? "justify-end" // User messages: align entire group to right
            : "justify-start" // AI messages: align entire group to left
        )}>
          {/* User Message Group - Right aligned */}
          {isUser ? (
            <div className="flex gap-3 items-start max-w-[70%]">
              {/* Message Content */}
              <div className="flex flex-col items-end relative">
                {/* Message Bubble */}
                <div className="relative px-4 py-3 rounded-2xl shadow-sm bg-primary text-primary-foreground rounded-br-sm">
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="absolute flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 -left-16 top-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(message.content)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                
                {/* Timestamp */}
                <div className="text-xs text-muted-foreground mt-1 px-2 text-right">
                  {message.createdAt && new Date(message.createdAt).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
              
              {/* User Avatar */}
              <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full shadow-sm bg-primary text-primary-foreground">
                <User className="h-4 w-4" />
              </div>
            </div>
          ) : (
            <>
              {/* AI Avatar */}
              <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full shadow-sm bg-accent text-accent-foreground">
                <Bot className="h-4 w-4" />
              </div>
              
              {/* AI Message Content */}
              <div className="flex flex-col flex-1 relative items-start">
                {/* Message Bubble */}
                <div className="relative px-4 py-3 rounded-2xl shadow-sm max-w-[70%] bg-card border border-border text-card-foreground rounded-bl-sm">
                  <div className="prose prose-sm prose-gray max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code(props) {
                          const { children, className, ...rest } = props
                          const match = /language-(\w+)/.exec(className || '')
                          return match ? (
                            <div className="relative mt-2 mb-2">
                              <SyntaxHighlighter
                                style={vscDarkPlus}
                                language={match[1]}
                                PreTag="div"
                                className="!mt-0 !mb-0 rounded-lg"
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-2 top-2 h-6 w-6 bg-gray-800 hover:bg-gray-700"
                                onClick={() => copyToClipboard(String(children))}
                              >
                                <Copy className="h-3 w-3 text-white" />
                              </Button>
                            </div>
                          ) : (
                            <code className="bg-muted px-1 py-0.5 rounded text-sm" {...rest}>
                              {children}
                            </code>
                          )
                        },
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        ul: ({ children }) => <ul className="mb-2 pl-4">{children}</ul>,
                        ol: ({ children }) => <ol className="mb-2 pl-4">{children}</ol>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="absolute flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 -right-16 top-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(message.content)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    
                    {/* Token Usage Button for AI messages */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowToast(true)}
                      title={hasTokenUsage ? "View token usage" : "No token data"}
                    >
                      <BarChart3 className={hasTokenUsage ? "h-3 w-3" : "h-3 w-3 opacity-50"} />
                    </Button>
                  </div>
                </div>
                
                {/* Timestamp */}
                <div className="text-xs text-muted-foreground mt-1 px-2 text-left">
                  {message.createdAt && new Date(message.createdAt).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Token Usage Toast */}
      {hasTokenUsage && (
        <Toast
          open={showToast}
          onOpenChange={setShowToast}
          title="Token Usage"
          duration={4000}
        >
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium">Model:</span> {message.tokenUsage!.model}
              </div>
              <div>
                <span className="font-medium">Total:</span> {message.tokenUsage!.totalTokens}
              </div>
              <div>
                <span className="font-medium">Prompt:</span> {message.tokenUsage!.promptTokens}
              </div>
              <div>
                <span className="font-medium">Completion:</span> {message.tokenUsage!.completionTokens}
              </div>
            </div>
          </div>
        </Toast>
      )}
    </div>
  )
})

export default MessageItem