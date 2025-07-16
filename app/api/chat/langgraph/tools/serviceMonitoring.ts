import { exec } from 'child_process'
import { promisify } from 'util'
import * as net from 'net'
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

// Security policy for service monitoring
const SERVICE_MONITORING_POLICY: SecurityPolicy = {
  riskLevel: 'medium',
  requiresConfirmation: false,
  allowedContexts: [],
  restrictions: ['read-only service monitoring'],
  auditRequired: true
}

// Common service ports mapping
const COMMON_SERVICES = {
  'web': [80, 443, 8080, 8443, 3000, 5000, 8000],
  'database': [3306, 5432, 27017, 6379, 1433, 5984],
  'ssh': [22],
  'ftp': [21, 22],
  'mail': [25, 110, 143, 993, 995],
  'dns': [53],
  'ldap': [389, 636],
  'messaging': [5672, 15672, 61616, 9092],
  'monitoring': [9090, 3000, 8086, 9200, 5601],
  'cache': [6379, 11211, 8080],
  'docker': [2375, 2376, 2377],
  'kubernetes': [6443, 8080, 10250, 10255, 30000]
}

// Helper function to scan multiple ports
async function scanPorts(host: string, ports: number[], timeout: number = 3000): Promise<{
  host: string
  results: Array<{
    port: number
    open: boolean
    service?: string
    responseTime?: number
    error?: string
  }>
}> {
  console.log(`🔍 [PORT_SCAN] Scanning ${ports.length} ports on ${host}`)
  
  const results = await Promise.all(
    ports.map(async (port) => {
      return new Promise<{
        port: number
        open: boolean
        service?: string
        responseTime?: number
        error?: string
      }>((resolve) => {
        const startTime = Date.now()
        const socket = new net.Socket()
        
        const cleanup = () => {
          socket.destroy()
        }
        
        const onError = (error: any) => {
          cleanup()
          resolve({
            port,
            open: false,
            error: error.message,
            responseTime: Date.now() - startTime
          })
        }
        
        const onTimeout = () => {
          cleanup()
          resolve({
            port,
            open: false,
            error: 'timeout',
            responseTime: Date.now() - startTime
          })
        }
        
        socket.setTimeout(timeout)
        socket.once('error', onError)
        socket.once('timeout', onTimeout)
        socket.once('connect', () => {
          cleanup()
          resolve({
            port,
            open: true,
            service: getServiceName(port),
            responseTime: Date.now() - startTime
          })
        })
        
        socket.connect(port, host)
      })
    })
  )
  
  return { host, results }
}

// Helper function to identify service by port
function getServiceName(port: number): string {
  const serviceMap: Record<number, string> = {
    22: 'SSH',
    23: 'Telnet',
    25: 'SMTP',
    53: 'DNS',
    80: 'HTTP',
    110: 'POP3',
    143: 'IMAP',
    443: 'HTTPS',
    993: 'IMAPS',
    995: 'POP3S',
    1433: 'MS SQL',
    3306: 'MySQL',
    3389: 'RDP',
    5432: 'PostgreSQL',
    5984: 'CouchDB',
    6379: 'Redis',
    8080: 'HTTP Alt',
    8443: 'HTTPS Alt',
    9200: 'Elasticsearch',
    27017: 'MongoDB'
  }
  
  return serviceMap[port] || 'Unknown'
}

