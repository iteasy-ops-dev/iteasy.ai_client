// Client-side tool registry for browser environment
export interface ClientTool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
      required?: boolean
    }>
    required: string[]
  }
  execute: (params: Record<string, any>) => Promise<any>
}

export interface ToolExecutionResult {
  success: boolean
  result?: any
  error?: string
  executionTime: number
}

class ClientToolRegistry {
  private tools: Map<string, ClientTool> = new Map()

  registerTool(tool: ClientTool) {
    this.tools.set(tool.name, tool)
  }

  getTool(name: string): ClientTool | undefined {
    return this.tools.get(name)
  }

  getAllTools(): ClientTool[] {
    return Array.from(this.tools.values())
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  async executeTool(name: string, parameters: Record<string, any>): Promise<ToolExecutionResult> {
    const startTime = Date.now()
    const tool = this.getTool(name)
    
    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
        executionTime: Date.now() - startTime
      }
    }

    try {
      const result = await tool.execute(parameters)
      return {
        success: true,
        result,
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      }
    }
  }

  getToolsDescription(): string {
    return this.getAllTools().map(tool => 
      `${tool.name}: ${tool.description}`
    ).join('\n')
  }
}

// Browser-safe calculator tool
const calculatorTool: ClientTool = {
  name: 'calculator',
  description: 'Perform basic mathematical calculations',
  parameters: {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4")'
      }
    },
    required: ['expression']
  },
  execute: async (params) => {
    const { expression } = params
    
    try {
      // Safe mathematical evaluation (basic operations only)
      const sanitizedExpression = expression.replace(/[^0-9+\-*/().\s]/g, '')
      if (sanitizedExpression !== expression) {
        throw new Error('Invalid characters in mathematical expression')
      }
      
      const result = Function(`"use strict"; return (${sanitizedExpression})`)()
      
      return {
        expression: sanitizedExpression,
        result,
        type: typeof result
      }
    } catch (error) {
      throw new Error(`Calculation failed: ${error}`)
    }
  }
}

// Text analysis tool
const textAnalysisTool: ClientTool = {
  name: 'text_analysis',
  description: 'Analyze text for word count, sentiment, and basic metrics',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'Text to analyze'
      },
      analysis_type: {
        type: 'string',
        description: 'Type of analysis: "basic", "sentiment", "keywords"'
      }
    },
    required: ['text', 'analysis_type']
  },
  execute: async (params) => {
    const { text, analysis_type } = params
    
    const basicAnalysis = {
      wordCount: text.split(/\s+/).filter((word: string) => word.length > 0).length,
      characterCount: text.length,
      sentenceCount: text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length,
      paragraphCount: text.split(/\n\s*\n/).filter((p: string) => p.trim().length > 0).length
    }
    
    switch (analysis_type) {
      case 'basic':
        return basicAnalysis
        
      case 'sentiment':
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'perfect', 'awesome']
        const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing', 'hate', 'worst', 'poor']
        
        const words = text.toLowerCase().split(/\s+/)
        const positiveCount = words.filter((word: string) => positiveWords.includes(word)).length
        const negativeCount = words.filter((word: string) => negativeWords.includes(word)).length
        
        let sentiment = 'neutral'
        if (positiveCount > negativeCount) sentiment = 'positive'
        else if (negativeCount > positiveCount) sentiment = 'negative'
        
        return {
          ...basicAnalysis,
          sentiment,
          positiveWords: positiveCount,
          negativeWords: negativeCount,
          sentimentScore: (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1)
        }
        
      case 'keywords':
        const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'this', 'that', 'these', 'those']
        const keywords = text.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((word: string) => word.length > 3 && !commonWords.includes(word))
          .reduce((acc: Record<string, number>, word: string) => {
            acc[word] = (acc[word] || 0) + 1
            return acc
          }, {})
        
        const topKeywords = Object.entries(keywords)
          .sort(([,a], [,b]) => (b as number) - (a as number))
          .slice(0, 10)
          .map(([word, count]) => ({ word, count }))
        
        return {
          ...basicAnalysis,
          keywords: topKeywords
        }
        
      default:
        throw new Error(`Unknown analysis type: ${analysis_type}`)
    }
  }
}

// Date/time tool
const dateTimeTool: ClientTool = {
  name: 'datetime',
  description: 'Get current date, time, or perform date calculations',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'Operation: "current", "format", "add_days", "diff_days"'
      },
      format: {
        type: 'string',
        description: 'Date format for formatting operations'
      },
      date: {
        type: 'string',
        description: 'Date string for operations'
      },
      days: {
        type: 'number',
        description: 'Number of days for add/subtract operations'
      }
    },
    required: ['operation']
  },
  execute: async (params) => {
    const { operation, format, date, days } = params
    const now = new Date()
    
    switch (operation) {
      case 'current':
        return {
          timestamp: now.getTime(),
          iso: now.toISOString(),
          local: now.toLocaleString(),
          utc: now.toUTCString(),
          date: now.toDateString(),
          time: now.toTimeString()
        }
        
      case 'format':
        const targetDate = date ? new Date(date) : now
        return {
          formatted: format ? targetDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }) : targetDate.toLocaleDateString(),
          iso: targetDate.toISOString()
        }
        
      case 'add_days':
        const futureDate = new Date(date || now)
        futureDate.setDate(futureDate.getDate() + (days || 0))
        return {
          originalDate: date || now.toISOString(),
          daysAdded: days || 0,
          resultDate: futureDate.toISOString(),
          formatted: futureDate.toLocaleDateString()
        }
        
      case 'diff_days':
        const date1 = new Date(date || now)
        const date2 = new Date()
        const diffTime = Math.abs(date2.getTime() - date1.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return {
          date1: date1.toISOString(),
          date2: date2.toISOString(),
          differenceInDays: diffDays
        }
        
      default:
        throw new Error(`Unknown datetime operation: ${operation}`)
    }
  }
}

// URL/web information tool (browser-safe)
const webInfoTool: ClientTool = {
  name: 'web_info',
  description: 'Get information about URLs and web pages (client-side only)',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to analyze'
      },
      operation: {
        type: 'string',
        description: 'Operation: "parse", "validate"'
      }
    },
    required: ['url', 'operation']
  },
  execute: async (params) => {
    const { url, operation } = params
    
    try {
      const urlObj = new URL(url)
      
      switch (operation) {
        case 'parse':
          return {
            protocol: urlObj.protocol,
            hostname: urlObj.hostname,
            port: urlObj.port,
            pathname: urlObj.pathname,
            search: urlObj.search,
            hash: urlObj.hash,
            origin: urlObj.origin
          }
          
        case 'validate':
          return {
            isValid: true,
            url: urlObj.href,
            protocol: urlObj.protocol,
            domain: urlObj.hostname
          }
          
        default:
          throw new Error(`Unknown web_info operation: ${operation}`)
      }
    } catch (error) {
      if (operation === 'validate') {
        return {
          isValid: false,
          error: error instanceof Error ? error.message : 'Invalid URL'
        }
      }
      throw error
    }
  }
}

// Create and export the client tool registry instance
export const clientToolRegistry = new ClientToolRegistry()

// Register all tools
clientToolRegistry.registerTool(calculatorTool)
clientToolRegistry.registerTool(textAnalysisTool)
clientToolRegistry.registerTool(dateTimeTool)
clientToolRegistry.registerTool(webInfoTool)

console.log('🔧 Client tools registered:', clientToolRegistry.getToolNames())