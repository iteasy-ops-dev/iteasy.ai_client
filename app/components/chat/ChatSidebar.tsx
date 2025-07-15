'use client'

import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Settings, Edit3, Check, X, PanelLeft } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { ScrollArea } from '@/app/components/ui/scroll-area'
import { Input } from '@/app/components/ui/input'
import { cn } from '@/app/lib/utils'
import type { Chat } from '@/app/types'

interface ChatSidebarProps {
  chats: Chat[]
  currentChatId: string | null
  onNewChat: () => void
  onSelectChat: (chatId: string) => void
  onDeleteChat: (chatId: string) => void
  onOpenSettings: () => void
  onUpdateChatTitle: (chatId: string, title: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function ChatSidebar({
  chats,
  currentChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onOpenSettings,
  onUpdateChatTitle,
  isCollapsed,
  onToggleCollapse,
}: ChatSidebarProps) {
  const [editingChatId, setEditingChatId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleStartEdit = (chat: Chat) => {
    setEditingChatId(chat.id)
    setEditTitle(chat.title)
  }

  const handleSaveEdit = () => {
    if (editingChatId && editTitle.trim()) {
      onUpdateChatTitle(editingChatId, editTitle.trim())
    }
    setEditingChatId(null)
    setEditTitle('')
  }

  const handleCancelEdit = () => {
    setEditingChatId(null)
    setEditTitle('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }
  return (
    <div className={cn(
      "flex h-full flex-col border-r bg-muted/20 transition-all duration-300",
      isCollapsed ? "w-16" : "w-56"
    )}>
      {/* Toggle Button Section */}
      <div className="p-4 border-b border-border">
        <Button
          onClick={onToggleCollapse}
          variant="ghost"
          size="icon"
          className="w-8 h-8 mx-auto"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      </div>
      
      {/* New Chat Section */}
      <div className="p-4 border-b border-border">
        {isCollapsed ? (
          <div className="flex justify-center">
            <Button
              onClick={onNewChat}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button onClick={onNewChat} className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        )}
      </div>
      
      {/* Chat History Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-border">
          {!isCollapsed && (
            <h3 className="text-sm font-medium text-muted-foreground">Recent Chats</h3>
          )}
        </div>
        
        <ScrollArea className="flex-1 px-3 py-3">
          <div className="space-y-1">
          {chats.length === 0 ? (
            !isCollapsed ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">아직 대화가 없습니다</p>
                <p className="text-xs text-muted-foreground mt-1">새 채팅을 시작해보세요</p>
              </div>
            ) : null
          ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                'group flex items-center rounded-lg text-sm hover:bg-accent transition-colors',
                currentChatId === chat.id && 'bg-accent',
                editingChatId !== chat.id && 'cursor-pointer',
                isCollapsed ? 'px-2 py-2 justify-center mx-1' : 'px-3 py-2 mx-1'
              )}
              onClick={editingChatId === chat.id ? undefined : () => onSelectChat(chat.id)}
              title={isCollapsed ? chat.title || 'New Chat' : undefined}
            >
              <MessageSquare className={cn("h-4 w-4 shrink-0", isCollapsed ? "" : "mr-2")} />
              
              {!isCollapsed && (
                editingChatId === chat.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="h-6 text-xs px-2"
                      autoFocus
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleSaveEdit}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 truncate">
                      {chat.title || 'New Chat'}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartEdit(chat)
                        }}
                      >
                        <Edit3 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteChat(chat.id)
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )
              )}
            </div>
          ))
          )}
          </div>
        </ScrollArea>
      </div>
      
      {/* Settings Section */}
      <div className="p-4 border-t border-border">
        <Button 
          onClick={onOpenSettings} 
          variant="outline" 
          className={cn(
            isCollapsed ? "w-8 h-8 p-0 mx-auto" : "w-full"
          )}
          size={isCollapsed ? "icon" : "default"}
        >
          <Settings className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
          {!isCollapsed && "Settings"}
        </Button>
      </div>
    </div>
  )
}