// Service discovery tool
export const serviceDiscoveryTool: SystemTool = {
  id: 'service_discovery',
  name: 'Service Discovery',
  category: 'monitoring',
  description: 'Discovers running services on specified hosts by scanning common ports',
  parameters: [
    {
      name: 'hosts',
      type: 'array',
      description: 'Array of hosts to scan',
      required: true
    },
    {
      name: 'serviceType',
      type: 'string',
      description: 'Type of services to scan for (web, database, ssh, etc.)',
      required: false,
      validation: {
        enum: ['web', 'database', 'ssh', 'ftp', 'mail', 'dns', 'ldap', 'messaging', 'monitoring', 'cache', 'docker', 'kubernetes', 'all']
      }
    },
    {
      name: 'customPorts',
      type: 'array',
      description: 'Custom port numbers to scan',
      required: false
    },
    {
      name: 'timeout',
      type: 'number',
      description: 'Connection timeout per port in milliseconds (default: 3000)',
      required: false,
      defaultValue: 3000,
      validation: {
        min: 1000,
        max: 10000
      }
    }
  ],
  examples: [
    {
      description: 'Scan for web services',
      parameters: { hosts: ['web1.example.com', 'web2.example.com'], serviceType: 'web' },
      expectedResult: 'List of discovered web services'
    },
    {
      description: 'Custom port scan',
      parameters: { hosts: ['server.example.com'], customPorts: [8080, 9090, 3000] },
      expectedResult: 'Status of custom ports'
    }
  ],
  security: SERVICE_MONITORING_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔍 [SERVICE_DISCOVERY] Starting service discovery`)
          
          if (!Array.isArray(params.hosts)) {
            throw new Error('Hosts parameter must be an array')
          }
          
          // Validate hosts
          for (const host of params.hosts) {
            if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
              throw new Error(`Invalid host format: ${host}`)
            }
          }
          
          // Determine ports to scan
          let portsToScan: number[] = []
          
          if (params.customPorts && Array.isArray(params.customPorts)) {
            portsToScan = params.customPorts
          } else {
            const serviceType = params.serviceType || 'web'
            if (serviceType === 'all') {
              portsToScan = Object.values(COMMON_SERVICES).flat()
            } else {
              portsToScan = COMMON_SERVICES[serviceType as keyof typeof COMMON_SERVICES] || COMMON_SERVICES.web
            }
          }
          
          // Remove duplicates and sort
          portsToScan = [...new Set(portsToScan)].sort((a, b) => a - b)
          
          console.log(`🔍 [SERVICE_DISCOVERY] Scanning ${portsToScan.length} ports on ${params.hosts.length} hosts`)
          
          // Scan all hosts in parallel
          const scanResults = await Promise.all(
            params.hosts.map((host: string) => 
              scanPorts(host, portsToScan, params.timeout || 3000)
            )
          )
          
          // Summarize results
          const summary = {
            totalHosts: params.hosts.length,
            totalPorts: portsToScan.length,
            totalChecks: params.hosts.length * portsToScan.length,
            openPorts: scanResults.reduce((total, hostResult) => 
              total + hostResult.results.filter(r => r.open).length, 0
            ),
            discoveredServices: scanResults.reduce((services, hostResult) => {
              hostResult.results.forEach(result => {
                if (result.open && result.service) {
                  if (!services[result.service]) {
                    services[result.service] = []
                  }
                  services[result.service].push(`${hostResult.host}:${result.port}`)
                }
              })
              return services
            }, {} as Record<string, string[]>)
          }
          
          return {
            success: true,
            result: {
              summary,
              hosts: scanResults,
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

// System service status check (for local system)
export const systemServiceStatusTool: SystemTool = {
  id: 'system_service_status',
  name: 'System Service Status',
  category: 'system_info',
  description: 'Checks the status of system services (systemd, service, etc.)',
  parameters: [
    {
      name: 'services',
      type: 'array',
      description: 'Array of service names to check',
      required: false
    },
    {
      name: 'serviceName',
      type: 'string',
      description: 'Single service name to check',
      required: false,
      validation: {
        pattern: '^[a-zA-Z0-9._-]+$'
      }
    },
    {
      name: 'listAll',
      type: 'boolean',
      description: 'List all services (default: false)',
      required: false,
      defaultValue: false
    }
  ],
  examples: [
    {
      description: 'Check specific services',
      parameters: { services: ['nginx', 'mysql', 'redis'] },
      expectedResult: 'Status of specified services'
    },
    {
      description: 'Check single service',
      parameters: { serviceName: 'docker' },
      expectedResult: 'Detailed status of docker service'
    }
  ],
  security: SERVICE_MONITORING_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔍 [SERVICE_STATUS] Checking system service status`)
          
          let servicesToCheck: string[] = []
          
          if (params.serviceName) {
            // Validate service name
            if (!/^[a-zA-Z0-9._-]+$/.test(params.serviceName)) {
              throw new Error('Invalid service name format')
            }
            servicesToCheck = [params.serviceName]
          } else if (params.services && Array.isArray(params.services)) {
            // Validate all service names
            for (const service of params.services) {
              if (!/^[a-zA-Z0-9._-]+$/.test(service)) {
                throw new Error(`Invalid service name format: ${service}`)
              }
            }
            servicesToCheck = params.services
          } else if (params.listAll) {
            // Get list of all services
            const listCommand = 'systemctl list-units --type=service --no-pager --no-legend'
            const commandValidation = SecurityValidator.validateCommand(listCommand)
            if (!commandValidation.safe) {
              throw new Error(`Command validation failed: ${commandValidation.reason}`)
            }
            
            const { stdout } = await execAsync(listCommand)
            servicesToCheck = stdout
              .split('\n')
              .filter(line => line.trim())
              .map(line => line.split(/\s+/)[0])
              .filter(name => name && name.endsWith('.service'))
              .map(name => name.replace('.service', ''))
              .slice(0, 20) // Limit to 20 services to avoid overwhelming output
          }
          
          if (servicesToCheck.length === 0) {
            throw new Error('No services specified to check')
          }
          
          // Check each service
          const serviceResults = await Promise.all(
            servicesToCheck.map(async (serviceName) => {
              try {
                const statusCommand = `systemctl status ${serviceName} --no-pager -l`
                const isActiveCommand = `systemctl is-active ${serviceName}`
                const isEnabledCommand = `systemctl is-enabled ${serviceName}`
                
                // Validate commands
                for (const cmd of [statusCommand, isActiveCommand, isEnabledCommand]) {
                  const validation = SecurityValidator.validateCommand(cmd)
                  if (!validation.safe) {
                    throw new Error(`Command validation failed: ${validation.reason}`)
                  }
                }
                
                const [statusResult, activeResult, enabledResult] = await Promise.all([
                  execAsync(statusCommand).catch(e => ({ stdout: '', stderr: e.message })),
                  execAsync(isActiveCommand).catch(e => ({ stdout: 'unknown', stderr: e.message })),
                  execAsync(isEnabledCommand).catch(e => ({ stdout: 'unknown', stderr: e.message }))
                ])
                
                // Parse status output
                const statusLines = statusResult.stdout.split('\n')
                const loadedLine = statusLines.find(line => line.includes('Loaded:'))
                const activeLine = statusLines.find(line => line.includes('Active:'))
                
                return {
                  name: serviceName,
                  active: activeResult.stdout.trim(),
                  enabled: enabledResult.stdout.trim(),
                  loaded: loadedLine ? loadedLine.trim() : 'unknown',
                  status: activeLine ? activeLine.trim() : 'unknown',
                  error: statusResult.stderr || null
                }
              } catch (error: any) {
                return {
                  name: serviceName,
                  active: 'error',
                  enabled: 'error',
                  loaded: 'error',
                  status: 'error',
                  error: error.message
                }
              }
            })
          )
          
          // Summarize results
          const summary = {
            totalServices: serviceResults.length,
            activeServices: serviceResults.filter(s => s.active === 'active').length,
            inactiveServices: serviceResults.filter(s => s.active === 'inactive').length,
            failedServices: serviceResults.filter(s => s.active === 'failed').length,
            enabledServices: serviceResults.filter(s => s.enabled === 'enabled').length
          }
          
          return {
            success: true,
            result: {
              summary,
              services: serviceResults,
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

// Network service availability check
export const networkServiceAvailabilityTool: SystemTool = {
  id: 'network_service_availability',
  name: 'Network Service Availability',
  category: 'monitoring',
  description: 'Comprehensive availability check for network services including response time monitoring',
  parameters: [
    {
      name: 'targets',
      type: 'array',
      description: 'Array of service targets to monitor',
      required: true
    },
    {
      name: 'interval',
      type: 'number',
      description: 'Check interval in seconds (default: 1)',
      required: false,
      defaultValue: 1,
      validation: {
        min: 1,
        max: 60
      }
    },
    {
      name: 'count',
      type: 'number',
      description: 'Number of checks to perform (default: 3)',
      required: false,
      defaultValue: 3,
      validation: {
        min: 1,
        max: 10
      }
    }
  ],
  examples: [
    {
      description: 'Monitor web services availability',
      parameters: {
        targets: [
          { type: 'http', url: 'https://example.com' },
          { type: 'tcp', host: 'db.example.com', port: 3306 }
        ],
        count: 5
      },
      expectedResult: 'Availability statistics with response times'
    }
  ],
  security: SERVICE_MONITORING_POLICY,
  
  async execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult> {
    return await secureToolExecution(
      this,
      params,
      context,
      async () => {
        const startTime = Date.now()
        
        try {
          console.log(`🔍 [AVAILABILITY] Monitoring service availability`)
          
          if (!Array.isArray(params.targets)) {
            throw new Error('Targets parameter must be an array')
          }
          
          const interval = (params.interval || 1) * 1000
          const count = params.count || 3
          
          const results = []
          
          // Perform multiple checks for each target
          for (let i = 0; i < count; i++) {
            console.log(`🔍 [AVAILABILITY] Check ${i + 1}/${count}`)
            
            const checkResults = await Promise.all(
              params.targets.map(async (target: any) => {
                const checkStartTime = Date.now()
                
                try {
                  if (target.type === 'http' || target.type === 'https') {
                    // HTTP/HTTPS check
                    const url = target.url
                    if (!/^https?:\/\/[a-zA-Z0-9.-]+(:[0-9]+)?(\/.*)?$/.test(url)) {
                      throw new Error('Invalid URL format')
                    }
                    
                    // Simplified HTTP check for monitoring
                    const response = await fetch(url, {
                      method: 'HEAD',
                      timeout: 10000
                    }).catch(e => ({ ok: false, status: 0, error: e.message }))
                    
                    return {
                      target: url,
                      type: 'http',
                      available: response.ok,
                      responseTime: Date.now() - checkStartTime,
                      statusCode: response.status || 0,
                      error: !response.ok ? (response.error || `HTTP ${response.status}`) : null
                    }
                  } else if (target.type === 'tcp') {
                    // TCP port check
                    const host = target.host
                    const port = target.port
                    
                    if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
                      throw new Error('Invalid host format')
                    }
                    
                    const result = await new Promise<{ reachable: boolean; error?: string }>((resolve) => {
                      const socket = new net.Socket()
                      const timeout = setTimeout(() => {
                        socket.destroy()
                        resolve({ reachable: false, error: 'timeout' })
                      }, 5000)
                      
                      socket.once('connect', () => {
                        clearTimeout(timeout)
                        socket.destroy()
                        resolve({ reachable: true })
                      })
                      
                      socket.once('error', (error) => {
                        clearTimeout(timeout)
                        resolve({ reachable: false, error: error.message })
                      })
                      
                      socket.connect(port, host)
                    })
                    
                    return {
                      target: `${host}:${port}`,
                      type: 'tcp',
                      available: result.reachable,
                      responseTime: Date.now() - checkStartTime,
                      error: result.error
                    }
                  } else {
                    throw new Error(`Unsupported target type: ${target.type}`)
                  }
                } catch (error: any) {
                  return {
                    target: target.url || `${target.host}:${target.port}`,
                    type: target.type,
                    available: false,
                    responseTime: Date.now() - checkStartTime,
                    error: error.message
                  }
                }
              })
            )
            
            results.push({
              checkNumber: i + 1,
              timestamp: new Date().toISOString(),
              results: checkResults
            })
            
            // Wait for interval before next check (except for last check)
            if (i < count - 1) {
              await new Promise(resolve => setTimeout(resolve, interval))
            }
          }
          
          // Calculate availability statistics
          const statistics = params.targets.map((target: any, targetIndex: number) => {
            const targetResults = results.map(r => r.results[targetIndex])
            const availableChecks = targetResults.filter(r => r.available).length
            const totalChecks = targetResults.length
            const avgResponseTime = targetResults
              .filter(r => r.available)
              .reduce((sum, r) => sum + r.responseTime, 0) / (availableChecks || 1)
            
            return {
              target: target.url || `${target.host}:${target.port}`,
              type: target.type,
              availability: (availableChecks / totalChecks) * 100,
              totalChecks,
              successfulChecks: availableChecks,
              averageResponseTime: Math.round(avgResponseTime),
              status: availableChecks === totalChecks ? 'healthy' : 
                      availableChecks > 0 ? 'degraded' : 'down'
            }
          })
          
          return {
            success: true,
            result: {
              statistics,
              detailedResults: results,
              summary: {
                totalTargets: params.targets.length,
                healthyTargets: statistics.filter(s => s.status === 'healthy').length,
                degradedTargets: statistics.filter(s => s.status === 'degraded').length,
                downTargets: statistics.filter(s => s.status === 'down').length
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

// Export service monitoring tools
export const serviceMonitoringRegistry = new Map<string, SystemTool>([
  [serviceDiscoveryTool.id, serviceDiscoveryTool],
  [systemServiceStatusTool.id, systemServiceStatusTool],
  [networkServiceAvailabilityTool.id, networkServiceAvailabilityTool]
])

console.log('📊 [SERVICE_MONITORING] Service monitoring tools initialized:', Array.from(serviceMonitoringRegistry.keys()))