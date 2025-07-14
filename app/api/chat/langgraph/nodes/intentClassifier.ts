import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatState, IntentClassificationResult, NodeResponse } from '../types'
import { INTENT_CLASSIFICATION_PROMPT } from '../prompts/intentClassification'

export async function intentClassifierNode(
  state: ChatState,
  config: { apiKey: string; model?: string }
): Promise<NodeResponse> {
  console.log('=== Intent Classifier Node ===')
  console.log('Analyzing user message:', state.lastUserMessage)

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
      intent: result.intent,
      confidence: result.confidence,
    }
  } catch (error) {
    console.error('Intent classification error:', error)
    // Default to general chat on error
    return {
      intent: 'general',
      confidence: 0.5,
    }
  }
}