import * as net from 'net'
import * as http from 'http'
import * as https from 'https'
import { exec } from 'child_process'
import { promisify } from 'util'
import { 
  SystemTool, 
  ToolResult, 
  ExecutionContext, 
  SecurityPolicy 
} from '../types'
import { 
  SecurityValidator, 
  secureToolExecution 
} from './security'

const execAsync = promisify(exec)

// Security policies for remote operations
const REMOTE_LOW_RISK_POLICY: SecurityPolicy = {
  riskLevel: 'low',
  requiresConfirmation: false,
  allowedContexts: [],
  restrictions: ['read-only remote operations only'],
  auditRequired: true
}

const REMOTE_MEDIUM_RISK_POLICY: SecurityPolicy = {
  riskLevel: 'medium',
  requiresConfirmation: true,
  allowedContexts: [],
  restrictions: ['limited remote access', 'no destructive operations'],
  auditRequired: true
}

// Helper function to check if host is reachable via TCP
async function checkTcpPort(host: string, port: number, timeout: number = 5000): Promise<{
  reachable: boolean
  responseTime?: number
  error?: string
}> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const socket = new net.Socket()
    
    const onError = (error: any) => {
      socket.destroy()
      resolve({
        reachable: false,
        error: error.message,
        responseTime: Date.now() - startTime
      })
    }
    
    const onTimeout = () => {
      socket.destroy()
      resolve({
        reachable: false,
        error: 'Connection timeout',
        responseTime: Date.now() - startTime
      })
    }
    
    socket.setTimeout(timeout)
    socket.once('error', onError)
    socket.once('timeout', onTimeout)
    socket.once('connect', () => {
      socket.destroy()
      resolve({
        reachable: true,
        responseTime: Date.now() - startTime
      })
    })
    
    socket.connect(port, host)
  })
}

// Helper function to perform HTTP health check
async function httpHealthCheck(url: string, timeout: number = 10000): Promise<{
  success: boolean
  statusCode?: number
  responseTime?: number
  error?: string
  headers?: Record<string, string>
}> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const isHttps = url.startsWith('https://')
    const httpModule = isHttps ? https : http
    
    const request = httpModule.get(url, {
      timeout: timeout,
      headers: {
        'User-Agent': 'ITEasy-SystemAgent/1.0'
      }
    }, (response) => {
      const responseTime = Date.now() - startTime
      
      // Read response body (limit to prevent memory issues)
      let body = ''
      response.on('data', (chunk) => {
        body += chunk.toString()
        if (body.length > 1024) { // Limit to 1KB
          body = body.substring(0, 1024) + '...'
        }
      })
      
      response.on('end', () => {
        resolve({
          success: response.statusCode ? response.statusCode < 400 : false,
          statusCode: response.statusCode,
          responseTime,
          headers: response.headers as Record<string, string>
        })
      })
    })
    
    request.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        responseTime: Date.now() - startTime
      })
    })
    
    request.on('timeout', () => {
      request.destroy()
      resolve({
        success: false,
        error: 'Request timeout',
        responseTime: Date.now() - startTime
      })
    })
  })
}

