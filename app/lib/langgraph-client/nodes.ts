import { ClientChatState, IntentClassificationResult } from './types'
import { INTENT_CLASSIFICATION_PROMPT, SYSTEM_PROMPTS } from './prompts'

// Simple keyword-based intent classifier (no LLM required for basic classification)
export async function classifyIntentLocal(state: ClientChatState): Promise<ClientChatState> {
  const lastMessage = state.messages[state.messages.length - 1]?.content || ''
  
  // Keyword-based classification for offline/fast mode
  const systemKeywords = /docker|kubernetes|k8s|aws|gcp|azure|linux|ubuntu|centos|nginx|apache|mysql|postgres|mongodb|redis|terraform|ansible|jenkins|gitlab|github\s+actions|ci\/cd|devops|서버|네트워크|데이터베이스|클라우드|컨테이너|쿠버네티스|도커/i
  const helpKeywords = /사용법|도움|help|기능|어떻게|how to use|what can you do|설명해|알려줘.*AI|이.*AI.*뭐|무엇.*할.*있/i
  
  let intent: 'general' | 'system_engineering' | 'help' = 'general'
  let confidence = 0.7
  
  if (helpKeywords.test(lastMessage)) {
    intent = 'help'
    confidence = 0.9
  } else if (systemKeywords.test(lastMessage)) {
    intent = 'system_engineering'
    confidence = 0.85
  }
  
  return {
    ...state,
    intent,
    confidence
  }
}

// LLM-based intent classifier (when online)
export async function classifyIntentWithLLM(
  state: ClientChatState,
  llmCall: (prompt: string) => Promise<string>
): Promise<ClientChatState> {
  const lastMessage = state.messages[state.messages.length - 1]?.content || ''
  
  try {
    const prompt = INTENT_CLASSIFICATION_PROMPT.replace('{userMessage}', lastMessage)
    const response = await llmCall(prompt)
    
    // Parse JSON response
    const result: IntentClassificationResult = JSON.parse(response)
    
    return {
      ...state,
      intent: result.intent,
      confidence: result.confidence
    }
  } catch (error) {
    console.error('LLM classification failed, falling back to local:', error)
    // Fallback to local classification
    return classifyIntentLocal(state)
  }
}

// Generate system prompt based on intent
export async function generateSystemPrompt(state: ClientChatState): Promise<ClientChatState> {
  const systemPrompt = SYSTEM_PROMPTS[state.intent || 'general']
  
  return {
    ...state,
    systemPrompt
  }
}

// Route to appropriate response mode
export function routeByIntent(state: ClientChatState) {
  // High confidence threshold for specialized modes
  if (state.confidence && state.confidence >= 0.7) {
    return state.intent || 'general'
  }
  return 'general'
}