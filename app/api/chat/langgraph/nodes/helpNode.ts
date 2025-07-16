import { ChatState, NodeResponse } from '../types'
import { GUIDE_PROMPT } from '../prompts/intentClassification'

export async function agentUsageGuideNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== Agent Usage Guide Node ===')
  console.log('Providing agent usage guidance and information')

  // Set the guide prompt for providing guidance on using the AI agent
  const systemPrompt = GUIDE_PROMPT.replace(
    '{userMessage}',
    state.lastUserMessage
  )

  return {
    systemPrompt,
  }
}