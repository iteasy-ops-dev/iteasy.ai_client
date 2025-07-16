import { ChatState, NodeResponse } from '../types'

export async function generalChatNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== General Chat Node ===')
  console.log('Processing as general conversation')
  console.log(`Detected language: ${state.detectedLanguage}`)

  // Create language-aware system prompt for general chat
  const isKorean = state.detectedLanguage === 'ko'
  const languageInstruction = isKorean 
    ? '\n\n**중요한 언어 지침**: 사용자가 한글로 질문했으므로 반드시 한글로 답변해주세요. 자연스럽고 친근한 한국어를 사용하세요.'
    : '\n\n**IMPORTANT LANGUAGE INSTRUCTION**: The user asked in English, so please respond in English. Use natural and friendly English.'

  const systemPrompt = `You are a helpful and friendly AI assistant. Provide informative, engaging responses to user questions and conversations.${languageInstruction}`

  return {
    systemPrompt,
  }
}