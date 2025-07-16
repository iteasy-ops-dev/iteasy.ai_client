import * as os from 'os'
import * as fs from 'fs/promises'
import * as path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import { 
  SystemTool, 
  ToolResult, 
  ExecutionContext, 
  ToolParameter,
  SecurityPolicy 
} from '../types'
import { 
  SecurityValidator, 
  AuditLogger, 
  secureToolExecution 
} from './security'

const execAsync = promisify(exec)

// Security policies for different risk levels
const LOW_RISK_POLICY: SecurityPolicy = {
  riskLevel: 'low',
  requiresConfirmation: false,
  allowedContexts: [],
  restrictions: ['read-only operations only'],
  auditRequired: true
}

const MEDIUM_RISK_POLICY: SecurityPolicy = {
  riskLevel: 'medium', 
  requiresConfirmation: true,
  allowedContexts: [],
  restrictions: ['no system modifications', 'limited network access'],
  auditRequired: true
}

// Helper function to safely execute commands with timeout
async function safeExec(command: string, timeoutMs: number = 5000): Promise<ToolResult> {
  const startTime = Date.now()
  
  try {
    console.log(`🔧 [TOOL] Executing safe command: ${command}`)
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      encoding: 'utf8'
    })
    
    const executionTime = Date.now() - startTime
    
    if (stderr && stderr.trim()) {
      console.log(`⚠️ [TOOL] Command stderr: ${stderr}`)
    }
    
    return {
      success: true,
      result: stdout.trim(),
      executionTime
    }
  } catch (error: any) {
    const executionTime = Date.now() - startTime
    console.error(`❌ [TOOL] Command failed: ${error.message}`)
    
    return {
      success: false,
      result: null,
      error: error.message,
      executionTime
    }
  }
}

