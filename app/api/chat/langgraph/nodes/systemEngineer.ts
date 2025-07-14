import { ChatState, NodeResponse } from '../types'
import { SYSTEM_ENGINEER_PROMPT } from '../prompts/intentClassification'

export async function systemEngineerNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== System Engineer Node ===')
  console.log('Processing with system engineering expertise')

  // Set the system prompt for system engineering context
  const systemPrompt = SYSTEM_ENGINEER_PROMPT.replace(
    '{userMessage}',
    state.lastUserMessage
  )

  return {
    systemPrompt,
  }
}