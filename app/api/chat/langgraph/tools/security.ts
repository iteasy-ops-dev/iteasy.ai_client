import { ExecutionContext, SystemTool, SecurityPolicy } from '../types'

// Security audit log entry
export interface AuditLogEntry {
  timestamp: Date
  userId?: string
  sessionId: string
  toolId: string
  action: 'execute' | 'validate' | 'block'
  parameters: Record<string, any>
  result: 'success' | 'failure' | 'blocked'
  riskLevel: 'low' | 'medium' | 'high'
  error?: string
  executionTime?: number
}

// In-memory audit log (in production, this should go to a proper logging system)
const auditLog: AuditLogEntry[] = []

// Command blacklist - commands that should never be executed
const COMMAND_BLACKLIST = [
  'rm -rf',
  'sudo rm',
  'mkfs',
  'fdisk',
  'dd if=',
  'chmod 777',
  'passwd',
  'userdel',
  'usermod',
  'shutdown',
  'reboot',
  'halt',
  'init 0',
  'init 6',
  'killall',
  'kill -9',
  'nc -l',
  'netcat -l',
  '>',
  '>>',
  '|',
  '&&',
  '||',
  ';',
  '`',
  '$(',
  'eval',
  'exec',
  'source .',  // More specific pattern to avoid blocking IP addresses
  'curl -s',
  'wget -O',
  'python -c',
  'perl -e',
  'ruby -e',
  'node -e'
]

// Command whitelist patterns - only these patterns are allowed
const COMMAND_WHITELIST_PATTERNS = [
  /^ls\s/,
  /^cat\s/,
  /^head\s/,
  /^tail\s/,
  /^grep\s/,
  /^find\s/,
  /^ps\s/,
  /^ps$/,
  /^df\s/,
  /^df$/,
  /^du\s/,
  /^free$/,
  /^uptime$/,
  /^whoami$/,
  /^pwd$/,
  /^date$/,
  /^uname\s/,
  // Enhanced ping patterns to support various formats
  /^ping\s+-c\s+\d+\s+[\w.-]+$/,                    // ping -c 4 hostname
  /^ping\s+-c\s+\d+\s+(?:\d{1,3}\.){3}\d{1,3}$/,   // ping -c 4 192.168.1.1
  /^ping\s+-n\s+\d+\s+[\w.-]+$/,                    // Windows: ping -n 4 hostname
  /^ping\s+-n\s+\d+\s+(?:\d{1,3}\.){3}\d{1,3}$/,   // Windows: ping -n 4 192.168.1.1
  /^nslookup\s[\w.-]+$/,
  /^dig\s[\w.-]+$/,
  /^systemctl status\s/,
  /^systemctl is-active\s/,
  /^systemctl is-enabled\s/,
  /^systemctl list-units\s/,
  /^tasklist\s/,      // Windows process list
  /^docker ps/,
  /^docker images/,
  /^kubectl get\s/,
  /^kubectl describe\s/,
  /^aws\s.*--dry-run/,
  /^terraform plan/,
  /^ansible\s.*--check/,
  // SSH remote execution patterns
  /^ssh\s+-o\s+ConnectTimeout=\d+\s+-o\s+StrictHostKeyChecking=no\s+.*@.*\s+".*"$/,
  /^ssh\s+-o\s+ConnectTimeout=\d+\s+-o\s+StrictHostKeyChecking=no\s+-p\s+\d+\s+.*@.*\s+".*"$/,
  /^ssh\s+-o\s+ConnectTimeout=\d+\s+-o\s+StrictHostKeyChecking=no\s+-i\s+"[^"]+"\s+.*@.*\s+".*"$/,
  /^ssh\s+-o\s+ConnectTimeout=\d+\s+-o\s+StrictHostKeyChecking=no\s+-i\s+"[^"]+"\s+-p\s+\d+\s+.*@.*\s+".*"$/,
  // SSH with sshpass for password authentication
  /^sshpass\s+-p\s+'[^']+'\s+ssh\s+-o\s+ConnectTimeout=\d+\s+-o\s+StrictHostKeyChecking=no\s+-o\s+PasswordAuthentication=yes\s+.*@.*\s+".*"$/,
  /^sshpass\s+-p\s+'[^']+'\s+ssh\s+-o\s+ConnectTimeout=\d+\s+-o\s+StrictHostKeyChecking=no\s+-o\s+PasswordAuthentication=yes\s+-p\s+\d+\s+.*@.*\s+".*"$/
]

