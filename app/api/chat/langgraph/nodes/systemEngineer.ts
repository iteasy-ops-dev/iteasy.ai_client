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

  // Language-aware formatting
  const isKorean = state.detectedLanguage === 'ko'
  const languageInstruction = isKorean 
    ? '\n\n**중요한 언어 지침**: 사용자가 한글로 질문했으므로 반드시 한글로 답변해주세요. 기술적인 내용도 한국어로 설명하되, 필요시 영어 용어를 병기할 수 있습니다.'
    : '\n\n**IMPORTANT LANGUAGE INSTRUCTION**: The user asked in English, so please respond in English. Provide technical explanations in English.'

  // ReAct 패턴 사용 여부에 따른 처리
  if (state.useReact && state.complexityLevel !== 'simple') {
    console.log('🚀 Applying ReAct pattern for complex system engineering question')
    
    const toolContext = formatToolResults()
    
    // Get language-specific response format
    const responseFormat = isKorean ? `
## 복잡한 기술 질문 응답 형식:
**분석**: 실행된 도구 결과를 기반으로 현재 상태 분석
**해석**: 구체적인 수치와 메트릭 해석
**평가**: 실제 데이터를 바탕으로 한 시스템 상태 평가
**권장사항**: 실제 발견사항을 기반으로 한 구체적 개선방안
**다음 단계**: 지속적인 모니터링 및 후속 조치` : `
## Response Format for Complex Questions:
**ANALYSIS**: Analyze the ACTUAL data from tool results (not theoretical scenarios)
**INTERPRETATION**: Interpret the specific values and metrics from the executed commands
**ASSESSMENT**: Assess the current state based on real data
**RECOMMENDATIONS**: Provide specific recommendations based on the actual findings
**NEXT STEPS**: Continuous monitoring and follow-up actions`
    
    // ReAct 패턴을 위한 향상된 시스템 프롬프트
    const reactSystemPrompt = `You are an expert System Engineer using ReAct (Reasoning + Acting) methodology.

${toolContext}

🚨 **MANDATORY INSTRUCTION**: You MUST base your entire analysis on the ACTUAL tool execution results shown above. DO NOT provide generic advice when real data is available.

For complex technical questions, follow this approach:
1. **ANALYSIS**: Analyze the ACTUAL data from tool results (not theoretical scenarios)
2. **INTERPRETATION**: Interpret the specific values and metrics from the executed commands
3. **ASSESSMENT**: Assess the current state based on real data
4. **RECOMMENDATIONS**: Provide specific recommendations based on the actual findings

## Your Expertise Areas:
- Linux/Unix and Windows system administration
- Network architecture and protocols (TCP/IP, DNS, HTTP/HTTPS, etc.)
- Cloud infrastructure (AWS, GCP, Azure)
- Container technologies (Docker, Kubernetes)
- CI/CD pipelines (Jenkins, GitLab CI, GitHub Actions)
- Monitoring and logging systems (Prometheus, Grafana, ELK stack)
- Security best practices and compliance
- Infrastructure as Code (Terraform, Ansible, CloudFormation)
- Database administration (MySQL, PostgreSQL, MongoDB, Redis)
- Performance optimization and troubleshooting

${responseFormat}

${languageInstruction}

User's question: ${state.lastUserMessage}`

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
      const taskInstruction = isKorean ? `
🎯 **필수 작업**: 
- 위의 실제 도구 실행 결과만을 사용하여 답변하세요
- 실행된 명령의 정확한 값과 출력을 인용하세요
- 일반적인 안내나 SSH 튜토리얼을 제공하지 마세요
- 사용자가 uptime을 요청했고 결과에 있다면 정확한 uptime을 제공하세요
- uptime이 결과에 없다면 명시적으로 그렇게 말하세요` : `
🎯 **YOUR MANDATORY TASK**: 
- Answer ONLY using the actual tool execution results above
- Quote exact values and outputs from the executed commands
- DO NOT provide general guidance or SSH tutorials
- If the user asked for uptime and it's in the results, give the exact uptime
- If uptime is missing from results, state that explicitly`

      enhancedPrompt = `${SYSTEM_ENGINEER_PROMPT}${languageInstruction}\n\n${toolContext}\n\n**USER QUESTION**: ${state.lastUserMessage}\n\n${taskInstruction}`
    }

    return {
      systemPrompt: enhancedPrompt,
    }
  }
}