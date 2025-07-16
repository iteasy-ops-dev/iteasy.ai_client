import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatState, IntentClassificationResult, NodeResponse } from '../types'
import { INTENT_CLASSIFICATION_PROMPT } from '../prompts/intentClassification'

// Enhanced local keyword-based intent classification with improved scoring
function classifyIntentLocally(message: string, sshConnection?: import('../types').SSHConnectionInfo): { intent: string; confidence: number; language: 'ko' | 'en' } {
  const lowerMessage = message.toLowerCase()
  const isKorean = /[가-힣]/.test(message)
  const language = isKorean ? 'ko' : 'en'
  
  // SSH 컨텍스트 확인
  const hasActiveSSHConnection = sshConnection && sshConnection.isActive
  console.log(`🔗 [SSH_CONTEXT] Active SSH connection: ${hasActiveSSHConnection ? sshConnection.host : 'none'}`)
  
  // Guide-related patterns and keywords (Korean + English) - Enhanced  
  const guidePatterns = [
    // Direct guide requests (weighted higher)
    { pattern: /어떻게\s*(사용|쓰|하|써)/g, weight: 2.0 },
    { pattern: /사용법|사용방법|이용방법/g, weight: 2.0 },
    { pattern: /도움말|헬프|help|guide/g, weight: 2.0 },
    { pattern: /설명해|알려줘|가르쳐/g, weight: 1.8 },
    { pattern: /기능.*뭐|무슨.*기능/g, weight: 1.8 },
    { pattern: /what.*can.*do|how.*to.*use/g, weight: 2.0 },
    
    // Question patterns for guidance
    { pattern: /뭐.*할\s*수\s*있/g, weight: 1.5 },
    { pattern: /어떤.*기능/g, weight: 1.5 },
    { pattern: /사용.*방법|방법.*사용/g, weight: 1.8 },
    { pattern: /시작.*어떻게|어떻게.*시작/g, weight: 1.8 },
    { pattern: /tutorial|튜토리얼|안내/g, weight: 1.8 },
    { pattern: /처음.*써|처음.*사용/g, weight: 1.8 }
  ]
  
  // System engineering patterns and keywords (Korean + English) - Enhanced with weights
  const systemPatterns = [
    // Server operations (high weight)
    { pattern: /서버.*접속|접속.*서버/g, weight: 2.5 },
    { pattern: /서버.*상태|상태.*확인/g, weight: 2.0 },
    { pattern: /시스템.*정보|시스템.*사용량/g, weight: 2.0 },
    { pattern: /업타임|uptime|가동시간/g, weight: 1.8 },
    { pattern: /메모리.*사용|cpu.*사용|디스크.*사용/g, weight: 2.0 },
    
    // Connection info patterns (very high weight)
    { pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, weight: 3.0 }, // IP addresses
    { pattern: /port.*\d+|포트.*\d+/g, weight: 2.5 },
    { pattern: /password.*:|비밀번호.*:/g, weight: 2.5 },
    { pattern: /user.*:|유저.*:|사용자.*:/g, weight: 2.0 },
    
    // Infrastructure keywords (medium-high weight)
    { pattern: /docker|kubernetes|k8s|nginx|apache/g, weight: 2.2 },
    { pattern: /aws|gcp|azure|cloud|클라우드/g, weight: 2.0 },
    { pattern: /database|mysql|postgres|redis|mongodb/g, weight: 2.0 },
    { pattern: /linux|ubuntu|centos|debian/g, weight: 1.8 },
    { pattern: /배포|deploy|인프라|infrastructure/g, weight: 2.0 },
    
    // System commands and operations
    { pattern: /ssh|연결|접속|connection/g, weight: 2.2 },
    { pattern: /로그|log|모니터링|monitoring/g, weight: 1.8 },
    { pattern: /네트워크|network|방화벽|firewall/g, weight: 1.8 },
    { pattern: /백업|backup|복구|restore/g, weight: 1.8 }
  ]
  
  // Technical conversation patterns with weights
  const technicalPatterns = [
    { pattern: /어떻게.*설치|설치.*방법/g, weight: 1.8 },
    { pattern: /설정.*방법|설정.*어떻게/g, weight: 1.8 },
    { pattern: /문제.*해결|오류.*해결/g, weight: 1.8 },
    { pattern: /성능.*개선|최적화/g, weight: 1.6 },
    { pattern: /config|configuration|구성/g, weight: 1.6 },
    { pattern: /troubleshoot|문제.*진단/g, weight: 1.8 }
  ]
  
  let guideScore = 0
  let systemScore = 0
  let technicalScore = 0
  
  // Calculate guide intent score with weighted patterns
  guidePatterns.forEach(({ pattern, weight }) => {
    const matches = (lowerMessage.match(pattern) || []).length
    guideScore += matches * weight
  })
  
  // Calculate system engineering score with weighted patterns
  systemPatterns.forEach(({ pattern, weight }) => {
    const matches = (lowerMessage.match(pattern) || []).length
    systemScore += matches * weight
  })
  
  // Calculate technical conversation score with weighted patterns
  technicalPatterns.forEach(({ pattern, weight }) => {
    const matches = (lowerMessage.match(pattern) || []).length
    technicalScore += matches * weight
  })
  
  // Enhanced context analysis
  if (message.includes('서버:') || message.includes('host:') || message.includes('IP:')) {
    systemScore += 3.0 // Very strong indicator
  }
  
  // SSH 컨텍스트 기반 가중치 (매우 중요!)
  if (hasActiveSSHConnection) {
    console.log(`🔗 [SSH_CONTEXT] Active SSH connection detected - boosting system engineering intent`)
    
    // SSH 연결이 활성화된 상태에서 시스템 관련 질문은 강하게 system_engineering으로 분류
    const systemKeywords = [
      '운영체제', '호스트네임', 'hostname', '서버', 'server', '시스템', 'system', 
      '메모리', 'memory', 'cpu', '디스크', 'disk', '프로세스', 'process',
      '네트워크', 'network', '포트', 'port', '로그', 'log', '상태', 'status',
      '업타임', 'uptime', '가동시간', 'os', '리눅스', 'linux', '우분투', 'ubuntu'
    ]
    
    const hasSystemKeyword = systemKeywords.some(keyword => 
      lowerMessage.includes(keyword.toLowerCase())
    )
    
    if (hasSystemKeyword) {
      systemScore += 4.0 // SSH 컨텍스트에서 시스템 키워드 = 강력한 system_engineering 신호
      console.log(`🔗 [SSH_CONTEXT] System keyword found in SSH context - strong system_engineering signal`)
    } else {
      // SSH 컨텍스트에서 일반 질문도 시스템 관련일 가능성이 높음
      systemScore += 2.0
      console.log(`🔗 [SSH_CONTEXT] Question in SSH context - likely system_engineering`)
    }
  }
  
  // Question mark analysis
  if (message.includes('?') || message.includes('？')) {
    if (systemScore > 1.0) systemScore += 0.8
    else if (guideScore > 0) guideScore += 1.0
    else guideScore += 0.8 // Default to guide for questions
  }
  
  // Enhanced Korean technical terms
  const koreanTechTerms = ['서버', '시스템', '네트워크', '데이터베이스', '배포', '인프라', '클라우드', '접속', '연결']
  const koreanTechMatches = koreanTechTerms.filter(term => lowerMessage.includes(term)).length
  if (koreanTechMatches > 0) {
    systemScore += koreanTechMatches * 1.2
  }
  
  // Language-specific boosting
  if (language === 'ko') {
    // Korean users tend to ask more direct questions
    if (guideScore > 0) guideScore *= 1.1
    if (systemScore > 0) systemScore *= 1.1
  }
  
  // Determine intent based on enhanced scoring
  console.log(`🔍 [INTENT_SCORING] Guide: ${guideScore.toFixed(2)}, System: ${systemScore.toFixed(2)}, Technical: ${technicalScore.toFixed(2)}, Language: ${language}`)
  
  // Enhanced confidence calculation
  const totalScore = guideScore + systemScore + technicalScore
  
  if (guideScore > systemScore && guideScore > technicalScore && guideScore > 1.0) {
    const confidence = Math.min(0.75 + (guideScore / totalScore * 0.2), 0.92)
    return { intent: 'agentUsageGuide', confidence, language }
  }
  
  if (systemScore > guideScore && systemScore > 0.8) {
    const confidence = Math.min(0.75 + (systemScore / totalScore * 0.25), 0.95)
    return { intent: 'system_engineering', confidence, language }
  }
  
  if (technicalScore > 1.5) {
    const confidence = Math.min(0.65 + (technicalScore / totalScore * 0.2), 0.85)
    return { intent: 'system_engineering', confidence, language }
  }
  
  // More intelligent default classification
  if (totalScore < 0.5) {
    return { intent: 'general', confidence: 0.4, language }
  }
  
  // When uncertain, lean towards guide for questions
  if (message.includes('?') || message.includes('？')) {
    return { intent: 'agentUsageGuide', confidence: 0.6, language }
  }
  
  return { intent: 'general', confidence: 0.5, language }
}

