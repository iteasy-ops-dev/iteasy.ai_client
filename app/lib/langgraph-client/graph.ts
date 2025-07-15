import { ClientChatState } from './types'
import { classifyIntentLocal, classifyIntentWithLLM, generateSystemPrompt } from './nodes'

// Simplified workflow without LangGraph complex typing
export async function processMessageIntent(
  messages: ClientChatState['messages'],
  options?: {
    useLLMClassification?: boolean
    llmCall?: (prompt: string) => Promise<string>
  }
): Promise<ClientChatState> {
  console.log('🧠 LangGraph: Starting intent processing...')
  console.log('📋 LangGraph: Input messages count:', messages.length)
  
  let state: ClientChatState = {
    messages,
    intent: 'general',
    confidence: 0.5,
    systemPrompt: ''
  }
  
  // Step 1: Classify intent
  console.log('🔍 LangGraph: Step 1 - Classifying intent...')
  if (options?.useLLMClassification && options.llmCall) {
    console.log('🤖 LangGraph: Using LLM-based classification')
    state = await classifyIntentWithLLM(state, options.llmCall)
  } else {
    console.log('⚡ LangGraph: Using local keyword-based classification')
    state = await classifyIntentLocal(state)
  }
  
  console.log('✅ LangGraph: Intent classified:', {
    intent: state.intent,
    confidence: state.confidence
  })
  
  // Step 2: Generate system prompt
  console.log('📝 LangGraph: Step 2 - Generating system prompt...')
  state = await generateSystemPrompt(state)
  
  console.log('✅ LangGraph: System prompt generated:', {
    promptLength: state.systemPrompt?.length || 0,
    preview: state.systemPrompt?.substring(0, 100) || 'No prompt'
  })
  
  console.log('🎉 LangGraph: Processing complete!')
  return state
}