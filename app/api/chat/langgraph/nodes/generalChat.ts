import { ChatState, NodeResponse } from '../types'

export async function generalChatNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== General Chat Node ===')
  console.log('Processing as general conversation')

  // For general chat, we don't need to modify the system prompt
  // The response will be handled by the existing streamText in route.ts
  return {
    systemPrompt: undefined, // Use default behavior
  }
}