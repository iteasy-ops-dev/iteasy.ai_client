import { END, START, StateGraph } from '@langchain/langgraph'
import { ChatState } from './types'
import { intentClassifierNode } from './nodes/intentClassifier'
import { complexityDetectorNode } from './nodes/complexityDetector'
import { generalChatNode } from './nodes/generalChat'
import { systemEngineerNode } from './nodes/systemEngineer'
import { helpNode } from './nodes/helpNode'
import { HumanMessage } from '@langchain/core/messages'

// Define the graph
export function createChatGraph(config: { apiKey: string; model?: string; useLocalClassification?: boolean }) {
  const workflow = new StateGraph<ChatState>({
    channels: {
      messages: {
        value: (x?: any, y?: any) => y ?? x ?? [],
      },
      lastUserMessage: {
        value: (x?: any, y?: any) => y ?? x ?? '',
      },
      intent: {
        value: (x?: any, y?: any) => y ?? x ?? null,
      },
      confidence: {
        value: (x?: any, y?: any) => y ?? x ?? 0,
      },
      systemPrompt: {
        value: (x?: any, y?: any) => y ?? x,
      },
      response: {
        value: (x?: any, y?: any) => y ?? x,
      },
      // ReAct Pattern Fields
      complexityLevel: {
        value: (x?: any, y?: any) => y ?? x,
      },
      useReact: {
        value: (x?: any, y?: any) => y ?? x,
      },
      thoughts: {
        value: (x?: any, y?: any) => y ?? x ?? [],
      },
      actions: {
        value: (x?: any, y?: any) => y ?? x ?? [],
      },
      observations: {
        value: (x?: any, y?: any) => y ?? x ?? [],
      },
      reasoningChain: {
        value: (x?: any, y?: any) => y ?? x ?? [],
      },
      currentStep: {
        value: (x?: any, y?: any) => y ?? x,
      },
      toolsUsed: {
        value: (x?: any, y?: any) => y ?? x ?? [],
      },
    },
  })

  // Add nodes
  workflow.addNode('intentClassifier', async (state: ChatState) => {
    return await intentClassifierNode(state, config)
  })
  
  workflow.addNode('complexityDetector', complexityDetectorNode)
  workflow.addNode('generalChat', generalChatNode)
  workflow.addNode('systemEngineer', systemEngineerNode)
  workflow.addNode('help', helpNode)

  // Add edges from START to intentClassifier
  workflow.addEdge(START, 'intentClassifier' as any)

  // Add edge from intentClassifier to complexityDetector
  workflow.addEdge('intentClassifier' as any, 'complexityDetector' as any)

  // Add conditional edges based on complexity and intent
  workflow.addConditionalEdges(
    'complexityDetector' as any,
    (state: ChatState) => {
      console.log('=== Graph Routing Decision ===')
      console.log(`Intent: ${state.intent} (confidence: ${state.confidence})`)
      console.log(`Complexity: ${state.complexityLevel} (useReact: ${state.useReact})`)
      
      // Route based on intent and complexity
      if (state.intent === 'help' && state.confidence >= 0.7) {
        console.log('→ Routing to: help')
        return 'help'
      } else if (state.intent === 'system_engineering' && state.confidence >= 0.7) {
        if (state.useReact) {
          console.log('→ Routing to: systemEngineer (will use ReAct pattern)')
        } else {
          console.log('→ Routing to: systemEngineer (simple response)')
        }
        return 'systemEngineer'
      }
      console.log('→ Routing to: generalChat')
      return 'generalChat'
    },
    {
      generalChat: 'generalChat',
      systemEngineer: 'systemEngineer',
      help: 'help',
    } as any
  )

  // All nodes lead to END
  workflow.addEdge('generalChat' as any, END)
  workflow.addEdge('systemEngineer' as any, END)
  workflow.addEdge('help' as any, END)

  return workflow.compile()
}

// Helper function to process a message through the graph
export async function processWithGraph(
  messages: any[],
  config: { apiKey: string; model?: string; useLocalClassification?: boolean }
) {
  const graph = createChatGraph(config)
  
  // Get the last user message
  const lastUserMessage = messages[messages.length - 1]?.content || ''
  
  // Convert messages to BaseMessage format if needed
  const baseMessages = messages.map(msg => {
    if (msg.role === 'user') {
      return new HumanMessage(msg.content)
    }
    // For now, treat all non-user messages as AI messages
    return new HumanMessage(msg.content)
  })
  
  // Run the graph
  const result = await graph.invoke({
    messages: baseMessages,
    lastUserMessage,
    intent: null,
    confidence: 0,
  })
  
  console.log('Graph execution result:', {
    intent: result.intent,
    confidence: result.confidence,
    hasSystemPrompt: !!result.systemPrompt,
  })
  
  return result
}