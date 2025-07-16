import { ChatState, NodeResponse, ReActState, ReActStep, Evidence, Hypothesis, ToolResult, SystemTool } from '../types'
import { selectRelevantTools } from './toolExecution'
import { systemToolsRegistry } from '../tools/systemTools'

/**
 * Enhanced ReAct Engine Node
 * Think-Act-Observe 순환을 통한 진정한 ReAct 패턴 구현
 */
export async function reactEngineNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('=== Enhanced ReAct Engine Node ===')
  console.log('🔄 Starting ReAct iteration cycle')
  console.log(`📊 Question: ${state.lastUserMessage}`)
  
  // Initialize or continue ReAct state
  const reactState = initializeReActState(state)
  
  try {
    // Execute ReAct iteration cycle
    const result = await executeReActCycle(state, reactState)
    
    console.log(`✅ ReAct cycle completed. Iterations: ${result.reactState?.currentIteration || 0}`)
    console.log(`🎯 Final confidence: ${result.reactState?.confidence || 0}`)
    
    return result
  } catch (error) {
    console.error('❌ ReAct cycle failed:', error)
    return {
      response: '시스템 분석 중 오류가 발생했습니다. 다시 시도해주세요.',
      reactState: { ...reactState, completed: true }
    }
  }
}

/**
 * Initialize or restore ReAct state
 */
function initializeReActState(state: ChatState): ReActState {
  if (state.reactState) {
    console.log('🔄 Continuing existing ReAct state')
    return state.reactState
  }
  
  console.log('🆕 Initializing new ReAct state')
  return {
    currentIteration: 0,
    maxIterations: 5,
    completed: false,
    accumulatedEvidence: [],
    hypotheses: [],
    investigationPath: [],
    confidence: 0.0
  }
}

/**
 * Execute the main ReAct cycle: Think → Act → Observe
 */
async function executeReActCycle(
  state: ChatState,
  reactState: ReActState
): Promise<NodeResponse> {
  let currentState = { ...state, reactState }
  let needsContinuation = true
  
  while (needsContinuation && reactState.currentIteration < reactState.maxIterations) {
    console.log(`\n🔄 === ReAct Iteration ${reactState.currentIteration + 1} ===`)
    
    // THINK: Analyze current situation and plan next action
    const thought = await thinkStep(currentState)
    console.log(`💭 THINK: ${thought.analysis}`)
    
    // ACT: Select and execute appropriate tools
    const action = await actStep(currentState, thought)
    console.log(`⚡ ACT: Executing ${action.selectedTools.length} tools`)
    
    // OBSERVE: Analyze results and determine next steps
    const observation = await observeStep(action.results, thought, currentState)
    console.log(`👁️ OBSERVE: Confidence ${observation.confidence}, Continue: ${observation.needsContinuation}`)
    
    // Record this ReAct step
    const reactStep: ReActStep = {
      step: reactState.currentIteration + 1,
      thought: thought.analysis,
      action: action.toolCall,
      observation: observation.summary,
      timestamp: new Date(),
      needsContinuation: observation.needsContinuation,
      confidence: observation.confidence
    }
    
    // Update state
    reactState.currentIteration++
    reactState.accumulatedEvidence.push(...observation.evidence)
    reactState.hypotheses = updateHypotheses(reactState.hypotheses, observation.evidence)
    reactState.confidence = observation.confidence
    reactState.completed = !observation.needsContinuation
    
    currentState.reasoningChain = [...(currentState.reasoningChain || []), reactStep]
    currentState.reactState = reactState
    currentState.toolExecutionResults = action.results
    
    needsContinuation = observation.needsContinuation && observation.confidence < 0.9
    
    // Early termination if high confidence achieved
    if (observation.confidence >= 0.9) {
      console.log('🎯 High confidence achieved, terminating ReAct cycle')
      break
    }
  }
  
  // Generate final response
  const finalResponse = await generateFinalResponse(currentState)
  
  return {
    ...currentState,
    response: finalResponse,
    reactState: { ...reactState, completed: true, finalAnswer: finalResponse }
  }
}

/**
 * THINK: Analyze current situation and plan next action
 */
