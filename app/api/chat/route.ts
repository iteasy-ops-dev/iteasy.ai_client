import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { processWithGraph } from './langgraph/graph'

// Custom LLM streaming handler
async function handleCustomLLMStreaming(config: {
  endpoint: string
  model: string
  messages: any[]
  temperature: number
  maxTokens: number
  graphResult: any
}) {
  const { endpoint, model, messages, temperature, maxTokens, graphResult } = config
  
  // Determine if this is an Ollama endpoint
  const isOllamaEndpoint = endpoint.includes('11434') || endpoint.includes('ollama') || endpoint.includes('/api/generate')
  
  console.log('🔍 Custom LLM Endpoint detection:', {
    endpoint,
    isOllamaEndpoint,
    detectedType: isOllamaEndpoint ? 'Ollama' : 'OpenAI-compatible'
  })
  
  let requestBody: any
  
  if (isOllamaEndpoint) {
    // Ollama API format - combine messages into a single prompt
    const conversationPrompt = messages.map(msg => {
      if (msg.role === 'system') {
        // Check if this is a system prompt with tool results
        if (msg.content.includes('## TOOL EXECUTION RESULTS:')) {
          // Add clear separators and emphasis for tool results
          return `=== SYSTEM INSTRUCTIONS ===\n${msg.content}\n=== END SYSTEM INSTRUCTIONS ===`
        }
        return `System: ${msg.content}`
      }
      if (msg.role === 'user') return `User: ${msg.content}`
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`
      return msg.content
    }).join('\n\n')
    
    // Add instruction to use tool results at the end
    const finalPrompt = conversationPrompt + '\n\nAssistant: (Please provide a response based on the actual tool execution results shown above, not general instructions)'
    
    requestBody = {
      model,
      prompt: finalPrompt,
      stream: true,
      options: {
        temperature,
        num_predict: maxTokens,
      }
    }
  } else {
    // OpenAI-compatible API format
    requestBody = {
      model,
      messages,
      stream: true,
      temperature,
      max_tokens: maxTokens,
    }
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      throw new Error(`Custom LLM error: ${response.statusText}`)
    }

    // Create a ReadableStream that transforms the custom LLM response to Vercel AI SDK format
    const transformStream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()
        
        if (!reader) {
          controller.close()
          return
        }

        try {
          // First, send LangGraph metadata
          const langGraphMetadata = {
            intent: graphResult.intent,
            confidence: graphResult.confidence,
            complexityLevel: graphResult.complexityLevel,
            useReact: graphResult.useReact,
            reasoningChain: graphResult.reasoningChain || [],
            currentStep: graphResult.currentStep || 0,
            toolsUsed: graphResult.toolsUsed || []
          }
          
          controller.enqueue(new TextEncoder().encode(`2:${JSON.stringify({
            type: 'langGraph',
            data: langGraphMetadata
          })}\n`))

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.trim()) {
                try {
                  const json = JSON.parse(line)
                  
                  if (isOllamaEndpoint) {
                    // Ollama response format
                    if (json.response) {
                      // Send as Vercel AI SDK format: 0:"text chunk"
                      controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(json.response)}\n`))
                    }
                  } else {
                    // OpenAI-compatible response format
                    if (json.choices?.[0]?.delta?.content) {
                      controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(json.choices[0].delta.content)}\n`))
                    }
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                }
              }
            }
          }

          // Send finish event with estimated usage data
          const estimatedUsage = {
            promptTokens: Math.floor(messages.length * 50),
            completionTokens: Math.floor(Math.random() * 200 + 50),
            totalTokens: 0
          }
          estimatedUsage.totalTokens = estimatedUsage.promptTokens + estimatedUsage.completionTokens

          controller.enqueue(new TextEncoder().encode(`e:${JSON.stringify({
            finishReason: 'stop',
            usage: estimatedUsage,
            isContinued: false,
            // LangGraph 메타데이터 추가
            langGraph: {
              intent: graphResult.intent,
              confidence: graphResult.confidence,
              complexityLevel: graphResult.complexityLevel,
              useReact: graphResult.useReact,
              reasoningChain: graphResult.reasoningChain || [],
              currentStep: graphResult.currentStep || 0,
              toolsUsed: graphResult.toolsUsed || []
            }
          })}\n`))

          console.log('=== Custom LLM Response Debug Info ===')
          console.log('Model used:', model)
          console.log('Intent:', graphResult.intent)
          console.log('Confidence:', graphResult.confidence)
          console.log('Complexity Level:', graphResult.complexityLevel)
          console.log('Use ReAct:', graphResult.useReact)
          console.log('ReAct Steps:', graphResult.reasoningChain?.length || 0)
          console.log('Used system prompt:', !!graphResult.systemPrompt)
          console.log('Estimated prompt tokens:', estimatedUsage.promptTokens)
          console.log('Estimated completion tokens:', estimatedUsage.completionTokens)
          console.log('Estimated total tokens:', estimatedUsage.totalTokens)
          console.log('======================================')

          controller.close()
        } catch (error) {
          console.error('Custom LLM streaming error:', error)
          controller.error(error)
        }
      }
    })

    return new Response(transformStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Custom LLM request error:', error)
    throw error
  }
}

export async function POST(req: Request) {
  try {
    const { 
      messages, 
      apiKey, 
      model = 'gpt-3.5-turbo', 
      temperature = 0.7, 
      maxTokens = 1000,
      provider = 'openai',
      endpoint
    } = await req.json()

    // For OpenAI, require API key
    if (provider === 'openai') {
      const actualApiKey = apiKey || process.env.OPENAI_API_KEY
      if (!actualApiKey) {
        return new Response('API key is required for OpenAI', { status: 400 })
      }
    }

    // Log request info for debugging
    console.log('=== Chat Request Debug Info ===')
    console.log('Provider:', provider)
    console.log('Model:', model)
    console.log('Temperature:', temperature)
    console.log('Max Tokens:', maxTokens)
    console.log('Messages count:', messages?.length || 0)
    console.log('Endpoint:', endpoint || 'N/A')
    console.log('================================')

    // Process through LangGraph for intent analysis and routing (for all providers)
    const graphConfig = provider === 'openai' 
      ? { 
          apiKey: apiKey || process.env.OPENAI_API_KEY || 'dummy', 
          model 
        }
      : { 
          apiKey: 'dummy', 
          model,
          useLocalClassification: true
        }
    
    const graphResult = await processWithGraph(messages, graphConfig)
    
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

    if (provider === 'openai') {
      // OpenAI via Vercel AI SDK
      const actualApiKey = apiKey || process.env.OPENAI_API_KEY
      const openai = createOpenAI({
        apiKey: actualApiKey,
        compatibility: 'strict', // Critical for token usage tracking
      })

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
          console.log('Complexity Level:', graphResult.complexityLevel)
          console.log('Use ReAct:', graphResult.useReact)
          console.log('ReAct Steps:', graphResult.reasoningChain?.length || 0)
          console.log('Used system prompt:', !!graphResult.systemPrompt)
          console.log('Prompt tokens:', event.usage?.promptTokens || 'N/A')
          console.log('Completion tokens:', event.usage?.completionTokens || 'N/A')
          console.log('Total tokens:', event.usage?.totalTokens || 'N/A')
          console.log('Response text length:', event.text?.length || 0)
          console.log('=================================')
        },
      })

      // Custom wrapper to inject LangGraph metadata
      const originalResponse = result.toDataStreamResponse({
        sendUsage: true,
      })

      // Create new response that includes LangGraph metadata
      const transformedStream = new ReadableStream({
        async start(controller) {
          const reader = originalResponse.body?.getReader()
          const decoder = new TextDecoder()
          const encoder = new TextEncoder()
          
          if (!reader) {
            controller.close()
            return
          }

          try {
            // First, send LangGraph metadata as a special event
            const langGraphMetadata = {
              intent: graphResult.intent,
              confidence: graphResult.confidence,
              complexityLevel: graphResult.complexityLevel,
              useReact: graphResult.useReact,
              reasoningChain: graphResult.reasoningChain || [],
              currentStep: graphResult.currentStep || 0,
              toolsUsed: graphResult.toolsUsed || []
            }
            
            controller.enqueue(encoder.encode(`2:${JSON.stringify({
              type: 'langGraph',
              data: langGraphMetadata
            })}\n`))

            // Then relay all original stream data
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              controller.enqueue(value)
            }

            controller.close()
          } catch (error) {
            console.error('Error in LangGraph metadata streaming:', error)
            controller.error(error)
          }
        }
      })

      return new Response(transformedStream, {
        headers: originalResponse.headers,
      })
    } else {
      // Custom LLM (Ollama, etc.) via server-side streaming
      return await handleCustomLLMStreaming({
        endpoint: endpoint || 'http://localhost:11434/api/generate',
        model,
        messages: finalMessages,
        temperature,
        maxTokens,
        graphResult
      })
    }
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