// Port connectivity check tool
export const checkPortTool: SystemTool = {
  id: 'check_port',
  name: 'Check Port Connectivity',
  category: 'network',
  description: 'Checks if a specific port is open and reachable on a remote host',
  parameters: [
    {
      name: 'host',
      type: 'string',
      description: 'Target host (IP address or domain name)',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9.-]+$'
      }
    },
    {
      name: 'port',
      type: 'number',
      description: 'Port number to check',
      required: true,
      validation: {
        min: 1,
        max: 65535
      }
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Connection timeout in milliseconds (default: 5000)',
      required: false,
      defaultValue: 5000,
      validation: {
        min: 1000,
        max: 30000
      }
    }
  ],
  examples: [
    {
      description: 'Check if web server is running',
      parameters: { host: 'example.com', port: 80 },
      expectedResult: 'Port connectivity status with response time'
    },
    {
      description: 'Check SSH service',
      parameters: { host: '192.168.1.100', port: 22, timeout: 3000 },
      expectedResult: 'SSH port accessibility status'
    }
  ],
  security: REMOTE_MEDIUM_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔧 [REMOTE] Checking port ${params.port} on ${params.host}`)
          
          // Validate host format
          if (!/^[a-zA-Z0-9.-]+$/.test(params.host)) {
            throw new Error('Invalid host format')
          }
          
          const result = await checkTcpPort(
            params.host, 
            params.port, 
            params.timeout || 5000
          )
          
          return {
            success: true,
            result: {
              host: params.host,
              port: params.port,
              reachable: result.reachable,
              responseTime: result.responseTime,
              error: result.error,
              timestamp: new Date().toISOString()
            },
            executionTime: Date.now() - startTime
          }
        } catch (error: any) {
          return {
            success: false,
            result: null,
            error: error.message,
            executionTime: Date.now() - startTime
          }
        }
      }
    )
  }
}

// HTTP health check tool
export const httpHealthCheckTool: SystemTool = {
  id: 'http_health_check',
  name: 'HTTP Health Check',
  category: 'monitoring',
  description: 'Performs HTTP/HTTPS health check on web services',
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: 'URL to check (must include http:// or https://)',
      required: true,
      validation: {
        pattern: '^https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?$'
      }
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Request timeout in milliseconds (default: 10000)',
      required: false,
      defaultValue: 10000,
      validation: {
        min: 1000,
        max: 30000
      }
    },
    {
      name: 'expectedStatus',
      type: 'number',
      description: 'Expected HTTP status code (default: 200)',
      required: false,
      defaultValue: 200,
      validation: {
        min: 100,
        max: 599
      }
    }
  ],
  examples: [
    {
      description: 'Check website availability',
      parameters: { url: 'https://example.com' },
      expectedResult: 'HTTP response status and timing'
    },
    {
      description: 'Check API endpoint',
      parameters: { url: 'https://api.example.com/health', expectedStatus: 200 },
      expectedResult: 'API health status with response details'
    }
  ],
  security: REMOTE_LOW_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔧 [REMOTE] HTTP health check for ${params.url}`)
          
          // Validate URL format
          if (!/^https?:\/\/[a-zA-Z0-9.-]+(:[0-9]+)?(\/.*)?$/.test(params.url)) {
            throw new Error('Invalid URL format')
          }
          
          const result = await httpHealthCheck(params.url, params.timeout || 10000)
          const expectedStatus = params.expectedStatus || 200
          
          const healthStatus = result.success && result.statusCode === expectedStatus
          
          return {
            success: true,
            result: {
              url: params.url,
              healthy: healthStatus,
              statusCode: result.statusCode,
              expectedStatus: expectedStatus,
              responseTime: result.responseTime,
              headers: result.headers,
              error: result.error,
              timestamp: new Date().toISOString()
            },
            executionTime: Date.now() - startTime
          }
        } catch (error: any) {
          return {
            success: false,
            result: null,
            error: error.message,
            executionTime: Date.now() - startTime
          }
        }
      }
    )
  }
}

