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

  // ITEasy 한국 팀을 위한 한글 전용 설정
  const languageInstruction = '\n\n**🇰🇷 필수 언어 지침 🇰🇷**: ITEasy 팀을 위한 서비스이므로 모든 답변을 반드시 한국어로 작성해주세요. 영어로 질문이 들어와도 한국어로 답변하세요. 자연스럽고 친근한 한국어를 사용하며, 기술 용어는 한국어로 설명하되 필요시 영어 용어를 괄호 안에 병기할 수 있습니다.'

  const systemPrompt = `당신은 도움이 되고 친근한 AI 어시스턴트입니다. 사용자 질문과 대화에 유익하고 흥미로운 한국어 응답을 제공하세요.${sshContextInfo}${languageInstruction}`

  return {
    systemPrompt,
  }
}