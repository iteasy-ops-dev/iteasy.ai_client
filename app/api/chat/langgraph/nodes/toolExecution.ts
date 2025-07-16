import { ChatState, NodeResponse, ExecutionContext, ToolResult, SystemTool } from '../types'
import { systemToolsRegistry, getToolsByCategory } from '../tools/systemTools'
import { parseSSHConnectionInfo, hasSSHConnectionInfo, getSSHConnectionSummary } from '../tools/sshConnectionParser'

// Tool selection based on user message analysis
export function selectRelevantTools(userMessage: string, intent: string): SystemTool[] {
  const message = userMessage.toLowerCase()
  const selectedTools: SystemTool[] = []
  
  console.log('🔧 [TOOL_SELECTION] Analyzing message for tool needs:', userMessage.substring(0, 100))
  
  // Check for SSH connection information first (HIGHEST PRIORITY)
  const sshConnectionInfo = parseSSHConnectionInfo(userMessage)
  const hasSSHInfo = hasSSHConnectionInfo(userMessage)
  
  console.log('🔧 [TOOL_SELECTION] SSH connection analysis:', getSSHConnectionSummary(sshConnectionInfo))
  
  // Check for IP address patterns
  const ipPattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/
  const hasIPAddress = ipPattern.test(message)
  
  // SSH Remote Operations (HIGHEST PRIORITY when connection info available)
  if (sshConnectionInfo.hasValidConnection && 
      (message.includes('서버') || message.includes('server') || hasIPAddress)) {
    
    console.log('🔧 [TOOL_SELECTION] SSH connection info available - prioritizing SSH tools')
    
    // For detailed system information
    if (message.includes('시스템') || message.includes('system') || 
        message.includes('정보') || message.includes('info') ||
        message.includes('상세') || message.includes('detail') ||
        message.includes('상태') || message.includes('status')) {
      
      const sshTool = systemToolsRegistry.get('ssh_remote_system_info')
      if (sshTool) {
        selectedTools.push(sshTool)
        console.log('🔧 [TOOL_SELECTION] Selected: ssh_remote_system_info (with connection info)')
      }
    }
    
    // For specific commands
    if (message.includes('명령') || message.includes('command') || 
        message.includes('실행') || message.includes('execute')) {
      
      const cmdTool = systemToolsRegistry.get('ssh_remote_command')
      if (cmdTool) {
        selectedTools.push(cmdTool)
        console.log('🔧 [TOOL_SELECTION] Selected: ssh_remote_command (with connection info)')
      }
    }
    
    // If no SSH tools selected but we have connection info, default to system info
    if (selectedTools.length === 0) {
      const sshTool = systemToolsRegistry.get('ssh_remote_system_info')
      if (sshTool) {
        selectedTools.push(sshTool)
        console.log('🔧 [TOOL_SELECTION] Selected: ssh_remote_system_info (default with connection info)')
      }
    }
    
    // Early return to prevent fallback tools
    return selectedTools
  }
  
  // Remote server status check (FALLBACK for basic connectivity when no SSH info)
  else if (hasIPAddress || 
      message.includes('서버가 구동') || message.includes('서버 구동') || message.includes('server running') ||
      message.includes('서버 상태') || message.includes('server status') ||
      message.includes('서버가 작동') || message.includes('서버 작동') ||
      message.includes('서버가 살아') || message.includes('서버 응답') ||
      message.includes('서버 시스템') || message.includes('server system') ||
      (message.includes('서버') && (message.includes('확인') || message.includes('체크') || message.includes('check')))) {
    
    console.log('🔧 [TOOL_SELECTION] No SSH connection info - using basic connectivity tools')
    
    // If it contains URL pattern, use HTTP health check
    if (message.includes('http') || message.includes('url') || message.includes('web') || 
        message.includes('웹') || message.includes('사이트')) {
      const tool = systemToolsRegistry.get('http_health_check')
      if (tool) {
        selectedTools.push(tool)
        console.log('🔧 [TOOL_SELECTION] Selected: http_health_check (for server status)')
      }
    }
    // If it mentions specific port, use port check
    else if (message.includes('port') || message.includes('포트') || /:\d+/.test(message)) {
      const tool = systemToolsRegistry.get('check_port')
      if (tool) {
        selectedTools.push(tool)
        console.log('🔧 [TOOL_SELECTION] Selected: check_port (for server status)')
      }
    }
    // For server system information, use SSH remote tools
    else if (message.includes('시스템') || message.includes('system') || 
             message.includes('정보') || message.includes('info') ||
             message.includes('상세') || message.includes('detail')) {
      // Use SSH remote system info tool for detailed server inspection
      const sshTool = systemToolsRegistry.get('ssh_remote_system_info')
      if (sshTool) {
        selectedTools.push(sshTool)
        console.log('🔧 [TOOL_SELECTION] Selected: ssh_remote_system_info (for detailed server info)')
      }
      
      // Also try basic connectivity as fallback
      const pingTool = systemToolsRegistry.get('check_connectivity')
      if (pingTool) {
        selectedTools.push(pingTool)
        console.log('🔧 [TOOL_SELECTION] Selected: check_connectivity (as fallback)')
      }
    }
    // For general server status, use multi-server health or connectivity
    else {
      // Try ping first for basic connectivity
      const pingTool = systemToolsRegistry.get('check_connectivity')
      if (pingTool) {
        selectedTools.push(pingTool)
        console.log('🔧 [TOOL_SELECTION] Selected: check_connectivity (for server status)')
      }
      
      // Also try common ports
      const portTool = systemToolsRegistry.get('check_port')
      if (portTool) {
        selectedTools.push(portTool)
        console.log('🔧 [TOOL_SELECTION] Selected: check_port (for common ports)')
      }
    }
    
    // Early return to prevent other tools from being selected
    return selectedTools
  }
  
  // System information keywords
  if (message.includes('system') || message.includes('cpu') || message.includes('memory') || 
      message.includes('information') || message.includes('specs') || message.includes('정보') ||
      message.includes('시스템') || message.includes('메모리') || message.includes('사양')) {
    const tool = systemToolsRegistry.get('get_system_info')
    if (tool) selectedTools.push(tool)
    console.log('🔧 [TOOL_SELECTION] Selected: get_system_info')
  }
  
  // File operations keywords (exclude server context)
  if ((message.includes('file') || message.includes('directory') || message.includes('folder') ||
      message.includes('list') || message.includes('파일') || message.includes('디렉토리') ||
      message.includes('목록') || message.includes('ls') || message.includes('dir')) &&
      !message.includes('서버') && !message.includes('server')) {
    const tool = systemToolsRegistry.get('list_files')
    if (tool) selectedTools.push(tool)
    console.log('🔧 [TOOL_SELECTION] Selected: list_files')
  }
  
  // File reading keywords (exclude server context and be more specific)
  if ((message.includes('read file') || message.includes('cat ') || message.includes('파일 읽기') ||
      message.includes('파일 내용') || message.includes('파일 보여') ||
      (message.includes('content') && message.includes('file'))) &&
      !message.includes('서버') && !message.includes('server') && !hasIPAddress) {
    const tool = systemToolsRegistry.get('read_file')
    if (tool) selectedTools.push(tool)
    console.log('🔧 [TOOL_SELECTION] Selected: read_file')
  }
  
  // Network connectivity keywords
  if (message.includes('ping') || message.includes('network') || message.includes('connectivity') ||
      message.includes('connection') || message.includes('네트워크') || message.includes('연결') ||
      message.includes('접속') || message.includes('통신')) {
    const tool = systemToolsRegistry.get('check_connectivity')
    if (tool) selectedTools.push(tool)
    console.log('🔧 [TOOL_SELECTION] Selected: check_connectivity')
  }
  
  // Remote server monitoring keywords
  if (message.includes('server') || message.includes('remote') || message.includes('host') ||
      message.includes('서버') || message.includes('원격') || message.includes('호스트') ||
      message.includes('상태') || message.includes('구동') || message.includes('running')) {
    
    // Port check
    if (message.includes('port') || message.includes('포트') || message.includes('열림')) {
      const tool = systemToolsRegistry.get('check_port')
      if (tool) selectedTools.push(tool)
      console.log('🔧 [TOOL_SELECTION] Selected: check_port')
    }
    
    // HTTP health check
    if (message.includes('http') || message.includes('web') || message.includes('website') ||
        message.includes('웹') || message.includes('사이트') || message.includes('url')) {
      const tool = systemToolsRegistry.get('http_health_check')
      if (tool) selectedTools.push(tool)
      console.log('🔧 [TOOL_SELECTION] Selected: http_health_check')
    }
    
    // SSH connectivity
    if (message.includes('ssh') || message.includes('secure shell')) {
      const tool = systemToolsRegistry.get('ssh_connectivity')
      if (tool) selectedTools.push(tool)
      console.log('🔧 [TOOL_SELECTION] Selected: ssh_connectivity')
    }
    
    // Service discovery
    if (message.includes('service') || message.includes('discover') || message.includes('scan') ||
        message.includes('서비스') || message.includes('스캔') || message.includes('탐지')) {
      const tool = systemToolsRegistry.get('service_discovery')
      if (tool) selectedTools.push(tool)
      console.log('🔧 [TOOL_SELECTION] Selected: service_discovery')
    }
  }
  
  // Service status keywords
  if (message.includes('service status') || message.includes('systemctl') || message.includes('daemon') ||
      message.includes('서비스 상태') || message.includes('데몬') || message.includes('systemd')) {
    const tool = systemToolsRegistry.get('system_service_status')
    if (tool) selectedTools.push(tool)
    console.log('🔧 [TOOL_SELECTION] Selected: system_service_status')
  }
  
  // Monitoring and availability keywords
  if (message.includes('monitor') || message.includes('availability') || message.includes('uptime') ||
      message.includes('모니터') || message.includes('가용성') || message.includes('업타임') ||
      message.includes('health check') || message.includes('상태확인')) {
    const tool = systemToolsRegistry.get('network_service_availability')
    if (tool) selectedTools.push(tool)
    console.log('🔧 [TOOL_SELECTION] Selected: network_service_availability')
  }
  
  // Multiple servers keywords
  if (message.includes('multiple') || message.includes('all servers') || message.includes('cluster') ||
      message.includes('여러') || message.includes('모든 서버') || message.includes('클러스터')) {
    const tool = systemToolsRegistry.get('multi_server_health')
    if (tool) selectedTools.push(tool)
    console.log('🔧 [TOOL_SELECTION] Selected: multi_server_health')
  }
  
  // Process information keywords
  if (message.includes('process') || message.includes('running') || message.includes('ps') ||
      message.includes('task') || message.includes('프로세스') || message.includes('실행') ||
      message.includes('작업')) {
    const tool = systemToolsRegistry.get('get_process_info')
    if (tool) selectedTools.push(tool)
    console.log('🔧 [TOOL_SELECTION] Selected: get_process_info')
  }
  
  // If system engineering intent but no specific tools selected, add system info as default
  if (intent === 'system_engineering' && selectedTools.length === 0) {
    const tool = systemToolsRegistry.get('get_system_info')
    if (tool) {
      selectedTools.push(tool)
      console.log('🔧 [TOOL_SELECTION] Selected default for system engineering: get_system_info')
    }
  }
  
  console.log(`🔧 [TOOL_SELECTION] Total selected tools: ${selectedTools.length}`)
  return selectedTools
}

