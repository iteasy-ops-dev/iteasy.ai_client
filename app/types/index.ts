export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  model: string
}

export interface LangGraphMetadata {
  intent: string
  confidence: number
  complexityLevel: 'simple' | 'complex' | 'multi_step'
  useReact: boolean
  reasoningChain?: Array<{
    step: number
    thought: string
    action?: any
    observation?: any
    timestamp: string
  }>
  currentStep?: number
  toolsUsed?: string[]
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system' | 'data'
  content: string
  createdAt?: Date
  tokenUsage?: TokenUsage
  langGraphMetadata?: LangGraphMetadata
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}