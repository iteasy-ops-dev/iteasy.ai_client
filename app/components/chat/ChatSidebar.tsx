'use client'

import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Settings, Edit3, Check, X } from 'lucide-react'
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
}

export default function ChatSidebar({
  chats,
  currentChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onOpenSettings,
  onUpdateChatTitle,
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
    <div className="flex h-full w-64 flex-col border-r bg-muted/20">
      <div className="p-4">
        <Button onClick={onNewChat} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                'group flex items-center rounded-lg px-3 py-2 text-sm hover:bg-accent',
                currentChatId === chat.id && 'bg-accent',
                editingChatId !== chat.id && 'cursor-pointer'
              )}
              onClick={editingChatId === chat.id ? undefined : () => onSelectChat(chat.id)}
            >
              <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
              
              {editingChatId === chat.id ? (
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
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t">
        <Button onClick={onOpenSettings} variant="outline" className="w-full">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  )
}