async function thinkStep(state: ChatState): Promise<{
  analysis: string
  nextAction: string
  reasoning: string
  confidence: number
}> {
  const { lastUserMessage, reactState, toolExecutionResults } = state
  
  // Analyze what we know so far
  const knownEvidence = reactState?.accumulatedEvidence || []
  const previousResults = toolExecutionResults || []
  
  let analysis = ''
  let nextAction = ''
  let reasoning = ''
  let confidence = 0.5
  
  if (reactState?.currentIteration === 0) {
    // First iteration - initial analysis
    analysis = `사용자가 "${lastUserMessage}"에 대해 질문했습니다. 이 문제를 해결하기 위해 체계적으로 접근해야 합니다.`
    nextAction = 'initial_investigation'
    reasoning = '초기 조사를 통해 현재 상황을 파악해야 합니다.'
    confidence = 0.3
  } else {
    // Subsequent iterations - analyze previous results
    if (previousResults.length > 0) {
      const successfulResults = previousResults.filter(r => r.success)
      const failedResults = previousResults.filter(r => !r.success)
      
      if (successfulResults.length > 0) {
        analysis = `이전 조사에서 ${successfulResults.length}개의 유용한 정보를 수집했습니다. `
        
        // Determine if we need more information
        const hasSystemInfo = successfulResults.some(r => 
          typeof r.result === 'object' && (r.result.hostname || r.result.uptime || r.result.os)
        )
        
        if (!hasSystemInfo) {
          nextAction = 'gather_system_info'
          reasoning = '기본 시스템 정보가 필요합니다.'
          confidence = 0.4
        } else {
          nextAction = 'analyze_specific_issue'
          reasoning = '수집된 정보를 바탕으로 구체적인 문제를 분석해야 합니다.'
          confidence = 0.7
        }
      } else {
        analysis = '이전 조사에서 충분한 정보를 얻지 못했습니다. '
        nextAction = 'alternative_approach'
        reasoning = '다른 방법으로 접근해야 합니다.'
        confidence = 0.3
      }
      
      if (failedResults.length > 0) {
        analysis += `${failedResults.length}개의 도구 실행이 실패했습니다. `
      }
    }
    
    // Check if we have enough information to answer
    if (knownEvidence.length >= 3 && reactState!.confidence > 0.7) {
      nextAction = 'synthesize_answer'
      reasoning = '충분한 정보가 수집되었으므로 최종 답변을 생성합니다.'
      confidence = 0.9
    }
  }
  
  return { analysis, nextAction, reasoning, confidence }
}

/**
 * ACT: Select and execute appropriate tools
 */
async function actStep(
  state: ChatState,
  thought: { nextAction: string; reasoning: string }
): Promise<{
  selectedTools: SystemTool[]
  results: ToolResult[]
  toolCall: any
}> {
  // Select tools based on thought analysis
  const selectedTools = selectToolsBasedOnThought(state, thought)
  console.log(`🔧 Selected ${selectedTools.length} tools: ${selectedTools.map(t => t.id).join(', ')}`)
  
  // Execute tools (simplified for now - in full implementation would use existing tool execution)
  const results: ToolResult[] = []
  
  for (const tool of selectedTools) {
    try {
      const result = await simulateToolExecution(tool, state)
      results.push(result)
    } catch (error) {
      results.push({
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      })
    }
  }
  
  return {
    selectedTools,
    results,
    toolCall: {
      tool: selectedTools.map(t => t.id).join(', '),
      parameters: {},
      reasoning: thought.reasoning
    }
  }
}

/**
 * OBSERVE: Analyze results and determine next steps
 */
async function observeStep(
  results: ToolResult[],
  _thought: { analysis: string; confidence: number },
  state: ChatState
): Promise<{
  summary: ToolResult
  evidence: Evidence[]
  confidence: number
  needsContinuation: boolean
  reasoning: string
}> {
  const successfulResults = results.filter(r => r.success)
  const evidence: Evidence[] = []
  
  // Convert results to evidence
  successfulResults.forEach((result, index) => {
    evidence.push({
      id: `evidence_${Date.now()}_${index}`,
      source: `tool_execution_${index}`,
      data: result.result,
      reliability: 0.8,
      timestamp: new Date(),
      relevanceScore: calculateRelevanceScore(result.result, state.lastUserMessage)
    })
  })
  
  // Calculate confidence based on evidence quality and quantity
  let confidence = 0.3
  if (evidence.length >= 3) confidence = 0.6
  if (evidence.length >= 5) confidence = 0.8
  if (evidence.some(e => e.relevanceScore > 0.8)) confidence += 0.1
  
  // Determine if we need to continue
  const needsContinuation = confidence < 0.8 && evidence.length < 5
  
  const summary: ToolResult = {
    success: successfulResults.length > 0,
    result: `${successfulResults.length}개의 도구에서 정보를 수집했습니다. 신뢰도: ${confidence.toFixed(2)}`,
    executionTime: results.reduce((sum, r) => sum + r.executionTime, 0)
  }
  
  return {
    summary,
    evidence,
    confidence,
    needsContinuation,
    reasoning: `수집된 증거 ${evidence.length}개, 신뢰도 ${confidence.toFixed(2)}`
  }
}

/**
 * Select tools based on thought analysis
 */
