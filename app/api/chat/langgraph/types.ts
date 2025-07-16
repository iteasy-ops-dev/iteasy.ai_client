import { BaseMessage } from '@langchain/core/messages'

export interface ChatState {
  messages: BaseMessage[]
  lastUserMessage: string
  intent: 'general' | 'system_engineering' | 'help' | null
  confidence: number
  systemPrompt?: string
  response?: string
  
  // ReAct Pattern Fields (Optional)
  complexityLevel?: 'simple' | 'complex' | 'multi_step'
  useReact?: boolean
  thoughts?: string[]
  actions?: ToolCall[]
  observations?: ToolResult[]
  reasoningChain?: ReActStep[]
  currentStep?: number
  toolsUsed?: string[]
}

export interface IntentClassificationResult {
  intent: 'general' | 'system_engineering' | 'help'
  confidence: number
  reasoning?: string
}

// ReAct Pattern Types
export interface ReActStep {
  step: number
  thought: string
  action?: ToolCall
  observation?: ToolResult
  timestamp: Date
}

export interface ToolCall {
  tool: string
  parameters: Record<string, any>
  reasoning: string
}

export interface ToolResult {
  success: boolean
  result: any
  error?: string
  executionTime: number
}

export interface ComplexityDetectionResult {
  level: 'simple' | 'complex' | 'multi_step'
  reasoning: string
  confidence: number
  useReact: boolean
}

export type NodeResponse = Partial<ChatState>