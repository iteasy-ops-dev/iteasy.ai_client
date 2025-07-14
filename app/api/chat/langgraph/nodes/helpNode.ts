import { ChatState, NodeResponse } from '../types'
import { HELP_PROMPT } from '../prompts/intentClassification'

export async function helpNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== Help Node ===')
  console.log('Providing usage guidance and help information')

  // Set the help prompt for providing guidance on using the AI agent
  const systemPrompt = HELP_PROMPT.replace(
    '{userMessage}',
    state.lastUserMessage
  )

  return {
    systemPrompt,
  }
}