export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'data'
  content: string
  createdAt?: Date
  tokenUsage?: TokenUsage
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}