// Extract parameters from user message for specific tools
export function extractToolParameters(userMessage: string, tool: SystemTool): Record<string, any> {
  const message = userMessage.toLowerCase()
  const params: Record<string, any> = {}
  
  console.log(`🔧 [PARAM_EXTRACTION] Extracting parameters for tool: ${tool.id}`)
  
  switch (tool.id) {
    case 'get_system_info':
      // Check if user wants detailed information
      params.detailed = message.includes('detail') || message.includes('상세') || 
                       message.includes('전체') || message.includes('모든')
      break
      
    case 'list_files':
      // Extract path if mentioned
      const pathMatch = message.match(/(?:path|directory|dir|경로|디렉토리)\s*:?\s*([^\s]+)/)
      params.path = pathMatch ? pathMatch[1] : '.'
      
      // Check if detailed listing requested
      params.detailed = message.includes('detail') || message.includes('상세') ||
                       message.includes('-l') || message.includes('permissions')
      break
      
    case 'read_file':
      // Extract file path
      const fileMatch = message.match(/(?:file|파일)\s*:?\s*([^\s]+)/)
      if (fileMatch) {
        params.filePath = fileMatch[1]
      }
      
      // Extract line limit if specified
      const lineMatch = message.match(/(?:lines|줄)\s*:?\s*(\d+)/)
      if (lineMatch) {
        params.maxLines = parseInt(lineMatch[1])
      }
      break
      
    case 'check_connectivity':
      // Extract host to ping - prioritize IP addresses
      const ipMatch = message.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)
      if (ipMatch) {
        params.host = ipMatch[0]
        console.log(`🔧 [PARAM_EXTRACTION] Found IP address: ${params.host}`)
      } else {
        // Extract host from general patterns
        const hostMatch = message.match(/(?:ping|host|호스트|서버)\s*:?\s*([^\s]+)/)
        if (hostMatch) {
          params.host = hostMatch[1]
        } else {
          // Default to Google DNS if no host specified
          params.host = '8.8.8.8'
        }
      }
      
      // Extract ping count
      const countMatch = message.match(/(?:count|횟수)\s*:?\s*(\d+)/)
      if (countMatch) {
        params.count = parseInt(countMatch[1])
      }
      break
      
    case 'check_port':
      // Extract host and port - prioritize IP addresses
      const portIpMatch = message.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)
      if (portIpMatch) {
        params.host = portIpMatch[0]
        console.log(`🔧 [PARAM_EXTRACTION] Found IP address for port check: ${params.host}`)
      } else {
        // Extract host from general patterns
        const portHostMatch = message.match(/(?:host|호스트|server|서버)\s*:?\s*([^\s]+)/)
        if (portHostMatch) {
          params.host = portHostMatch[1]
        }
      }
      
      const portMatch = message.match(/(?:port|포트)\s*:?\s*(\d+)/)
      if (portMatch) {
        params.port = parseInt(portMatch[1])
      } else {
        // Try to extract port from host:port format
        const hostPortMatch = message.match(/([a-zA-Z0-9.-]+):(\d+)/)
        if (hostPortMatch) {
          params.host = hostPortMatch[1]
          params.port = parseInt(hostPortMatch[2])
        } else {
          // Default to common HTTP port for server status checks
          params.port = 80
          console.log(`🔧 [PARAM_EXTRACTION] No port specified, defaulting to: ${params.port}`)
        }
      }
      break
      
    case 'http_health_check':
      // Extract URL
      const urlMatch = message.match(/(https?:\/\/[^\s]+)/)
      if (urlMatch) {
        params.url = urlMatch[1]
      } else {
        // Try to construct URL from domain mention
        const domainMatch = message.match(/(?:domain|도메인|site|사이트)\s*:?\s*([^\s]+)/)
        if (domainMatch) {
          params.url = `https://${domainMatch[1]}`
        }
      }
      
      // Extract expected status
      const statusMatch = message.match(/(?:status|상태)\s*:?\s*(\d+)/)
      if (statusMatch) {
        params.expectedStatus = parseInt(statusMatch[1])
      }
      break
      
    case 'ssh_connectivity':
      // Extract host and port for SSH
      const sshHostMatch = message.match(/(?:ssh|host|호스트|server|서버)\s*:?\s*([^\s]+)/)
      if (sshHostMatch) {
        params.host = sshHostMatch[1]
      }
      
      const sshPortMatch = message.match(/(?:port|포트)\s*:?\s*(\d+)/)
      if (sshPortMatch) {
        params.port = parseInt(sshPortMatch[1])
      }
      break
      
    case 'service_discovery':
      // Extract hosts
      const hostsMatch = message.match(/(?:hosts?|호스트|servers?|서버)\s*:?\s*([^\s]+(?:\s*,\s*[^\s]+)*)/)
      if (hostsMatch) {
        params.hosts = hostsMatch[1].split(',').map(h => h.trim())
      }
      
      // Extract service type
      if (message.includes('web') || message.includes('웹')) params.serviceType = 'web'
      else if (message.includes('database') || message.includes('db') || message.includes('데이터베이스')) params.serviceType = 'database'
      else if (message.includes('ssh')) params.serviceType = 'ssh'
      else if (message.includes('docker')) params.serviceType = 'docker'
      else if (message.includes('kubernetes') || message.includes('k8s')) params.serviceType = 'kubernetes'
      break
      
    case 'system_service_status':
      // Extract service names
      const serviceMatch = message.match(/(?:service|서비스)\s*:?\s*([^\s]+(?:\s*,\s*[^\s]+)*)/)
      if (serviceMatch) {
        const services = serviceMatch[1].split(',').map(s => s.trim())
        if (services.length === 1) {
          params.serviceName = services[0]
        } else {
          params.services = services
        }
      }
      
      // Check if asking for all services
      if (message.includes('all') || message.includes('모든') || message.includes('전체')) {
        params.listAll = true
      }
      break
      
    case 'network_service_availability':
      // Extract targets from URL patterns
      const urlMatches = message.match(/(https?:\/\/[^\s]+)/g)
      if (urlMatches) {
        params.targets = urlMatches.map(url => ({ type: 'http', url }))
      }
      
      // Extract host:port patterns
      const hostPortMatches = message.match(/([a-zA-Z0-9.-]+):(\d+)/g)
      if (hostPortMatches && !params.targets) {
        params.targets = hostPortMatches.map(hp => {
          const [host, port] = hp.split(':')
          return { type: 'tcp', host, port: parseInt(port) }
        })
      }
      
      // Extract count
      const availabilityCountMatch = message.match(/(?:check|확인|count|횟수)\s*:?\s*(\d+)/)
      if (availabilityCountMatch) {
        params.count = parseInt(availabilityCountMatch[1])
      }
      break
      
    case 'multi_server_health':
      // Extract server list
      const serversMatch = message.match(/(?:servers?|서버)\s*:?\s*([^\s]+(?:\s*,\s*[^\s]+)*)/)
      if (serversMatch) {
        const serverList = serversMatch[1].split(',').map(s => s.trim())
        params.servers = serverList.map(server => {
          const hostPortMatch = server.match(/([^:]+):(\d+)/)
          if (hostPortMatch) {
            return { host: hostPortMatch[1], port: parseInt(hostPortMatch[2]) }
          } else {
            return { host: server, port: 80 } // Default to port 80
          }
        })
      }
      break
      
    case 'ssh_remote_system_info':
      // Use parsed SSH connection information
      const sshInfo = parseSSHConnectionInfo(userMessage)
      
      if (sshInfo.hasValidConnection) {
        params.host = sshInfo.host
        params.username = sshInfo.username
        params.password = sshInfo.password
        params.keyFile = sshInfo.keyFile
        params.port = sshInfo.port
        
        console.log(`🔧 [PARAM_EXTRACTION] Using parsed SSH connection: ${sshInfo.username}@${sshInfo.host}:${sshInfo.port}`)
      } else {
        // Fallback to manual extraction
        const sshIpMatch = message.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)
        if (sshIpMatch) {
          params.host = sshIpMatch[0]
        }
        
        const usernameMatch = message.match(/(?:user|username|사용자|유저)\s*:?\s*([^\s]+)/)
        if (usernameMatch) {
          params.username = usernameMatch[1]
        }
        
        console.log('⚠️ [PARAM_EXTRACTION] No complete SSH info - using fallback extraction')
      }
      
      // Determine command categories based on message content
      const commandCategories = []
      if (message.includes('시스템') || message.includes('system') || 
          message.includes('업타임') || message.includes('uptime') ||
          message.includes('가동시간') || message.includes('운영시간')) commandCategories.push('system_info')
      if (message.includes('리소스') || message.includes('resource') || message.includes('메모리') || message.includes('memory') || message.includes('cpu') ||
          message.includes('사용량') || message.includes('usage') || message.includes('사용률') || 
          message.includes('디스크') || message.includes('disk') || message.includes('성능') || message.includes('performance')) commandCategories.push('resources')
      if (message.includes('프로세스') || message.includes('process')) commandCategories.push('processes')
      if (message.includes('서비스') || message.includes('service')) commandCategories.push('services')
      if (message.includes('네트워크') || message.includes('network')) commandCategories.push('network')
      if (message.includes('로그') || message.includes('log')) commandCategories.push('logs')
      if (message.includes('디스크') || message.includes('disk') || message.includes('filesystem')) commandCategories.push('filesystem')
      
      // If no specific categories, default to system_info and resources
      if (commandCategories.length === 0) {
        commandCategories.push('system_info', 'resources')
      }
      
      params.commands = commandCategories
      break
      
    case 'ssh_remote_command':
      // Use parsed SSH connection information
      const cmdSshInfo = parseSSHConnectionInfo(userMessage)
      
      if (cmdSshInfo.hasValidConnection) {
        params.host = cmdSshInfo.host
        params.username = cmdSshInfo.username
        params.password = cmdSshInfo.password
        params.keyFile = cmdSshInfo.keyFile
        params.port = cmdSshInfo.port
        
        console.log(`🔧 [PARAM_EXTRACTION] Using parsed SSH connection for command: ${cmdSshInfo.username}@${cmdSshInfo.host}:${cmdSshInfo.port}`)
      } else {
        // Fallback to manual extraction
        const cmdSshIpMatch = message.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/)
        if (cmdSshIpMatch) {
          params.host = cmdSshIpMatch[0]
        }
        
        const cmdUsernameMatch = message.match(/(?:user|username|사용자|유저)\s*:?\s*([^\s]+)/)
        if (cmdUsernameMatch) {
          params.username = cmdUsernameMatch[1]
        }
      }
      
      // Extract specific command if mentioned
      const cmdMatch = message.match(/(?:command|명령|cmd)\s*:?\s*"([^"]+)"/)
      if (cmdMatch) {
        params.command = cmdMatch[1]
      } else {
        // Default to a safe command
        params.command = 'uname -a'
      }
      break
      
    case 'get_process_info':
      // Extract process name if specified
      const processMatch = message.match(/(?:process|프로세스)\s*:?\s*([^\s]+)/)
      if (processMatch) {
        params.processName = processMatch[1]
      }
      
      // Extract limit
      const limitMatch = message.match(/(?:limit|제한|개)\s*:?\s*(\d+)/)
      if (limitMatch) {
        params.limit = parseInt(limitMatch[1])
      }
      break
  }
  
  console.log(`🔧 [PARAM_EXTRACTION] Extracted parameters:`, params)
  return params
}