// Path access control - directories that can be accessed
const ALLOWED_PATHS = [
  '/tmp',
  '/var/log',
  '/etc',
  '/proc',
  '/sys',
  '/home',
  '/opt',
  '/usr/local',
  process.cwd() // Current working directory
]

const RESTRICTED_PATHS = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  '/root',
  '/boot',
  '/sys/kernel',
  '/proc/sys',
  '/.ssh',
  '/etc/ssh'
]

// Security validation functions
export class SecurityValidator {
  
  // Validate command safety
  static validateCommand(command: string): { safe: boolean; reason?: string } {
    console.log(`🔒 [SECURITY] Validating command: ${command}`)
    
    const cleanCommand = command.trim()
    
    // Check blacklist with more precise matching
    for (const blacklisted of COMMAND_BLACKLIST) {
      // For single character patterns like ".", be more specific
      if (blacklisted === 'source .' && cleanCommand === 'source .') {
        return {
          safe: false,
          reason: `Command contains blacklisted pattern: ${blacklisted}`
        }
      }
      // For other patterns, use includes but be careful with single chars
      else if (blacklisted.length > 1 && command.toLowerCase().includes(blacklisted.toLowerCase())) {
        return {
          safe: false,
          reason: `Command contains blacklisted pattern: ${blacklisted}`
        }
      }
    }
    
    // Check whitelist patterns
    const isWhitelisted = COMMAND_WHITELIST_PATTERNS.some(pattern => {
      const matches = pattern.test(cleanCommand)
      if (matches) {
        console.log(`🔒 [SECURITY] Command matched whitelist pattern: ${pattern}`)
      }
      return matches
    })
    
    if (!isWhitelisted) {
      console.log(`🔒 [SECURITY] Command did not match any whitelist pattern`)
      console.log(`🔒 [SECURITY] Available patterns:`, COMMAND_WHITELIST_PATTERNS.map(p => p.toString()))
      return {
        safe: false,
        reason: 'Command does not match any whitelisted patterns'
      }
    }
    
    console.log(`✅ [SECURITY] Command validated successfully`)
    return { safe: true }
  }
  
  // Validate file path access
  static validateFilePath(filePath: string): { safe: boolean; reason?: string } {
    console.log(`🔒 [SECURITY] Validating file path: ${filePath}`)
    
    const resolvedPath = require('path').resolve(filePath)
    
    // Check restricted paths
    for (const restrictedPath of RESTRICTED_PATHS) {
      if (resolvedPath.startsWith(restrictedPath)) {
        return {
          safe: false,
          reason: `Access to restricted path: ${restrictedPath}`
        }
      }
    }
    
    // Check allowed paths
    const isAllowed = ALLOWED_PATHS.some(allowedPath => 
      resolvedPath.startsWith(allowedPath)
    )
    
    if (!isAllowed) {
      return {
        safe: false,
        reason: 'Path is not in allowed directories'
      }
    }
    
    console.log(`✅ [SECURITY] File path validated successfully`)
    return { safe: true }
  }
  
  // Validate tool execution permissions
  static validateToolExecution(
    tool: SystemTool, 
    context: ExecutionContext
  ): { allowed: boolean; reason?: string } {
    console.log(`🔒 [SECURITY] Validating tool execution: ${tool.id}`)
    
    // Check if tool is appropriate for environment
    if (context.environment === 'production' && tool.security.riskLevel === 'high') {
      return {
        allowed: false,
        reason: 'High-risk tools not allowed in production'
      }
    }
    
    // Check required permissions
    const hasRequiredPermissions = tool.security.allowedContexts.length === 0 || 
      tool.security.allowedContexts.some(allowedContext => 
        allowedContext.environment === context.environment
      )
    
    if (!hasRequiredPermissions) {
      return {
        allowed: false,
        reason: 'Insufficient permissions for this environment'
      }
    }
    
    console.log(`✅ [SECURITY] Tool execution validated successfully`)
    return { allowed: true }
  }
  
