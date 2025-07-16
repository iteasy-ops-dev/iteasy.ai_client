import { ChatState, NodeResponse } from '../types'
import { SYSTEM_ENGINEER_PROMPT } from '../prompts/intentClassification'

export async function systemEngineerNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== System Engineer Node ===')
  console.log('🔧 Processing with system engineering expertise')
  console.log(`📊 Complexity Level: ${state.complexityLevel}`)
  console.log(`🧠 Use ReAct: ${state.useReact}`)

  // ReAct 패턴 사용 여부에 따른 처리
  if (state.useReact && state.complexityLevel !== 'simple') {
    console.log('🚀 Applying ReAct pattern for complex system engineering question')
    
    // ReAct 패턴을 위한 향상된 시스템 프롬프트
    const reactSystemPrompt = `You are an expert System Engineer using ReAct (Reasoning + Acting) methodology.

For complex technical questions, follow this approach:
1. **THINK**: Analyze the question and break it down into components
2. **PLAN**: Outline the steps needed to provide a comprehensive answer
3. **REASON**: Explain your reasoning for each recommendation
4. **ACT**: Provide specific, actionable solutions with examples

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

## Response Format for Complex Questions:
**ANALYSIS**: Break down the question and identify key components
**APPROACH**: Outline your methodology and reasoning
**SOLUTION**: Provide step-by-step implementation with code/commands
**CONSIDERATIONS**: Discuss security, performance, and best practices
**NEXT STEPS**: Suggest follow-up actions or monitoring

User's question: ${state.lastUserMessage}`

    return {
      systemPrompt: reactSystemPrompt,
      reasoningChain: [
        ...(state.reasoningChain || []),
        {
          step: (state.currentStep || 0) + 1,
          thought: `Applying ReAct methodology for ${state.complexityLevel} system engineering question`,
          timestamp: new Date()
        }
      ],
      currentStep: (state.currentStep || 0) + 1
    }
  } else {
    console.log('⚡ Using simple response for straightforward system engineering question')
    
    // 간단한 질문에 대한 기존 방식
    const systemPrompt = SYSTEM_ENGINEER_PROMPT.replace(
      '{userMessage}',
      state.lastUserMessage
    )

    return {
      systemPrompt,
    }
  }
}