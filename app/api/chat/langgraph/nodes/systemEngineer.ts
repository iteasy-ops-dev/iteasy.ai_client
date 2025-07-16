import { ChatState, NodeResponse } from '../types'
import { SYSTEM_ENGINEER_PROMPT } from '../prompts/intentClassification'

export async function systemEngineerNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== System Engineer Node ===')
  console.log('🔧 Processing with system engineering expertise')
  console.log(`📊 Complexity Level: ${state.complexityLevel}`)
  console.log(`🧠 Use ReAct: ${state.useReact}`)
  console.log(`🛠️ Tools executed: ${state.selectedTools?.length || 0}`)
  console.log(`🌐 Detected language: ${state.detectedLanguage}`)

  // Format tool execution results for context
  const formatToolResults = (): string => {
    if (!state.toolExecutionResults || state.toolExecutionResults.length === 0) {
      return ''
    }

    let toolContext = '\n\n## TOOL EXECUTION RESULTS:\n'
    
    state.toolExecutionResults.forEach((result, index) => {
      const toolId = state.selectedTools?.[index] || `tool_${index}`
      
      if (result.success) {
        toolContext += `\n### ${toolId.toUpperCase()} - SUCCESS (${result.executionTime}ms)\n`
        toolContext += `**ACTUAL EXECUTION RESULT:**\n`
        
        if (typeof result.result === 'object') {
          toolContext += '```json\n' + JSON.stringify(result.result, null, 2) + '\n```\n'
        } else {
          toolContext += '```\n' + result.result + '\n```\n'
        }
      } else {
        toolContext += `\n### ${toolId.toUpperCase()} - FAILED\n`
        toolContext += `Error: ${result.error}\n`
      }
    })
    
    toolContext += '\n🚨 **CRITICAL INSTRUCTION - READ CAREFULLY** 🚨\n\nYou MUST follow these rules EXACTLY:\n1. ✅ USE ONLY the actual tool execution results shown above\n2. ❌ DO NOT provide generic SSH instructions or general guidance\n3. ✅ Quote specific data from the tool outputs (exact system info, uptime values, etc.)\n4. ❌ DO NOT say "you can use uptime command" - the command was already executed\n5. ✅ If uptime is shown in results, report the exact uptime value\n6. ❌ If uptime is NOT in results, state that clearly\n\n**VIOLATION OF THESE RULES IS NOT ACCEPTABLE**\n\nExample good response: "The server uptime is 15 days, 3 hours based on the executed uptime command"\nExample bad response: "To check uptime, you can use the uptime command"\n'
    
    return toolContext
  }

  // 한글 강제 설정 (ITEasy 한국 팀용)
  const languageInstruction = '\n\n**🇰🇷 필수 언어 지침 🇰🇷**: ITEasy 팀을 위한 서비스이므로 모든 답변을 반드시 한국어로 작성해주세요. 영어로 질문이 들어와도 한국어로 답변하세요. 기술 용어는 한국어로 설명하되 필요시 영어 용어를 괄호 안에 병기할 수 있습니다. 예: "메모리 사용량(memory usage)", "중앙처리장치(CPU)"'

  // ReAct 패턴 사용 여부에 따른 처리
  if (state.useReact && state.complexityLevel !== 'simple') {
    console.log('🚀 Applying ReAct pattern for complex system engineering question')
    
    const toolContext = formatToolResults()
    
    // 한국어 전용 응답 형식
    const responseFormat = `
## 복잡한 기술 질문 응답 형식:
**분석**: 실행된 도구 결과를 기반으로 현재 상태 분석
**해석**: 구체적인 수치와 메트릭 해석
**평가**: 실제 데이터를 바탕으로 한 시스템 상태 평가
**권장사항**: 실제 발견사항을 기반으로 한 구체적 개선방안
**다음 단계**: 지속적인 모니터링 및 후속 조치`
    
    // ReAct 패턴을 위한 향상된 시스템 프롬프트 (한국어 전용)
    const reactSystemPrompt = `당신은 ReAct (추론 + 행동) 방법론을 사용하는 전문 시스템 엔지니어입니다.

${toolContext}

🚨 **필수 지침**: 위에 표시된 실제 도구 실행 결과만을 기반으로 전체 분석을 수행해야 합니다. 실제 데이터가 있을 때는 일반적인 조언을 제공하지 마세요.

복잡한 기술 질문의 경우 다음 접근 방식을 따르세요:
1. **분석**: 도구 결과의 실제 데이터 분석 (이론적 시나리오가 아닌)
2. **해석**: 실행된 명령어의 구체적인 값과 메트릭 해석
3. **평가**: 실제 데이터를 기반으로 한 현재 상태 평가
4. **권장사항**: 실제 발견사항을 기반으로 한 구체적 권장사항

## 전문 분야:
- Linux/Unix 및 Windows 시스템 관리
- 네트워크 아키텍처 및 프로토콜 (TCP/IP, DNS, HTTP/HTTPS 등)
- 클라우드 인프라 (AWS, GCP, Azure)
- 컨테이너 기술 (Docker, Kubernetes)
- CI/CD 파이프라인 (Jenkins, GitLab CI, GitHub Actions)
- 모니터링 및 로깅 시스템 (Prometheus, Grafana, ELK 스택)
- 보안 모범 사례 및 컴플라이언스
- 코드형 인프라 (Terraform, Ansible, CloudFormation)
- 데이터베이스 관리 (MySQL, PostgreSQL, MongoDB, Redis)
- 성능 최적화 및 문제 해결

${responseFormat}

${languageInstruction}

사용자 질문: ${state.lastUserMessage}`

    return {
      systemPrompt: reactSystemPrompt,
      reasoningChain: [
        ...(state.reasoningChain || []),
        {
          step: (state.currentStep || 0) + 1,
          thought: `Applying ReAct methodology for ${state.complexityLevel} system engineering question with ${state.selectedTools?.length || 0} tool results`,
          timestamp: new Date()
        }
      ],
      currentStep: (state.currentStep || 0) + 1
    }
  } else {
    console.log('⚡ Using simple response for straightforward system engineering question')
    
    const toolContext = formatToolResults()
    
    // 간단한 질문에 대한 기본 시스템 프롬프트에 도구 결과 통합
    let enhancedPrompt = SYSTEM_ENGINEER_PROMPT.replace(
      '{userMessage}',
      state.lastUserMessage
    )

    // Add language instruction to the basic prompt as well
    enhancedPrompt += languageInstruction

    if (toolContext) {
      const taskInstruction = `
🎯 **필수 작업**: 
- 위의 실제 도구 실행 결과만을 사용하여 답변하세요
- 실행된 명령의 정확한 값과 출력을 인용하세요
- 일반적인 안내나 SSH 튜토리얼을 제공하지 마세요
- 사용자가 uptime을 요청했고 결과에 있다면 정확한 uptime을 제공하세요
- uptime이 결과에 없다면 명시적으로 그렇게 말하세요`

      enhancedPrompt = `${SYSTEM_ENGINEER_PROMPT}${languageInstruction}\n\n${toolContext}\n\n**사용자 질문**: ${state.lastUserMessage}\n\n${taskInstruction}`
    }

    return {
      systemPrompt: enhancedPrompt,
    }
  }
}