// SSH connectivity test tool
export const sshConnectivityTool: SystemTool = {
  id: 'ssh_connectivity',
  name: 'SSH Connectivity Test',
  category: 'network',
  description: 'Tests SSH connectivity to remote servers (connection test only, no authentication)',
  parameters: [
    {
      name: 'host',
      type: 'string',
      description: 'SSH server host',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9.-]+$'
      }
    },
    {
      name: 'port',
      type: 'number',
      description: 'SSH port (default: 22)',
      required: false,
      defaultValue: 22,
      validation: {
        min: 1,
        max: 65535
      }
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Connection timeout in seconds (default: 10)',
      required: false,
      defaultValue: 10,
      validation: {
        min: 1,
        max: 60
      }
    }
  ],
  examples: [
    {
      description: 'Test SSH connectivity to server',
      parameters: { host: 'server.example.com' },
      expectedResult: 'SSH service availability status'
    }
  ],
  security: REMOTE_MEDIUM_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔧 [REMOTE] Testing SSH connectivity to ${params.host}:${params.port || 22}`)
          
          // Validate host format
          if (!/^[a-zA-Z0-9.-]+$/.test(params.host)) {
            throw new Error('Invalid host format')
          }
          
          const port = params.port || 22
          const timeout = (params.timeout || 10) * 1000
          
          // First check if port is reachable
          const portCheck = await checkTcpPort(params.host, port, timeout)
          
          if (!portCheck.reachable) {
            return {
              success: true,
              result: {
                host: params.host,
                port: port,
                sshAvailable: false,
                error: portCheck.error,
                responseTime: portCheck.responseTime,
                timestamp: new Date().toISOString()
              },
              executionTime: Date.now() - startTime
            }
          }
          
          // Try to get SSH banner (more sophisticated check)
          const sshCommand = `ssh -o ConnectTimeout=${params.timeout || 10} -o BatchMode=yes -o StrictHostKeyChecking=no ${params.host} -p ${port} exit 2>&1 || true`
          
          // Validate command safety
          const commandValidation = SecurityValidator.validateCommand(sshCommand)
          if (!commandValidation.safe) {
            throw new Error(`Command validation failed: ${commandValidation.reason}`)
          }
          
          const { stdout, stderr } = await execAsync(sshCommand, { timeout: timeout + 2000 })
          
          // Analyze SSH response
          const output = stdout + stderr
          const sshAvailable = !output.includes('Connection refused') && 
                              !output.includes('Connection timed out') &&
                              !output.includes('No route to host')
          
          return {
            success: true,
            result: {
              host: params.host,
              port: port,
              sshAvailable: sshAvailable,
              responseTime: portCheck.responseTime,
              sshBanner: output.split('\n')[0] || 'No banner',
              timestamp: new Date().toISOString()
            },
            executionTime: Date.now() - startTime
          }
        } catch (error: any) {
          return {
            success: false,
            result: null,
            error: error.message,
            executionTime: Date.now() - startTime
          }
        }
      }
    )
  }
}

// Multiple servers health check tool
export const multiServerHealthTool: SystemTool = {
  id: 'multi_server_health',
  name: 'Multiple Servers Health Check',
  category: 'monitoring',
  description: 'Checks health status of multiple servers simultaneously',
  parameters: [
    {
      name: 'servers',
      type: 'array',
      description: 'Array of server configurations to check',
      required: true
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Timeout per server check in seconds (default: 10)',
      required: false,
      defaultValue: 10,
      validation: {
        min: 1,
        max: 60
      }
    }
  ],
  examples: [
    {
      description: 'Check multiple web servers',
      parameters: {
        servers: [
          { host: 'web1.example.com', port: 80 },
          { host: 'web2.example.com', port: 80 },
          { host: 'api.example.com', port: 443 }
        ]
      },
      expectedResult: 'Health status for all specified servers'
    }
  ],
  security: REMOTE_MEDIUM_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔧 [REMOTE] Checking health of ${params.servers?.length || 0} servers`)
          
          if (!Array.isArray(params.servers)) {
            throw new Error('Servers parameter must be an array')
          }
          
          const timeout = (params.timeout || 10) * 1000
          const results = []
          
          // Check servers in parallel
          const checks = params.servers.map(async (server: any) => {
            try {
              if (!server.host) {
                return {
                  host: 'unknown',
                  port: server.port || 80,
                  status: 'error',
                  error: 'Host not specified'
                }
              }
              
              // Validate host format
              if (!/^[a-zA-Z0-9.-]+$/.test(server.host)) {
                return {
                  host: server.host,
                  port: server.port || 80,
                  status: 'error',
                  error: 'Invalid host format'
                }
              }
              
              const port = server.port || 80
              const result = await checkTcpPort(server.host, port, timeout)
              
              return {
                host: server.host,
                port: port,
                status: result.reachable ? 'healthy' : 'unhealthy',
                responseTime: result.responseTime,
                error: result.error
              }
            } catch (error: any) {
              return {
                host: server.host || 'unknown',
                port: server.port || 80,
                status: 'error',
                error: error.message
              }
            }
          })
          
          const checkResults = await Promise.all(checks)
          
          const summary = {
            totalServers: checkResults.length,
            healthyServers: checkResults.filter(r => r.status === 'healthy').length,
            unhealthyServers: checkResults.filter(r => r.status === 'unhealthy').length,
            errorServers: checkResults.filter(r => r.status === 'error').length
          }
          
          return {
            success: true,
            result: {
              summary,
              servers: checkResults,
              timestamp: new Date().toISOString()
            },
            executionTime: Date.now() - startTime
          }
        } catch (error: any) {
          return {
            success: false,
            result: null,
            error: error.message,
            executionTime: Date.now() - startTime
          }
        }
      }
    )
  }
}

// Export remote tools
export const remoteToolsRegistry = new Map<string, SystemTool>([
  [checkPortTool.id, checkPortTool],
  [httpHealthCheckTool.id, httpHealthCheckTool],
  [sshConnectivityTool.id, sshConnectivityTool],
  [multiServerHealthTool.id, multiServerHealthTool]
])

console.log('🌐 [REMOTE_TOOLS] Remote monitoring tools initialized:', Array.from(remoteToolsRegistry.keys()))