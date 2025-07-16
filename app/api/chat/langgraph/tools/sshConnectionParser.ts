// SSH Connection Information Parser
// Extracts SSH connection details from user messages

export interface SSHConnectionInfo {
  host?: string
  port?: number
  username?: string
  password?: string
  keyFile?: string
  hasValidConnection: boolean
  source: string
  confidence: number
}

/**
 * Parses various SSH connection formats from user messages
 */
export function parseSSHConnectionInfo(message: string): SSHConnectionInfo {
  const lowerMessage = message.toLowerCase()
  
  console.log('🔍 [SSH_PARSER] Parsing SSH connection info from:', message.substring(0, 100))
  
  // Initialize result
  const result: SSHConnectionInfo = {
    hasValidConnection: false,
    source: 'none',
    confidence: 0
  }
  
  // Pattern 1: SSH URL format - ssh://user:pass@host:port
  const sshUrlPattern = /ssh:\/\/([^:]+):([^@]+)@([^:]+)(?::(\d+))?/i
  const sshUrlMatch = message.match(sshUrlPattern)
  
  if (sshUrlMatch) {
    result.username = sshUrlMatch[1]
    result.password = sshUrlMatch[2]
    result.host = sshUrlMatch[3]
    result.port = sshUrlMatch[4] ? parseInt(sshUrlMatch[4]) : 22
    result.hasValidConnection = true
    result.source = 'ssh_url'
    result.confidence = 0.95
    
    console.log('✅ [SSH_PARSER] Found SSH URL format')
    return result
  }
  
  // Pattern 2: Explicit format - "host:port user:password"
  const explicitPattern = /([a-zA-Z0-9.-]+):(\d+)\s+([^:]+):([^\s]+)/
  const explicitMatch = message.match(explicitPattern)
  
  if (explicitMatch) {
    result.host = explicitMatch[1]
    result.port = parseInt(explicitMatch[2])
    result.username = explicitMatch[3]
    result.password = explicitMatch[4]
    result.hasValidConnection = true
    result.source = 'explicit_format'
    result.confidence = 0.9
    
    console.log('✅ [SSH_PARSER] Found explicit format')
    return result
  }
  
  // Pattern 3: Korean format - "서버 IP 사용자 비밀번호"
  const koreanPattern = /(?:서버|호스트|ip)\s*:?\s*([0-9.]+).*?(?:사용자|유저|user)\s*:?\s*([^\s]+).*?(?:비밀번호|패스워드|password)\s*:?\s*([^\s]+)/i
  const koreanMatch = message.match(koreanPattern)
  
  if (koreanMatch) {
    result.host = koreanMatch[1]
    result.username = koreanMatch[2]
    result.password = koreanMatch[3]
    result.port = 22 // default
    result.hasValidConnection = true
    result.source = 'korean_format'
    result.confidence = 0.85
    
    console.log('✅ [SSH_PARSER] Found Korean format')
    return result
  }
  
  // Pattern 4: Natural language - "connect to host with user/password"
  const naturalPattern = /(?:connect to|접속.*?)\s*([0-9.]+).*?(?:with|로|으로)\s*([^/\s]+)[/]([^\s]+)/i
  const naturalMatch = message.match(naturalPattern)
  
  if (naturalMatch) {
    result.host = naturalMatch[1]
    result.username = naturalMatch[2]
    result.password = naturalMatch[3]
    result.port = 22
    result.hasValidConnection = true
    result.source = 'natural_language'
    result.confidence = 0.8
    
    console.log('✅ [SSH_PARSER] Found natural language format')
    return result
  }
  
  // Pattern 5: Partial extraction (try to get what we can)
  let partialInfo = false
  
  // Extract IP address
  const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/
  const ipMatch = message.match(ipPattern)
  if (ipMatch) {
    result.host = ipMatch[0]
    partialInfo = true
  }
  
  // Extract port
  const portPattern = /(?:port|포트)\s*:?\s*(\d+)/i
  const portMatch = message.match(portPattern)
  if (portMatch) {
    result.port = parseInt(portMatch[1])
    partialInfo = true
  } else {
    result.port = 22 // default
  }
  
  // Extract username patterns
  const userPatterns = [
    /(?:user|username|사용자|유저)\s*:?\s*([a-zA-Z0-9._-]+)/i,
    /(?:계정|account)\s*:?\s*([a-zA-Z0-9._-]+)/i,
    /([a-zA-Z0-9._-]+)@/,  // user@host format
  ]
  
  for (const pattern of userPatterns) {
    const match = message.match(pattern)
    if (match) {
      result.username = match[1]
      partialInfo = true
      break
    }
  }
  
  // Extract password patterns (be careful with common words)
  const passwordPatterns = [
    /(?:password|passwd|pwd|비밀번호|패스워드)\s*:?\s*([^\s]+)/i,
    /(?:pass|pw)\s*:?\s*([^\s]+)/i,
  ]
  
  for (const pattern of passwordPatterns) {
    const match = message.match(pattern)
    if (match && match[1].length > 2) { // Avoid single chars
      result.password = match[1]
      partialInfo = true
      break
    }
  }
  
  // Extract SSH key file
  const keyPatterns = [
    /(?:key|키)\s*:?\s*([/~][^\s]+)/i,
    /(?:keyfile|key-file|키파일)\s*:?\s*([/~][^\s]+)/i,
  ]
  
  for (const pattern of keyPatterns) {
    const match = message.match(pattern)
    if (match) {
      result.keyFile = match[1]
      partialInfo = true
      break
    }
  }
  
  // Determine if we have enough info for connection
  if (result.host && (result.password || result.keyFile) && result.username) {
    result.hasValidConnection = true
    result.source = 'partial_extraction'
    result.confidence = 0.7
    console.log('✅ [SSH_PARSER] Extracted sufficient connection info')
  } else if (partialInfo) {
    result.source = 'partial_extraction'
    result.confidence = 0.4
    console.log('⚠️ [SSH_PARSER] Found partial connection info')
  }
  
  // Log extracted information (but mask password)
  console.log('🔍 [SSH_PARSER] Extraction result:', {
    host: result.host,
    port: result.port,
    username: result.username,
    password: result.password ? '***MASKED***' : undefined,
    keyFile: result.keyFile,
    hasValidConnection: result.hasValidConnection,
    source: result.source,
    confidence: result.confidence
  })
  
  return result
}

