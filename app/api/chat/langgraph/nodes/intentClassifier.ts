import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatState, IntentClassificationResult, NodeResponse } from '../types'
import { INTENT_CLASSIFICATION_PROMPT } from '../prompts/intentClassification'

// Local keyword-based intent classification for fallback
function classifyIntentLocally(message: string): { intent: string; confidence: number } {
  const lowerMessage = message.toLowerCase()
  
  // Help-related keywords (Korean + English)
  const helpKeywords = [
    '사용법', '도움말', '도움', '설명', '가이드', '방법', '어떻게', '사용', '기능',
    'help', 'guide', 'how', 'usage', 'instruction', 'explain', 'what', 'function'
  ]
  
  // System engineering keywords (Korean + English)
  const systemKeywords = [
    '서버', '배포', '도커', '쿠버네티스', '리눅스', '네트워크', '인프라', '클라우드', 'aws', 'gcp',
    'server', 'deploy', 'docker', 'kubernetes', 'linux', 'network', 'infrastructure', 'cloud',
    'nginx', 'apache', 'database', 'mysql', 'postgres', 'redis', 'mongodb'
  ]
  
  // Check for help intent
  const helpMatches = helpKeywords.filter(keyword => lowerMessage.includes(keyword))
  if (helpMatches.length > 0) {
    const confidence = Math.min(0.8 + (helpMatches.length * 0.1), 0.95)
    return { intent: 'help', confidence }
  }
  
  // Check for system engineering intent
  const systemMatches = systemKeywords.filter(keyword => lowerMessage.includes(keyword))
  if (systemMatches.length > 0) {
    const confidence = Math.min(0.7 + (systemMatches.length * 0.1), 0.9)
    return { intent: 'system_engineering', confidence }
  }
  
  // Default to general
  return { intent: 'general', confidence: 0.6 }
}

export async function intentClassifierNode(
  state: ChatState,
  config: { apiKey: string; model?: string; useLocalClassification?: boolean }
): Promise<NodeResponse> {
  console.log('=== Intent Classifier Node ===')
  console.log('Analyzing user message:', state.lastUserMessage)

  // Use local classification if API key is dummy or useLocalClassification is true
  const shouldUseLocal = config.apiKey === 'dummy' || config.useLocalClassification
  
  if (shouldUseLocal) {
    console.log('Using local keyword-based classification')
    const result = classifyIntentLocally(state.lastUserMessage)
    console.log('Local intent classification result:', result)
    
    return {
      intent: result.intent as 'general' | 'system_engineering' | 'help',
      confidence: result.confidence,
    }
  }

  // Use OpenAI-based classification
  console.log('Using OpenAI-based classification')
  const llm = new ChatOpenAI({
    openAIApiKey: config.apiKey,
    modelName: config.model || 'gpt-3.5-turbo',
    temperature: 0.1, // Low temperature for consistent classification
  })

  try {
    const prompt = INTENT_CLASSIFICATION_PROMPT.replace(
      '{userMessage}',
      state.lastUserMessage
    )

    const response = await llm.invoke([
      new SystemMessage('You are an intent classifier.'),
      new HumanMessage(prompt),
    ])

    // Parse the JSON response
    const content = response.content.toString()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      throw new Error('Failed to parse intent classification response')
    }

    const result: IntentClassificationResult = JSON.parse(jsonMatch[0])
    
    console.log('Intent classification result:', result)

    return {
      intent: result.intent as 'general' | 'system_engineering' | 'help',
      confidence: result.confidence,
    }
  } catch (error) {
    console.error('Intent classification error:', error)
    // Fallback to local classification
    console.log('Falling back to local classification due to error')
    const result = classifyIntentLocally(state.lastUserMessage)
    console.log('Fallback local classification result:', result)
    
    return {
      intent: result.intent as 'general' | 'system_engineering' | 'help',
      confidence: result.confidence,
    }
  }
}