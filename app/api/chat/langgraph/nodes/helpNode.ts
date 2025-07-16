import { ChatState, NodeResponse } from '../types'
import { HELP_PROMPT } from '../prompts/intentClassification'

export async function agentUsageGuideNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== Agent Usage Guide Node ===')
  console.log('Providing agent usage guidance and help information')

  // Set the help prompt for providing guidance on using the AI agent
  const systemPrompt = HELP_PROMPT.replace(
    '{userMessage}',
    state.lastUserMessage
  )

  return {
    systemPrompt,
  }
}