  // Sanitize parameters to prevent injection
  static sanitizeParameters(params: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous characters
        sanitized[key] = value
          .replace(/[`$(){}[\];|&<>]/g, '') // Remove shell metacharacters
          .replace(/\.\./g, '') // Remove directory traversal
          .trim()
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }
}

// Audit logging functions
export class AuditLogger {
  
  static log(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    }
    
    auditLog.push(logEntry)
    
    // Log to console (in production, this should go to a proper logging system)
    console.log(`📋 [AUDIT] ${logEntry.action.toUpperCase()} - Tool: ${logEntry.toolId}, Result: ${logEntry.result}, Risk: ${logEntry.riskLevel}`)
    
    // Keep only last 1000 entries in memory
    if (auditLog.length > 1000) {
      auditLog.splice(0, auditLog.length - 1000)
    }
  }
  
  static getAuditLog(limit: number = 100): AuditLogEntry[] {
    return auditLog.slice(-limit)
  }
  
  static getAuditLogForSession(sessionId: string): AuditLogEntry[] {
    return auditLog.filter(entry => entry.sessionId === sessionId)
  }
  
  static getFailedExecutions(limit: number = 50): AuditLogEntry[] {
    return auditLog
      .filter(entry => entry.result === 'failure' || entry.result === 'blocked')
      .slice(-limit)
  }
}

// Risk assessment functions
export class RiskAssessment {
  
  static assessToolRisk(tool: SystemTool, params: Record<string, any>): {
    level: 'low' | 'medium' | 'high'
    factors: string[]
  } {
    const factors: string[] = []
    let riskScore = 0
    
    // Base risk from tool security policy
    switch (tool.security.riskLevel) {
      case 'high':
        riskScore += 3
        factors.push('High-risk tool')
        break
      case 'medium':
        riskScore += 2
        factors.push('Medium-risk tool')
        break
      case 'low':
        riskScore += 1
        factors.push('Low-risk tool')
        break
    }
    
    // Risk from parameters
    if (params.path && params.path.includes('/etc')) {
      riskScore += 1
      factors.push('System configuration access')
    }
    
    if (params.host && !['127.0.0.1', 'localhost', '8.8.8.8'].includes(params.host)) {
      riskScore += 1
      factors.push('External network access')
    }
    
    if (params.command) {
      riskScore += 2
      factors.push('Command execution')
    }
    
    // Determine final risk level
    let level: 'low' | 'medium' | 'high'
    if (riskScore >= 4) {
      level = 'high'
    } else if (riskScore >= 2) {
      level = 'medium'
    } else {
      level = 'low'
    }
    
    return { level, factors }
  }
}

// Security middleware for tool execution
export async function secureToolExecution<T>(
  tool: SystemTool,
  params: Record<string, any>,
  context: ExecutionContext,
  executeFunction: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()
  
  try {
    // 1. Validate tool execution permissions
    const permissionCheck = SecurityValidator.validateToolExecution(tool, context)
    if (!permissionCheck.allowed) {
      await AuditLogger.log({
        userId: context.userId,
        sessionId: context.sessionId,
        toolId: tool.id,
        action: 'validate',
        parameters: params,
        result: 'blocked',
        riskLevel: tool.security.riskLevel,
        error: permissionCheck.reason
      })
      throw new Error(`Permission denied: ${permissionCheck.reason}`)
    }
    
    // 2. Sanitize parameters
    const sanitizedParams = SecurityValidator.sanitizeParameters(params)
    
    // 3. Assess risk
    const riskAssessment = RiskAssessment.assessToolRisk(tool, sanitizedParams)
    
    // 4. Log execution start
    await AuditLogger.log({
      userId: context.userId,
      sessionId: context.sessionId,
      toolId: tool.id,
      action: 'execute',
      parameters: sanitizedParams,
      result: 'success',
      riskLevel: riskAssessment.level
    })
    
    // 5. Execute the function
    const result = await executeFunction()
    
    // 6. Log successful execution
    await AuditLogger.log({
      userId: context.userId,
      sessionId: context.sessionId,
      toolId: tool.id,
      action: 'execute',
      parameters: sanitizedParams,
      result: 'success',
      riskLevel: riskAssessment.level,
      executionTime: Date.now() - startTime
    })
    
    return result
    
  } catch (error: any) {
    // Log failed execution
    await AuditLogger.log({
      userId: context.userId,
      sessionId: context.sessionId,
      toolId: tool.id,
      action: 'execute',
      parameters: params,
      result: 'failure',
      riskLevel: tool.security.riskLevel,
      error: error.message,
      executionTime: Date.now() - startTime
    })
    
    throw error
  }
}

console.log('🔒 [SECURITY] Security system initialized with validation, audit logging, and risk assessment')