// Tool execution node
export async function toolExecutionNode(
  state: ChatState
): Promise<NodeResponse> {
  console.log('🔧 [TOOL_EXECUTION] === Tool Execution Node ===')
  
  // Select relevant tools based on user message and intent
  const selectedTools = selectRelevantTools(state.lastUserMessage, state.intent || 'general')
  
  if (selectedTools.length === 0) {
    console.log('🔧 [TOOL_EXECUTION] No tools selected for execution')
    return {
      requiresToolExecution: false,
      toolExecutionResults: [],
      selectedTools: []
    }
  }
  
  console.log(`🔧 [TOOL_EXECUTION] Executing ${selectedTools.length} tools...`)
  
  // Create execution context
  const executionContext: ExecutionContext = {
    environment: 'development', // TODO: Make this configurable
    permissions: ['read-only'], // Start with read-only permissions
    sessionId: Date.now().toString(), // TODO: Use proper session ID
    timestamp: new Date()
  }
  
  // Execute selected tools
  const toolResults: ToolResult[] = []
  const toolIds: string[] = []
  
  for (const tool of selectedTools) {
    try {
      console.log(`🔧 [TOOL_EXECUTION] Executing tool: ${tool.id}`)
      
      // Extract parameters for this specific tool
      const params = extractToolParameters(state.lastUserMessage, tool)
      
      // Validate parameters (basic validation)
      if (tool.validate) {
        const validation = tool.validate(params)
        if (!validation.valid) {
          console.error(`❌ [TOOL_EXECUTION] Validation failed for ${tool.id}:`, validation.errors)
          toolResults.push({
            success: false,
            result: null,
            error: `Parameter validation failed: ${validation.errors?.join(', ')}`,
            executionTime: 0
          })
          continue
        }
      }
      
      // Execute the tool
      const result = await tool.execute(params, executionContext)
      toolResults.push(result)
      toolIds.push(tool.id)
      
      if (result.success) {
        console.log(`✅ [TOOL_EXECUTION] Tool ${tool.id} executed successfully in ${result.executionTime}ms`)
      } else {
        console.error(`❌ [TOOL_EXECUTION] Tool ${tool.id} failed:`, result.error)
      }
      
    } catch (error: any) {
      console.error(`❌ [TOOL_EXECUTION] Unexpected error executing ${tool.id}:`, error.message)
      toolResults.push({
        success: false,
        result: null,
        error: `Unexpected error: ${error.message}`,
        executionTime: 0
      })
    }
  }
  
  console.log(`🔧 [TOOL_EXECUTION] Completed execution of ${toolResults.length} tools`)
  console.log(`🔧 [TOOL_EXECUTION] Successful executions: ${toolResults.filter(r => r.success).length}`)
  console.log(`🔧 [TOOL_EXECUTION] Failed executions: ${toolResults.filter(r => !r.success).length}`)
  
  return {
    requiresToolExecution: true,
    toolExecutionResults: toolResults,
    selectedTools: toolIds,
    executionContext,
    availableTools: selectedTools
  }
}