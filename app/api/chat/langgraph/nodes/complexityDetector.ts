import { ChatState, NodeResponse, ComplexityDetectionResult } from '../types'

/**
 * Complexity Detection Node
 * 사용자 질문의 복잡도를 판단하여 ReAct 패턴 적용 여부를 결정
 */
export async function complexityDetectorNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== Complexity Detector Node ===')
  console.log('🔍 Analyzing message complexity:', state.lastUserMessage)
  console.log('📊 Intent context:', { intent: state.intent, confidence: state.confidence })

  const complexity = detectComplexity(state.lastUserMessage, state.intent)
  
  console.log('✅ Complexity detection result:', {
    level: complexity.level,
    useReact: complexity.useReact,
    reasoning: complexity.reasoning,
    confidence: complexity.confidence
  })

  return {
    complexityLevel: complexity.level,
    useReact: complexity.useReact,
    reasoningChain: complexity.useReact ? [{
      step: 0,
      thought: `Complexity analysis: ${complexity.reasoning}`,
      timestamp: new Date()
    }] : undefined,
    currentStep: complexity.useReact ? 0 : undefined
  }
}

/**
 * 메시지 복잡도 감지 함수
 */
function detectComplexity(
  message: string, 
  intent: 'general' | 'system_engineering' | 'agentUsageGuide' | null
): ComplexityDetectionResult {
  const lowerMessage = message.toLowerCase()
  
  // 일반 대화나 가이드는 항상 simple
  if (intent === 'general' || intent === 'agentUsageGuide') {
    return {
      level: 'simple',
      reasoning: `${intent} intent detected - using direct response`,
      confidence: 0.9,
      useReact: false
    }
  }

  // System Engineering 질문에 대한 복잡도 분석
  if (intent === 'system_engineering') {
    const complexityIndicators = {
      // Multi-step indicators (가장 복잡)
      multiStep: [
        'how to setup', 'how to configure', 'step by step', 'deployment guide',
        'architecture design', 'implementation strategy', 'migration plan',
        'best practices for', 'optimization strategy', 'troubleshooting guide',
        '설정 방법', '구축 방법', '배포 가이드', '아키텍처 설계', '마이그레이션',
        '최적화 방안', '문제 해결 방법', '구현 전략'
      ],
      
      // Complex indicators (중간 복잡도)
      complex: [
        'performance tuning', 'security configuration', 'load balancing',
        'monitoring setup', 'backup strategy', 'scaling solution',
        'integration with', 'comparison between', 'pros and cons',
        'performance optimization', 'cost optimization',
        '성능 튜닝', '보안 설정', '로드 밸런싱', '모니터링 구축',
        '백업 전략', '스케일링', '통합 방안', '비교 분석', '최적화'
      ],
      
      // Simple indicators (단순한 질문)
      simple: [
        'what is', 'define', 'explain', 'difference between',
        'command for', 'syntax', 'example', 'quick question',
        '이란 무엇', '설명해', '차이점', '명령어', '문법', '예제',
        // Server status checks are generally simple operations
        '서버가 구동', '서버 구동', '서버 상태', '서버가 작동',
        'server running', 'server status', 'server up', 'server alive',
        '확인', 'check', '체크', 'ping', '연결'
      ]
    }

    // Multi-step detection
    const multiStepMatches = complexityIndicators.multiStep.filter(
      indicator => lowerMessage.includes(indicator)
    )
    if (multiStepMatches.length > 0) {
      return {
        level: 'multi_step',
        reasoning: `Multi-step task detected. Keywords: ${multiStepMatches.join(', ')}`,
        confidence: 0.85,
        useReact: true
      }
    }

    // Complex detection
    const complexMatches = complexityIndicators.complex.filter(
      indicator => lowerMessage.includes(indicator)
    )
    if (complexMatches.length > 0) {
      return {
        level: 'complex',
        reasoning: `Complex technical question detected. Keywords: ${complexMatches.join(', ')}`,
        confidence: 0.8,
        useReact: true
      }
    }

    // Simple detection
    const simpleMatches = complexityIndicators.simple.filter(
      indicator => lowerMessage.includes(indicator)
    )
    if (simpleMatches.length > 0) {
      return {
        level: 'simple',
        reasoning: `Simple technical question detected. Keywords: ${simpleMatches.join(', ')}`,
        confidence: 0.85,
        useReact: false
      }
    }

    // 추가 휴리스틱 분석
    const messageLength = message.length
    const questionCount = (message.match(/\?/g) || []).length
    const hasMultipleTopics = (message.match(/\band\b|\bor\b|\,/g) || []).length > 2

    // 긴 메시지이면서 여러 질문이나 주제를 포함하는 경우
    if (messageLength > 200 && (questionCount > 1 || hasMultipleTopics)) {
      return {
        level: 'complex',
        reasoning: `Long message (${messageLength} chars) with multiple questions/topics`,
        confidence: 0.7,
        useReact: true
      }
    }

    // 기본적으로 system_engineering은 complex로 처리
    return {
      level: 'complex',
      reasoning: 'System engineering question without specific complexity indicators - defaulting to complex',
      confidence: 0.6,
      useReact: true
    }
  }

  // 기본값
  return {
    level: 'simple',
    reasoning: 'No specific complexity indicators found',
    confidence: 0.5,
    useReact: false
  }
}