export async function intentClassifierNode(
  state: ChatState,
  config: { apiKey: string; model?: string; useLocalClassification?: boolean }
): Promise<NodeResponse> {
  console.log('=== Intent Classifier Node ===')
  console.log('Analyzing user message:', state.lastUserMessage)

  // Use local classification if API key is dummy or useLocalClassification is true
  const shouldUseLocal = config.apiKey === 'dummy' || config.useLocalClassification
  
  if (shouldUseLocal) {
    console.log('Using local keyword-based classification')
    const result = classifyIntentLocally(state.lastUserMessage, state.sshConnection)
    console.log('Local intent classification result:', result)
    
    return {
      intent: result.intent as 'general' | 'system_engineering' | 'agentUsageGuide',
      confidence: result.confidence,
      detectedLanguage: result.language,
    }
  }

  // Use OpenAI-based classification
  console.log('Using OpenAI-based classification')
  const llm = new ChatOpenAI({
    openAIApiKey: config.apiKey,
    modelName: config.model || 'gpt-3.5-turbo',
    temperature: 0.1, // Low temperature for consistent classification
  })

  try {
    // SSH 컨텍스트 정보 추가
    const sshContext = state.sshConnection && state.sshConnection.isActive 
      ? `\n\nIMPORTANT: Active SSH connection context detected to server ${state.sshConnection.host}. Questions about system information, hostname, OS, memory, CPU, etc. should be classified as 'system_engineering' even if they seem general.`
      : ''
    
    const prompt = INTENT_CLASSIFICATION_PROMPT.replace(
      '{userMessage}',
      state.lastUserMessage
    ) + sshContext

    const response = await llm.invoke([
      new SystemMessage('You are an intent classifier.'),
      new HumanMessage(prompt),
    ])

    // Parse the JSON response
    const content = response.content.toString()
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    
    if (!jsonMatch) {
      throw new Error('Failed to parse intent classification response')
    }

    const result: IntentClassificationResult = JSON.parse(jsonMatch[0])
    
    console.log('Intent classification result:', result)

    // Detect language for OpenAI result as well
    const isKorean = /[가-힣]/.test(state.lastUserMessage)
    const detectedLanguage = isKorean ? 'ko' : 'en'

    return {
      intent: result.intent as 'general' | 'system_engineering' | 'agentUsageGuide',
      confidence: result.confidence,
      detectedLanguage: detectedLanguage as 'ko' | 'en',
    }
  } catch (error) {
    console.error('Intent classification error:', error)
    // Fallback to local classification with SSH context
    console.log('Falling back to local classification due to error')
    const result = classifyIntentLocally(state.lastUserMessage, state.sshConnection)
    console.log('Fallback local classification result:', result)
    
    return {
      intent: result.intent as 'general' | 'system_engineering' | 'agentUsageGuide',
      confidence: result.confidence,
      detectedLanguage: result.language,
    }
  }
}