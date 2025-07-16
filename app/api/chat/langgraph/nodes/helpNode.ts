import { ChatState, NodeResponse } from '../types'
import { GUIDE_PROMPT } from '../prompts/intentClassification'

export async function agentUsageGuideNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== Agent Usage Guide Node ===')
  console.log('Providing agent usage guidance and information')

  // ITEasy 한국 팀을 위한 한글 전용 설정
  const languageInstruction = '\n\n**🇰🇷 필수 언어 지침 🇰🇷**: ITEasy 팀을 위한 서비스이므로 모든 답변을 반드시 한국어로 작성해주세요. 영어로 질문이 들어와도 한국어로 답변하세요. 친근하고 이해하기 쉬운 한국어로 가이드를 제공하세요.'

  // Set the guide prompt for providing guidance on using the AI agent
  let systemPrompt = GUIDE_PROMPT.replace(
    '{userMessage}',
    state.lastUserMessage
  )

  // Add Korean language instruction
  systemPrompt += languageInstruction

  return {
    systemPrompt,
  }
}