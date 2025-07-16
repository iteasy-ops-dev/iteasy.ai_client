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

// Security policy for SSH remote operations
const SSH_REMOTE_POLICY: SecurityPolicy = {
  riskLevel: 'high',
  requiresConfirmation: true,
  allowedContexts: [],
  restrictions: ['requires SSH key authentication', 'read-only operations preferred'],
  auditRequired: true
}

const SSH_MEDIUM_RISK_POLICY: SecurityPolicy = {
  riskLevel: 'medium',
  requiresConfirmation: false,
  allowedContexts: [],
  restrictions: ['safe read-only commands only'],
  auditRequired: true
}

// Safe remote commands that can be executed
const SAFE_REMOTE_COMMANDS = {
  // System information
  system_info: [
    'uname -a',
    'uptime',      // Move uptime to higher priority
    'cat /etc/os-release',
    'whoami',
    'pwd',
    'date',
    'hostname',
    'id'
  ],
  
  // Resource monitoring
  resources: [
    'free -h',
    'df -h',
    'lscpu',
    'cat /proc/meminfo | head -10',
    'cat /proc/loadavg',
    'iostat 1 1',
    'vmstat 1 1'
  ],
  
  // Process information
  processes: [
    'ps aux | head -20',
    'ps -ef | head -20',
    'top -b -n 1 | head -20',
    'pstree -p | head -20'
  ],
  
  // Network information
  network: [
    'netstat -tuln',
    'ss -tuln',
    'ip addr show',
    'ip route show',
    'cat /etc/resolv.conf'
  ],
  
  // Service status
  services: [
    'systemctl status',
    'systemctl list-units --type=service --state=running',
    'systemctl list-units --type=service --state=failed',
    'service --status-all'
  ],
  
  // Log inspection (safe)
  logs: [
    'tail -20 /var/log/syslog',
    'tail -20 /var/log/messages',
    'journalctl --no-pager -n 20',
    'dmesg | tail -20'
  ],
  
  // Disk and file system
  filesystem: [
    'ls -la /',
    'ls -la /home',
    'ls -la /var/log',
    'du -sh /var/log/*',
    'find /var/log -name "*.log" -type f | head -10'
  ]
}

