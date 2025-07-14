import { BaseMessage } from '@langchain/core/messages'

export interface ChatState {
  messages: BaseMessage[]
  lastUserMessage: string
  intent: 'general' | 'system_engineering' | 'help' | null
  confidence: number
  systemPrompt?: string
  response?: string
}

export interface IntentClassificationResult {
  intent: 'general' | 'system_engineering' | 'help'
  confidence: number
  reasoning?: string
}

export type NodeResponse = Partial<ChatState>