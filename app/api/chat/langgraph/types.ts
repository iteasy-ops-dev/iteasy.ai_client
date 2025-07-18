import { BaseMessage } from '@langchain/core/messages'

export interface ChatState {
  messages: BaseMessage[]
  lastUserMessage: string
  intent: 'general' | 'system_engineering' | 'agentUsageGuide' | null
  confidence: number
  systemPrompt?: string
  response?: string
  detectedLanguage?: 'ko' | 'en'
  
  // Enhanced ReAct Pattern Fields
  complexityLevel?: 'simple' | 'complex' | 'multi_step' | 'dynamic'
  useReact?: boolean
  reactState?: ReActState
  reasoningChain?: ReActStep[]
  currentStep?: number
  toolsUsed?: string[]
  
  // Tool Execution Framework Fields
  availableTools?: SystemTool[]
  executionContext?: ExecutionContext
  selectedTools?: string[]
  toolExecutionResults?: ToolResult[]
  requiresToolExecution?: boolean
  
  // SSH Connection State
  sshConnection?: SSHConnectionInfo
}

export interface SSHConnectionInfo {
  host: string
  port: number
  username: string
  password?: string
  keyFile?: string
  isActive: boolean
  lastUsed: Date
  alias?: string  // 사용자가 지정한 서버 별칭
}

export interface IntentClassificationResult {
  intent: 'general' | 'system_engineering' | 'agentUsageGuide'
  confidence: number
  reasoning?: string
}

// Enhanced ReAct Pattern Types
export interface ReActStep {
  step: number
  thought: string
  action?: ToolCall
  observation?: ToolResult
  timestamp: Date
  needsContinuation?: boolean
  confidence?: number
}

export interface ReActState {
  currentIteration: number
  maxIterations: number
  completed: boolean
  finalAnswer?: string
  accumulatedEvidence: Evidence[]
  hypotheses: Hypothesis[]
  investigationPath: InvestigationNode[]
  confidence: number
}

export interface Evidence {
  id: string
  source: string
  data: any
  reliability: number
  timestamp: Date
  relevanceScore: number
}

export interface Hypothesis {
  id: string
  description: string
  confidence: number
  supportingEvidence: string[]
  contradictingEvidence: string[]
  status: 'active' | 'confirmed' | 'rejected'
}

export interface InvestigationNode {
  id: string
  question: string
  method: string
  result?: any
  children: string[]
  parent?: string
  status: 'pending' | 'investigating' | 'completed' | 'failed'
}

export interface ReActResponse {
  response?: string
  needsUserInput?: boolean
  question?: string
  suggestedActions?: string[]
  continuationState?: ReActState
  isComplete: boolean
}

export interface ToolCall {
  tool: string
  parameters: Record<string, any>
  reasoning: string
}

export interface ToolResult {
  success: boolean
  result: any
  error?: string
  executionTime: number
}

// Enhanced Tool Execution Framework Types
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
  defaultValue?: any
  validation?: {
    pattern?: string
    min?: number
    max?: number
    enum?: any[]
  }
}

export interface SecurityPolicy {
  riskLevel: 'low' | 'medium' | 'high'
  requiresConfirmation: boolean
  allowedContexts: ExecutionContext[]
  restrictions: string[]
  auditRequired: boolean
}

export interface ExecutionContext {
  environment: 'development' | 'staging' | 'production'
  permissions: string[]
  userId?: string
  sessionId: string
  timestamp: Date
}

export interface SystemTool {
  id: string
  name: string
  category: ToolCategory
  description: string
  parameters: ToolParameter[]
  examples: ToolExample[]
  security: SecurityPolicy
  execute: (params: Record<string, any>, context: ExecutionContext) => Promise<ToolResult>
  validate?: (params: Record<string, any>) => ValidationResult
}

export interface ToolExample {
  description: string
  parameters: Record<string, any>
  expectedResult: string
}

export interface ValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

export interface ToolRegistry {
  tools: Map<string, SystemTool>
  getByCategory: (category: ToolCategory) => SystemTool[]
  getByRiskLevel: (level: 'low' | 'medium' | 'high') => SystemTool[]
  search: (query: string) => SystemTool[]
  validateTool: (toolId: string) => boolean
}

export type ToolCategory = 
  | 'system_info'      // System information gathering
  | 'file_operations'  // File read/write operations  
  | 'network'          // Network diagnostics
  | 'containers'       // Docker/Kubernetes operations
  | 'cloud'            // Cloud platform operations
  | 'databases'        // Database operations
  | 'monitoring'       // Monitoring and metrics
  | 'security'         // Security and compliance
  | 'infrastructure'   // Infrastructure provisioning
  | 'deployment'       // CI/CD and deployment

export interface ComplexityDetectionResult {
  level: 'simple' | 'complex' | 'multi_step' | 'dynamic'
  reasoning: string
  confidence: number
  useReact: boolean
}

export type NodeResponse = Partial<ChatState>