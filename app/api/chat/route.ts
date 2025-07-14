import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { processWithGraph } from './langgraph/graph'

export async function POST(req: Request) {
  try {
    const { messages, apiKey, model = 'gpt-3.5-turbo', temperature = 0.7, maxTokens = 1000 } = await req.json()

    // Use provided API key or fallback to environment variable
    const actualApiKey = apiKey || process.env.OPENAI_API_KEY
    
    if (!actualApiKey) {
      return new Response('API key is required', { status: 400 })
    }

    // Create OpenAI client with the provided API key
    const openai = createOpenAI({
      apiKey: actualApiKey,
      compatibility: 'strict', // Critical for token usage tracking
    })

    // Log request info for debugging
    console.log('=== Chat Request Debug Info ===')
    console.log('Model:', model)
    console.log('Temperature:', temperature)
    console.log('Max Tokens:', maxTokens)
    console.log('Messages count:', messages?.length || 0)
    console.log('================================')

    // Process through LangGraph for intent analysis and routing
    const graphResult = await processWithGraph(messages, { apiKey: actualApiKey, model })
    
    // Prepare messages for streaming
    let finalMessages = messages
    
    // If system engineering intent detected, modify the system message
    if (graphResult.systemPrompt) {
      console.log('Using system engineering prompt')
      // Add system prompt as the first message if it doesn't exist
      const hasSystemMessage = messages.some((msg: any) => msg.role === 'system')
      if (!hasSystemMessage) {
        finalMessages = [
          { role: 'system', content: graphResult.systemPrompt },
          ...messages
        ]
      } else {
        // Replace existing system message
        finalMessages = messages.map((msg: any) => 
          msg.role === 'system' 
            ? { ...msg, content: graphResult.systemPrompt }
            : msg
        )
      }
    }

    // Stream the response using the Vercel AI SDK
    const result = streamText({
      model: openai(model),
      messages: finalMessages,
      temperature,
      maxTokens,
      onFinish: async (event) => {
        console.log('=== Chat Response Debug Info ===')
        console.log('Model used:', model)
        console.log('Intent:', graphResult.intent)
        console.log('Confidence:', graphResult.confidence)
        console.log('Used system prompt:', !!graphResult.systemPrompt)
        console.log('Prompt tokens:', event.usage?.promptTokens || 'N/A')
        console.log('Completion tokens:', event.usage?.completionTokens || 'N/A')
        console.log('Total tokens:', event.usage?.totalTokens || 'N/A')
        console.log('Response text length:', event.text?.length || 0)
        console.log('=================================')
      },
    })

    // Return the stream as the response with token usage data
    return result.toDataStreamResponse({
      sendUsage: true,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    
    // Handle specific OpenAI API errors
    if (error instanceof Error) {
      if (error.message.includes('401')) {
        return new Response('Invalid API key', { status: 401 })
      }
      if (error.message.includes('quota')) {
        return new Response('API quota exceeded', { status: 429 })
      }
      if (error.message.includes('rate limit')) {
        return new Response('Rate limit exceeded', { status: 429 })
      }
    }
    
    return new Response('Internal Server Error', { status: 500 })
  }
}