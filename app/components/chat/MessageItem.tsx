'use client'

import { memo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, User, Bot, BarChart3, Check, ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/app/lib/utils'
import Toast from '@/app/components/ui/toast'
import type { Message } from '@/app/types'

interface MessageItemProps {
  message: Message
}

// Helper function to parse <think> tags
function parseThinkTags(content: string) {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g
  const parts: Array<{ type: 'text' | 'think', content: string, id?: string }> = []
  let lastIndex = 0
  let match

  while ((match = thinkRegex.exec(content)) !== null) {
    // Add text before think tag
    if (match.index > lastIndex) {
      const textContent = content.slice(lastIndex, match.index).trim()
      if (textContent) {
        parts.push({ type: 'text', content: textContent })
      }
    }
    
    // Add think content
    parts.push({ 
      type: 'think', 
      content: match[1].trim(),
      id: `think-${parts.length}` 
    })
    
    lastIndex = match.index + match[0].length
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim()
    if (textContent) {
      parts.push({ type: 'text', content: textContent })
    }
  }
  
  // If no think tags found, return original content as single text part
  if (parts.length === 0) {
    parts.push({ type: 'text', content })
  }
  
  return parts
}

const MessageItem = memo(function MessageItem({ message }: MessageItemProps) {
  const [showToast, setShowToast] = useState(false)
  const [showCopySuccess, setShowCopySuccess] = useState(false)
  const [expandedThinkSections, setExpandedThinkSections] = useState<Set<string>>(new Set())
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setShowCopySuccess(true)
    setTimeout(() => setShowCopySuccess(false), 2000)
  }

  const toggleThinkSection = (sectionId: string) => {
    setExpandedThinkSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

  const isUser = message.role === 'user'
  const hasTokenUsage = !isUser && !!message.tokenUsage
  
  // Parse message content for think tags
  const parsedContent = parseThinkTags(message.content)

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
                  <div className="message-content text-sm whitespace-pre-wrap font-normal">
                    {message.content}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="absolute flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 -left-16 top-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 transition-colors ${
                        showCopySuccess 
                          ? 'text-green-600 hover:text-green-700' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => copyToClipboard(message.content)}
                    >
                      {showCopySuccess ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
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
                  <div className="message-content prose prose-sm prose-gray max-w-none text-sm font-normal">
                    {parsedContent.map((part, index) => (
                      <div key={index}>
                        {part.type === 'text' ? (
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
                                      className={`absolute right-2 top-2 h-6 w-6 transition-colors ${
                                        showCopySuccess
                                          ? 'bg-green-700 hover:bg-green-600'
                                          : 'bg-gray-800 hover:bg-gray-700'
                                      }`}
                                      onClick={() => copyToClipboard(String(children))}
                                    >
                                      {showCopySuccess ? (
                                        <Check className="h-3 w-3 text-white" />
                                      ) : (
                                        <Copy className="h-3 w-3 text-white" />
                                      )}
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
                            {part.content}
                          </ReactMarkdown>
                        ) : (
                          // Think section
                          <div className="my-3 border border-border bg-muted/30 rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleThinkSection(part.id!)}
                              className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors"
                            >
                              <Brain className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium text-muted-foreground">AI Thinking Process</span>
                              <div className="flex-1" />
                              {expandedThinkSections.has(part.id!) ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </button>
                            {expandedThinkSections.has(part.id!) && (
                              <div className="px-3 pb-3 border-t border-border/50">
                                <div className="mt-2 text-sm text-muted-foreground/80">
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                      ul: ({ children }) => <ul className="mb-2 pl-4">{children}</ul>,
                                      ol: ({ children }) => <ol className="mb-2 pl-4">{children}</ol>,
                                    }}
                                  >
                                    {part.content}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="absolute flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 -right-16 top-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 transition-colors ${
                        showCopySuccess 
                          ? 'text-green-600 hover:text-green-700' 
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      onClick={() => copyToClipboard(message.content)}
                    >
                      {showCopySuccess ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    
                    {/* Token Usage Button for AI messages only */}
                    {!isUser && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 ${hasTokenUsage ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50'}`}
                        onClick={() => {
                          setShowToast(true)
                        }}
                        title={hasTokenUsage ? "View token usage" : "Token data not available yet"}
                      >
                        <BarChart3 className={hasTokenUsage ? "h-3 w-3" : "h-3 w-3 opacity-30"} />
                      </Button>
                    )}
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
      <Toast
        open={showToast}
        onOpenChange={setShowToast}
        title="Token Usage"
        duration={4000}
      >
        <div className="space-y-2">
          {message.tokenUsage ? (
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="font-medium">Model:</span> {message.tokenUsage.model || 'Unknown'}
              </div>
              <div>
                <span className="font-medium">Total:</span> {message.tokenUsage.totalTokens || 0}
              </div>
              <div>
                <span className="font-medium">Prompt:</span> {message.tokenUsage.promptTokens || 0}
              </div>
              <div>
                <span className="font-medium">Completion:</span> {message.tokenUsage.completionTokens || 0}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              <p>Token usage data not available.</p>
              <div className="mt-2 p-2 bg-muted rounded text-xs">
                <p><strong>Debug Info:</strong></p>
                <p>Message ID: {message.id}</p>
                <p>Role: {message.role}</p>
                <p>TokenUsage: {JSON.stringify(message.tokenUsage)}</p>
              </div>
            </div>
          )}
        </div>
      </Toast>
    </div>
  )
})

export default MessageItem