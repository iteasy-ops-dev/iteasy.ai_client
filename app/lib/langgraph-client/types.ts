// Client-side LangGraph types for local LLM support
export interface ClientChatState {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
  }>
  intent?: 'general' | 'system_engineering' | 'help'
  confidence?: number
  systemPrompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  apiEndpoint?: string // For local LLM endpoints
  isLocalLLM?: boolean
}

export interface LLMProvider {
  type: 'openai' | 'local' | 'ollama' | 'custom'
  endpoint?: string
  apiKey?: string
  model: string
}

export interface IntentClassificationResult {
  intent: 'general' | 'system_engineering' | 'help'
  confidence: number
  reasoning?: string
}