// SSH Remote System Information Tool
export const sshRemoteSystemInfoTool: SystemTool = {
  id: 'ssh_remote_system_info',
  name: 'SSH Remote System Information',
  category: 'system_info',
  description: 'Executes safe system information commands on remote servers via SSH',
  parameters: [
    {
      name: 'host',
      type: 'string',
      description: 'Remote host IP address or hostname',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9.-]+$'
      }
    },
    {
      name: 'username',
      type: 'string',
      description: 'SSH username (default: current user)',
      required: false,
      validation: {
        pattern: '^[a-zA-Z0-9._-]+$'
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
      name: 'keyFile',
      type: 'string',
      description: 'Path to SSH private key file',
      required: false,
      validation: {
        pattern: '^[a-zA-Z0-9/._-]+$'
      }
    },
    {
      name: 'commands',
      type: 'array',
      description: 'Specific commands to run (must be from safe command list)',
      required: false
    }
  ],
  examples: [
    {
      description: 'Get basic system info from remote server',
      parameters: { 
        host: '10.10.30.214', 
        username: 'admin',
        commands: ['system_info']
      },
      expectedResult: 'System information from remote server'
    }
  ],
  security: SSH_MEDIUM_RISK_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔧 [SSH_REMOTE] Connecting to ${params.host} for system information`)
          
          // 필수 SSH 연결 정보 검증
          if (!params.host || params.host.trim() === '') {
            throw new Error('SSH host is required')
          }
          
          if (!params.username || params.username.trim() === '') {
            throw new Error('SSH username is required')
          }
          
          if (!params.password && !params.keyFile) {
            throw new Error('SSH authentication required: password or keyFile must be provided')
          }
          
          // Validate host format
          if (!/^[a-zA-Z0-9.-]+$/.test(params.host)) {
            throw new Error('Invalid host format')
          }
          
          const host = params.host
          const username = params.username || process.env.USER || 'root'
          const port = params.port || 22
          // const keyFile = params.keyFile
          
          // Determine which commands to run
          let commandsToRun: string[] = []
          
          if (params.commands && Array.isArray(params.commands)) {
            // Handle both command categories and direct commands
            for (const cmd of params.commands) {
              // Check if it's a category name
              if (SAFE_REMOTE_COMMANDS[cmd as keyof typeof SAFE_REMOTE_COMMANDS]) {
                console.log(`🔧 [SSH_REMOTE] Using category: ${cmd}`)
                commandsToRun.push(...SAFE_REMOTE_COMMANDS[cmd as keyof typeof SAFE_REMOTE_COMMANDS])
              } 
              // Check if it's a direct command from safe command lists
              else {
                const allSafeCommands = Object.values(SAFE_REMOTE_COMMANDS).flat()
                if (allSafeCommands.includes(cmd)) {
                  console.log(`🎯 [SSH_REMOTE] Using specific command: ${cmd}`)
                  commandsToRun.push(cmd)
                } else {
                  console.log(`⚠️ [SSH_REMOTE] Unsafe command rejected: ${cmd}`)
                }
              }
            }
          } else {
            // Default to basic system info including usage metrics
            commandsToRun = [
              'uname -a',
              'uptime',  // System uptime
              'free -h', // Memory usage
              'df -h /', // Disk usage for root
              'ps aux | head -10'  // Top processes
            ]
          }
          
          if (commandsToRun.length === 0) {
            commandsToRun = ['uname -a', 'uptime', 'free -h']
          }
          
          // Intelligent command limiting based on context
          const MAX_COMMANDS = {
            specific_commands: 5,    // 특정 명령어 직접 실행
            single_category: 8,      // 단일 카테고리 요청
            multiple_categories: 15, // 여러 카테고리 요청  
            emergency_max: 25        // 절대 최대값
          }
          
          const categoryCount = params.commands ? params.commands.length : 1
          const hasDirectCommands = params.commands && params.commands.some((cmd: string) => 
            !SAFE_REMOTE_COMMANDS[cmd as keyof typeof SAFE_REMOTE_COMMANDS]
          )
          
          let maxCommands
          if (hasDirectCommands && commandsToRun.length <= 3) {
            // 특정 명령어 직접 실행이고 개수가 적으면 제한 없음
            maxCommands = MAX_COMMANDS.specific_commands
            console.log(`🎯 [SSH_REMOTE] Specific command execution - no limiting needed`)
          } else {
            maxCommands = categoryCount === 1 
              ? MAX_COMMANDS.single_category 
              : categoryCount <= 3
                ? MAX_COMMANDS.multiple_categories
                : MAX_COMMANDS.emergency_max
          }
              
          if (commandsToRun.length > maxCommands) {
            console.log(`🔧 [SSH_REMOTE] Limiting commands from ${commandsToRun.length} to ${maxCommands} (${categoryCount} categories requested)`)
            commandsToRun = commandsToRun.slice(0, maxCommands)
          }
          
          console.log(`🔧 [SSH_REMOTE] Will execute ${commandsToRun.length} commands: ${commandsToRun.join(', ')}`)
          
          // Determine authentication method
          const keyFile = params.keyFile
          const password = params.password
          
          if (!password && !keyFile) {
            throw new Error('SSH connection requires either password or SSH key file')
          }
          
          // Build SSH command based on authentication method
          let sshCommand = ''
          
          if (password) {
            // Use sshpass for password authentication (if available)
            // Note: sshpass needs to be installed on the system
            console.log('🔐 [SSH_REMOTE] Using password authentication')
            sshCommand = `sshpass -p '${password}' ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -o PasswordAuthentication=yes`
          } else if (keyFile) {
            // Use SSH key authentication
            console.log('🔐 [SSH_REMOTE] Using SSH key authentication')
            const keyValidation = SecurityValidator.validateFilePath(keyFile)
            if (!keyValidation.safe) {
              throw new Error(`SSH key file validation failed: ${keyValidation.reason}`)
            }
            sshCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -i "${keyFile}"`
          }
          
          if (port !== 22) {
            sshCommand += ` -p ${port}`
          }
          
          sshCommand += ` ${username}@${host}`
          
          const results: Array<{
            command: string
            output: string
            success: boolean
            error?: string
          }> = []
          
          // Execute commands one by one
          for (const cmd of commandsToRun) {
            try {
              const fullCommand = `${sshCommand} "${cmd}"`
              
              // Validate the SSH command
              const cmdValidation = SecurityValidator.validateCommand(fullCommand)
              if (!cmdValidation.safe) {
                results.push({
                  command: cmd,
                  output: '',
                  success: false,
                  error: `Command validation failed: ${cmdValidation.reason}`
                })
                continue
              }
              
              console.log(`🔧 [SSH_REMOTE] Executing: ${cmd}`)
              
              const { stdout, stderr } = await execAsync(fullCommand, {
                timeout: 15000,
                encoding: 'utf8'
              })
              
              results.push({
                command: cmd,
                output: stdout.trim(),
                success: true,
                error: stderr ? stderr.trim() : undefined
              })
              
            } catch (error: any) {
              console.error(`❌ [SSH_REMOTE] Command failed: ${cmd} - ${error.message}`)
              results.push({
                command: cmd,
                output: '',
                success: false,
                error: error.message
              })
            }
          }
          
          const successfulCommands = results.filter(r => r.success).length
          
          return {
            success: true,
            result: {
              host: host,
              username: username,
              port: port,
              commandResults: results,
              summary: {
                totalCommands: results.length,
                successfulCommands: successfulCommands,
                failedCommands: results.length - successfulCommands
              },
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

// SSH Remote Command Execution Tool (more flexible but higher risk)
export const sshRemoteCommandTool: SystemTool = {
  id: 'ssh_remote_command',
  name: 'SSH Remote Command Execution',
  category: 'system_info',
  description: 'Executes specific safe commands on remote servers via SSH',
  parameters: [
    {
      name: 'host',
      type: 'string',
      description: 'Remote host IP address or hostname',
      required: true,
      validation: {
        pattern: '^[a-zA-Z0-9.-]+$'
      }
    },
    {
      name: 'command',
      type: 'string',
      description: 'Command to execute (must be in safe command list)',
      required: true
    },
    {
      name: 'username',
      type: 'string',
      description: 'SSH username',
      required: false,
      validation: {
        pattern: '^[a-zA-Z0-9._-]+$'
      }
    },
    {
      name: 'port',
      type: 'number',
      description: 'SSH port (default: 22)',
      required: false,
      defaultValue: 22
    }
  ],
  examples: [
    {
      description: 'Check disk usage on remote server',
      parameters: { 
        host: '10.10.30.214', 
        command: 'df -h',
        username: 'admin'
      },
      expectedResult: 'Disk usage information'
    }
  ],
  security: SSH_REMOTE_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔧 [SSH_COMMAND] Executing "${params.command}" on ${params.host}`)
          
          // Validate command against safe command list
          const allSafeCommands = Object.values(SAFE_REMOTE_COMMANDS).flat()
          const isCommandSafe = allSafeCommands.includes(params.command)
          
          if (!isCommandSafe) {
            throw new Error(`Command "${params.command}" is not in the safe command list`)
          }
          
          const host = params.host
          const username = params.username || process.env.USER || 'root'
          const port = params.port || 22
          const command = params.command
          
          // Build and validate SSH command
          const sshCommand = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no -p ${port} ${username}@${host} "${command}"`
          
          const cmdValidation = SecurityValidator.validateCommand(sshCommand)
          if (!cmdValidation.safe) {
            throw new Error(`SSH command validation failed: ${cmdValidation.reason}`)
          }
          
          const { stdout, stderr } = await execAsync(sshCommand, {
            timeout: 30000,
            encoding: 'utf8'
          })
          
          return {
            success: true,
            result: {
              host: host,
              command: command,
              output: stdout.trim(),
              error: stderr ? stderr.trim() : null,
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

// Export SSH remote tools
export const sshRemoteToolsRegistry = new Map<string, SystemTool>([
  [sshRemoteSystemInfoTool.id, sshRemoteSystemInfoTool],
  [sshRemoteCommandTool.id, sshRemoteCommandTool]
])

console.log('🔐 [SSH_REMOTE_TOOLS] SSH remote execution tools initialized:', Array.from(sshRemoteToolsRegistry.keys()))