function selectToolsBasedOnThought(state: ChatState, thought: { nextAction: string }): SystemTool[] {
  const availableTools = Array.from(systemToolsRegistry.values())
  
  switch (thought.nextAction) {
    case 'initial_investigation':
    case 'gather_system_info':
      return availableTools.filter((tool: SystemTool) => 
        tool.category === 'system_info' && 
        ['hostname', 'uptime', 'system_overview'].includes(tool.id)
      ).slice(0, 3)
      
    case 'analyze_specific_issue':
      return availableTools.filter((tool: SystemTool) => 
        ['process_list', 'memory_usage', 'disk_usage'].includes(tool.id)
      ).slice(0, 2)
      
    case 'alternative_approach':
      return availableTools.filter((tool: SystemTool) => 
        tool.category === 'network' || tool.category === 'monitoring'
      ).slice(0, 2)
      
    default:
      return selectRelevantTools(state.lastUserMessage, state.intent || 'system_engineering', state.sshConnection).slice(0, 2)
  }
}

/**
 * Simulate tool execution (simplified)
 */
async function simulateToolExecution(tool: SystemTool, _state: ChatState): Promise<ToolResult> {
  const startTime = Date.now()
  
  // Simulate execution based on tool type
  const mockResults: Record<string, any> = {
    hostname: { hostname: 'server-001.example.com' },
    uptime: { uptime: '15 days, 3 hours, 22 minutes' },
    system_overview: { 
      os: 'Ubuntu 20.04 LTS',
      kernel: '5.4.0-74-generic',
      arch: 'x86_64'
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 100)) // Simulate delay
  
  return {
    success: true,
    result: mockResults[tool.id] || { info: `${tool.id} executed successfully` },
    executionTime: Date.now() - startTime
  }
}

/**
 * Calculate relevance score for evidence
 */
function calculateRelevanceScore(data: any, userQuestion: string): number {
  if (!data || typeof data !== 'object') return 0.3
  
  const questionLower = userQuestion.toLowerCase()
  let score = 0.5
  
  // Check for relevant keywords
  const relevantKeys = ['hostname', 'uptime', 'os', 'memory', 'cpu', 'disk']
  const dataKeys = Object.keys(data).map(k => k.toLowerCase())
  
  relevantKeys.forEach(key => {
    if (questionLower.includes(key) && dataKeys.includes(key)) {
      score += 0.2
    }
  })
  
  return Math.min(score, 1.0)
}

/**
 * Update hypotheses based on new evidence
 */
function updateHypotheses(currentHypotheses: Hypothesis[], newEvidence: Evidence[]): Hypothesis[] {
  // For now, create simple hypotheses based on evidence
  const updatedHypotheses = [...currentHypotheses]
  
  newEvidence.forEach(evidence => {
    if (evidence.relevanceScore > 0.7) {
      updatedHypotheses.push({
        id: `hypothesis_${Date.now()}`,
        description: `증거 ${evidence.source}에서 관련 정보 발견`,
        confidence: evidence.relevanceScore,
        supportingEvidence: [evidence.id],
        contradictingEvidence: [],
        status: 'active'
      })
    }
  })
  
  return updatedHypotheses
}

/**
 * Generate final response based on accumulated evidence
 */
async function generateFinalResponse(state: ChatState): Promise<string> {
  const { reactState, lastUserMessage, toolExecutionResults } = state
  
  if (!reactState?.accumulatedEvidence || reactState.accumulatedEvidence.length === 0) {
    return '죄송합니다. 충분한 정보를 수집하지 못했습니다. 다시 시도하거나 더 구체적인 질문을 해주세요.'
  }
  
  // Build response from evidence
  let response = `"${lastUserMessage}"에 대한 분석 결과입니다.\n\n`
  
  response += `## 🔍 조사 과정\n`
  response += `- ${reactState.currentIteration}번의 분석 단계를 거쳤습니다\n`
  response += `- ${reactState.accumulatedEvidence.length}개의 증거를 수집했습니다\n`
  response += `- 최종 신뢰도: ${(reactState.confidence * 100).toFixed(0)}%\n\n`
  
  response += `## 📊 수집된 정보\n`
  reactState.accumulatedEvidence.forEach((evidence, index) => {
    if (evidence.data && typeof evidence.data === 'object') {
      const keys = Object.keys(evidence.data)
      if (keys.length > 0) {
        response += `${index + 1}. **${evidence.source}**: ${keys.join(', ')}\n`
      }
    }
  })
  
  if (toolExecutionResults && toolExecutionResults.length > 0) {
    response += `\n## 🛠️ 실행 결과\n`
    toolExecutionResults.forEach((result, index) => {
      if (result.success && result.result) {
        response += `- 도구 ${index + 1}: ✅ 성공 (${result.executionTime}ms)\n`
      } else {
        response += `- 도구 ${index + 1}: ❌ 실패\n`
      }
    })
  }
  
  response += `\n이 분석은 ReAct(Reasoning + Acting) 방법론을 통해 체계적으로 수행되었습니다.`
  
  return response
}