// System Information Tool
export const getSystemInfoTool: SystemTool = {
  id: 'get_system_info',
  name: 'Get System Information',
  category: 'system_info',
  description: 'Retrieves basic system information including OS, CPU, memory, and uptime',
  parameters: [
    {
      name: 'detailed',
      type: 'boolean',
      description: 'Include detailed system information',
      required: false,
      defaultValue: false
    }
  ],
  examples: [
    {
      description: 'Get basic system info',
      parameters: { detailed: false },
      expectedResult: 'OS info, CPU count, memory usage'
    },
    {
      description: 'Get detailed system info',
      parameters: { detailed: true },
      expectedResult: 'Detailed OS info, CPU architecture, network interfaces'
    }
  ],
  security: LOW_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    const startTime = Date.now()
    
    try {
      console.log('🔧 [TOOL] Getting system information...')
      
      const systemInfo = {
        platform: os.platform(),
        arch: os.arch(),
        version: os.version(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        timestamp: new Date().toISOString()
      }
      
      if (params.detailed) {
        const detailedInfo = {
          ...systemInfo,
          cpuDetails: os.cpus()[0],
          networkInterfaces: Object.keys(os.networkInterfaces()),
          userInfo: os.userInfo(),
          tmpdir: os.tmpdir()
        }
        
        return {
          success: true,
          result: detailedInfo,
          executionTime: Date.now() - startTime
        }
      }
      
      return {
        success: true,
        result: systemInfo,
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
}

// File Listing Tool
export const listFilesTool: SystemTool = {
  id: 'list_files',
  name: 'List Files',
  category: 'file_operations',
  description: 'Lists files and directories in a specified path',
  parameters: [
    {
      name: 'path',
      type: 'string',
      description: 'Directory path to list files from',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9/._-]+$'
      }
    },
    {
      name: 'detailed',
      type: 'boolean',
      description: 'Include file details (size, permissions, modified date)',
      required: false,
      defaultValue: false
    }
  ],
  examples: [
    {
      description: 'List files in current directory',
      parameters: { path: '.', detailed: false },
      expectedResult: 'Array of file names'
    },
    {
      description: 'List files with details',
      parameters: { path: '/tmp', detailed: true },
      expectedResult: 'Array of files with size, permissions, dates'
    }
  ],
  security: LOW_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    const startTime = Date.now()
    
    try {
      console.log(`🔧 [TOOL] Listing files in: ${params.path}`)
      
      const targetPath = path.resolve(params.path)
      const files = await fs.readdir(targetPath)
      
      if (params.detailed) {
        const detailedFiles = await Promise.all(
          files.map(async (file) => {
            try {
              const filePath = path.join(targetPath, file)
              const stats = await fs.stat(filePath)
              
              return {
                name: file,
                size: stats.size,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
                modified: stats.mtime,
                permissions: stats.mode,
                owner: stats.uid
              }
            } catch (error) {
              return {
                name: file,
                error: 'Could not read file stats'
              }
            }
          })
        )
        
        return {
          success: true,
          result: detailedFiles,
          executionTime: Date.now() - startTime
        }
      }
      
      return {
        success: true,
        result: files,
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
}

// File Reading Tool
export const readFileTool: SystemTool = {
  id: 'read_file',
  name: 'Read File',
  category: 'file_operations',
  description: 'Reads the contents of a text file',
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to the file to read',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9/._-]+$'
      }
    },
    {
      name: 'maxLines',
      type: 'number',
      description: 'Maximum number of lines to read (default: 100)',
      required: false,
      defaultValue: 100,
      validation: {
        min: 1,
        max: 1000
      }
    },
    {
      name: 'encoding',
      type: 'string',
      description: 'File encoding (default: utf8)',
      required: false,
      defaultValue: 'utf8',
      validation: {
        enum: ['utf8', 'ascii', 'latin1']
      }
    }
  ],
  examples: [
    {
      description: 'Read a config file',
      parameters: { filePath: '/etc/hosts', maxLines: 50 },
      expectedResult: 'File contents as string'
    }
  ],
  security: LOW_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔧 [TOOL] Reading file: ${params.filePath}`)
          
          // Security validation for file path
          const pathValidation = SecurityValidator.validateFilePath(params.filePath)
          if (!pathValidation.safe) {
            throw new Error(`Security validation failed: ${pathValidation.reason}`)
          }
          
          const filePath = path.resolve(params.filePath)
          const content = await fs.readFile(filePath, { encoding: params.encoding || 'utf8' })
          
          // Limit lines if specified
          const lines = content.toString().split('\n')
          const maxLines = params.maxLines || 100
          
          if (lines.length > maxLines) {
            const truncatedContent = lines.slice(0, maxLines).join('\n')
            
            return {
              success: true,
              result: {
                content: truncatedContent,
                truncated: true,
                totalLines: lines.length,
                displayedLines: maxLines
              },
              executionTime: Date.now() - startTime
            }
          }
          
          return {
            success: true,
            result: {
              content,
              truncated: false,
              totalLines: lines.length
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

// Network Connectivity Check Tool
export const checkConnectivityTool: SystemTool = {
  id: 'check_connectivity',
  name: 'Check Network Connectivity',
  category: 'network',
  description: 'Checks network connectivity to a host using ping',
  parameters: [
    {
      name: 'host',
      type: 'string',
      description: 'Host to ping (IP address or domain name)',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9.-]+$'
      }
    },
    {
      name: 'count',
      type: 'number',
      description: 'Number of ping packets to send (default: 4)',
      required: false,
      defaultValue: 4,
      validation: {
        min: 1,
        max: 10
      }
    }
  ],
  examples: [
    {
      description: 'Check connectivity to Google DNS',
      parameters: { host: '8.8.8.8', count: 3 },
      expectedResult: 'Ping results with response times'
    }
  ],
  security: MEDIUM_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const host = params.host
        const count = params.count || 4
        
        // Basic validation to prevent command injection
        if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
          return {
            success: false,
            result: null,
            error: 'Invalid host format',
            executionTime: 0
          }
        }
        
        const pingCommand = process.platform === 'win32' 
          ? `ping -n ${count} ${host}`
          : `ping -c ${count} ${host}`
        
        // Additional security validation for the command
        const commandValidation = SecurityValidator.validateCommand(pingCommand)
        if (!commandValidation.safe) {
          return {
            success: false,
            result: null,
            error: `Command validation failed: ${commandValidation.reason}`,
            executionTime: 0
          }
        }
        
        return await safeExec(pingCommand, 10000)
      }
    )
  }
}

// Process Information Tool
export const getProcessInfoTool: SystemTool = {
  id: 'get_process_info',
  name: 'Get Process Information',
  category: 'system_info',
  description: 'Gets information about running processes',
  parameters: [
    {
      name: 'processName',
      type: 'string',
      description: 'Name of process to search for (optional)',
      required: false
    },
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of processes to return (default: 20)',
      required: false,
      defaultValue: 20,
      validation: {
        min: 1,
        max: 100
      }
    }
  ],
  examples: [
    {
      description: 'Get all running processes',
      parameters: { limit: 10 },
      expectedResult: 'List of top 10 processes'
    },
    {
      description: 'Find Node.js processes',
      parameters: { processName: 'node' },
      expectedResult: 'List of Node.js processes'
    }
  ],
  security: LOW_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const limit = params.limit || 20
        const processName = params.processName
        
        // Validate process name to prevent injection
        if (processName && !/^[a-zA-Z0-9._-]+$/.test(processName)) {
          return {
            success: false,
            result: null,
            error: 'Invalid process name format',
            executionTime: 0
          }
        }
        
        let command: string
        
        if (process.platform === 'win32') {
          command = processName 
            ? `tasklist /FI "IMAGENAME eq ${processName}*" /FO CSV`
            : `tasklist /FO CSV`
        } else {
          command = processName
            ? `ps aux | grep ${processName} | grep -v grep`
            : `ps aux | head -n ${limit + 1}`
        }
        
        // Additional security validation for the command
        const commandValidation = SecurityValidator.validateCommand(command)
        if (!commandValidation.safe) {
          return {
            success: false,
            result: null,
            error: `Command validation failed: ${commandValidation.reason}`,
            executionTime: 0
          }
        }
        
        return await safeExec(command, 8000)
      }
    )
  }
}

// Import remote and service monitoring tools
import { remoteToolsRegistry } from './remoteTools'
import { serviceMonitoringRegistry } from './serviceMonitoring'
import { sshRemoteToolsRegistry } from './sshRemoteTools'

// Export all tools as a registry
export const systemToolsRegistry = new Map<string, SystemTool>([
  [getSystemInfoTool.id, getSystemInfoTool],
  [listFilesTool.id, listFilesTool],
  [readFileTool.id, readFileTool],
  [checkConnectivityTool.id, checkConnectivityTool],
  [getProcessInfoTool.id, getProcessInfoTool],
  // Add remote tools
  ...remoteToolsRegistry,
  // Add service monitoring tools
  ...serviceMonitoringRegistry,
  // Add SSH remote tools
  ...sshRemoteToolsRegistry
])

// Helper function to get tools by category
export function getToolsByCategory(category: string): SystemTool[] {
  return Array.from(systemToolsRegistry.values())
    .filter(tool => tool.category === category)
}

// Helper function to get tools by risk level
export function getToolsByRiskLevel(riskLevel: 'low' | 'medium' | 'high'): SystemTool[] {
  return Array.from(systemToolsRegistry.values())
    .filter(tool => tool.security.riskLevel === riskLevel)
}

console.log('🔧 [TOOLS] System tools registry initialized with tools:', Array.from(systemToolsRegistry.keys()))