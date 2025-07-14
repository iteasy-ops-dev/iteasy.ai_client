import { END, START, StateGraph } from '@langchain/langgraph'
import { ChatState } from './types'
import { intentClassifierNode } from './nodes/intentClassifier'
import { generalChatNode } from './nodes/generalChat'
import { systemEngineerNode } from './nodes/systemEngineer'
import { helpNode } from './nodes/helpNode'
import { HumanMessage } from '@langchain/core/messages'

// Define the graph
export function createChatGraph(config: { apiKey: string; model?: string }) {
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
    },
  })

  // Add nodes
  workflow.addNode('intentClassifier', async (state: ChatState) => {
    return await intentClassifierNode(state, config)
  })
  
  workflow.addNode('generalChat', generalChatNode)
  workflow.addNode('systemEngineer', systemEngineerNode)
  workflow.addNode('help', helpNode)

  // Add edges from START to intentClassifier
  workflow.addEdge(START, 'intentClassifier')

  // Add conditional edges based on intent
  workflow.addConditionalEdges(
    'intentClassifier',
    (state: ChatState) => {
      console.log(`Routing based on intent: ${state.intent} (confidence: ${state.confidence})`)
      
      // Route based on intent and confidence
      if (state.intent === 'help' && state.confidence >= 0.7) {
        return 'help'
      } else if (state.intent === 'system_engineering' && state.confidence >= 0.7) {
        return 'systemEngineer'
      }
      return 'generalChat'
    },
    {
      generalChat: 'generalChat',
      systemEngineer: 'systemEngineer',
      help: 'help',
    }
  )

  // All nodes lead to END
  workflow.addEdge('generalChat', END)
  workflow.addEdge('systemEngineer', END)
  workflow.addEdge('help', END)

  return workflow.compile()
}

// Helper function to process a message through the graph
export async function processWithGraph(
  messages: any[],
  config: { apiKey: string; model?: string }
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