/**
 * Validates if SSH connection info is sufficient for connection
 */
export function validateSSHConnectionInfo(info: SSHConnectionInfo): {
  valid: boolean
  missing: string[]
  warnings: string[]
} {
  const missing: string[] = []
  const warnings: string[] = []
  
  // Check required fields
  if (!info.host) {
    missing.push('host')
  }
  
  if (!info.username) {
    missing.push('username')
  }
  
  if (!info.password && !info.keyFile) {
    missing.push('password or SSH key')
  }
  
  // Check warnings
  if (info.port && (info.port < 1 || info.port > 65535)) {
    warnings.push('Invalid port number')
  }
  
  if (info.password && info.password.length < 3) {
    warnings.push('Password seems too short')
  }
  
  if (info.host && !/^[a-zA-Z0-9.-]+$/.test(info.host)) {
    warnings.push('Host format might be invalid')
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings
  }
}

/**
 * Checks if message contains SSH connection information
 */
export function hasSSHConnectionInfo(message: string): boolean {
  const info = parseSSHConnectionInfo(message)
  return info.hasValidConnection || info.confidence > 0.3
}

/**
 * Generates SSH connection summary for logging
 */
export function getSSHConnectionSummary(info: SSHConnectionInfo): string {
  if (!info.hasValidConnection) {
    return 'No valid SSH connection info found'
  }
  
  const authMethod = info.password ? 'password' : info.keyFile ? 'key' : 'unknown'
  return `SSH to ${info.username}@${info.host}:${info.port} using ${authMethod} (confidence: ${Math.round(info.confidence * 100)}%)`
}

console.log('🔍 [SSH_CONNECTION_PARSER] SSH connection parser initialized')