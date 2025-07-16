import { ChatState, NodeResponse } from '../types'

export async function generalChatNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== General Chat Node ===')
  console.log('Processing as general conversation')
  console.log(`Detected language: ${state.detectedLanguage}`)

  // SSH 컨텍스트 확인 및 활용
  const hasActiveSSHConnection = state.sshConnection && state.sshConnection.isActive
  let sshContextInfo = ''
  
  if (hasActiveSSHConnection) {
    console.log(`🔗 [SSH_CONTEXT] Active SSH connection detected in general chat: ${state.sshConnection!.host}`)
    
    // SSH 연결 정보와 이전 도구 실행 결과 활용
    const sshInfo = state.sshConnection!
    sshContextInfo = `\n\n**SSH 서버 컨텍스트**: 현재 ${sshInfo.host}:${sshInfo.port} 서버에 ${sshInfo.username} 계정으로 연결되어 있습니다.`
    
    // 이전 도구 실행 결과가 있으면 활용
    if (state.toolExecutionResults && state.toolExecutionResults.length > 0) {
      const lastToolResult = state.toolExecutionResults[state.toolExecutionResults.length - 1]
      if (lastToolResult.success && lastToolResult.result) {
        sshContextInfo += `\n\n**최근 수집된 서버 정보**: 이전 요청에서 다음 서버 정보를 수집했습니다:\n${JSON.stringify(lastToolResult.result, null, 2)}`
        console.log(`🔗 [SSH_CONTEXT] Using previous tool execution results for context`)
      }
    }
    
    // SSH 컨텍스트에서 시스템 관련 질문에 대한 특별 지침
    const systemKeywords = ['운영체제', '호스트네임', 'hostname', '서버', 'os', '시스템', 'memory', 'cpu']
    const hasSystemKeyword = systemKeywords.some(keyword => 
      state.lastUserMessage.toLowerCase().includes(keyword.toLowerCase())
    )
    
    if (hasSystemKeyword) {
      sshContextInfo += `\n\n**중요**: 사용자의 질문이 시스템 정보와 관련되어 있습니다. 가능하면 수집된 서버 정보를 활용하여 구체적으로 답변하세요. 정보가 부족하면 추가 정보가 필요하다고 안내하세요.`
      console.log(`🔗 [SSH_CONTEXT] System-related question detected in SSH context`)
    }
  }

  // Create language-aware system prompt for general chat
  const isKorean = state.detectedLanguage === 'ko'
  const languageInstruction = isKorean 
    ? '\n\n**중요한 언어 지침**: 사용자가 한글로 질문했으므로 반드시 한글로 답변해주세요. 자연스럽고 친근한 한국어를 사용하세요.'
    : '\n\n**IMPORTANT LANGUAGE INSTRUCTION**: The user asked in English, so please respond in English. Use natural and friendly English.'

  const systemPrompt = `You are a helpful and friendly AI assistant. Provide informative, engaging responses to user questions and conversations.${sshContextInfo}${languageInstruction}`

  return {
    systemPrompt,
  }
}