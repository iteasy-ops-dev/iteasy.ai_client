import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { processMessageIntent } from './langgraph-client/graph'

export interface LLMConfig {
  provider: 'openai' | 'local' | 'ollama'
  apiKey?: string
  endpoint?: string
  model: string
  temperature?: number
  maxTokens?: number
}

// OpenAI direct streaming (client-side)
export async function streamWithOpenAI(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  config: LLMConfig,
  onStream: (chunk: string) => void,
  onFinish?: (usage?: any) => void
) {
  console.log('🚀 Starting OpenAI stream with LangGraph processing...')
  console.log('📝 Input messages:', messages)
  
  // Process intent with LangGraph
  console.log('🧠 Processing message intent with LangGraph...')
  const processedState = await processMessageIntent(messages)
  
  console.log('✅ LangGraph processing complete:', {
    intent: processedState.intent,
    confidence: processedState.confidence,
    systemPromptLength: processedState.systemPrompt?.length || 0
  })
  
  // Add system prompt based on intent
  const messagesWithSystem = [
    { role: 'system' as const, content: processedState.systemPrompt || '' },
    ...messages
  ]
  
  const openai = createOpenAI({
    apiKey: config.apiKey,
    compatibility: 'strict',
  } as any)
  
  const result = streamText({
    model: openai(config.model || 'gpt-3.5-turbo'),
    messages: messagesWithSystem,
    temperature: config.temperature || 0.7,
    maxTokens: config.maxTokens || 1000,
  })
  
  // Handle streaming
  for await (const chunk of result.textStream) {
    onStream(chunk)
  }
  
  // Get final usage
  const usage = await result.usage
  console.log('📊 OpenAI usage data:', usage)
  
  if (onFinish) {
    onFinish({
      ...usage,
      intent: processedState.intent,
      confidence: processedState.confidence,
      systemPrompt: processedState.systemPrompt
    })
  }
  
  console.log('✅ OpenAI stream completed')
}

// Custom LLM streaming (for Ollama, llama.cpp, etc.)
export async function streamWithLocalLLM(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  config: LLMConfig,
  onStream: (chunk: string) => void,
  onFinish?: (usage?: any) => void
) {
  console.log('🚀 Starting Local LLM stream with LangGraph processing...')
  console.log('📝 Input messages:', messages)
  console.log('🔧 LLM Config:', config)
  
  // Process intent with LangGraph
  console.log('🧠 Processing message intent with LangGraph...')
  const processedState = await processMessageIntent(messages)
  
  console.log('✅ LangGraph processing complete:', {
    intent: processedState.intent,
    confidence: processedState.confidence,
    systemPromptLength: processedState.systemPrompt?.length || 0
  })
  
  // Determine if this is an Ollama endpoint
  const endpoint = config.endpoint || 'http://localhost:11434/api/generate'
  const isOllamaEndpoint = endpoint.includes('11434') || endpoint.includes('ollama') || endpoint.includes('/api/generate')
  
  console.log('🔍 Endpoint detection:', {
    endpoint,
    isOllamaEndpoint,
    detectedType: isOllamaEndpoint ? 'Ollama' : 'OpenAI-compatible'
  })
  
  let requestBody: any
  
  if (isOllamaEndpoint) {
    // Ollama API format - combine messages into a single prompt
    const systemPrompt = processedState.systemPrompt || ''
    const conversationPrompt = messages.map(msg => {
      if (msg.role === 'system') return `System: ${msg.content}`
      if (msg.role === 'user') return `User: ${msg.content}`
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`
      return msg.content
    }).join('\n')
    
    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${conversationPrompt}` : conversationPrompt
    
    console.log('📤 Ollama request body prepared:', {
      model: config.model,
      promptLength: fullPrompt.length,
      temperature: config.temperature || 0.7,
      num_predict: config.maxTokens || 1000
    })
    
    requestBody = {
      model: config.model,
      prompt: fullPrompt,
      stream: true,
      options: {
        temperature: config.temperature || 0.7,
        num_predict: config.maxTokens || 1000,
      }
    }
  } else {
    // OpenAI-compatible API format
    const messagesWithSystem = [
      { role: 'system' as const, content: processedState.systemPrompt || '' },
      ...messages
    ]
    
    console.log('📤 OpenAI-compatible request body prepared:', {
      model: config.model,
      messageCount: messagesWithSystem.length,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000
    })
    
    requestBody = {
      model: config.model,
      messages: messagesWithSystem,
      stream: true,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 1000,
    }
  }
  
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
  
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  
  while (reader) {
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
              onStream(json.response)
            }
          } else {
            // OpenAI-compatible response format
            if (json.choices?.[0]?.delta?.content) {
              onStream(json.choices[0].delta.content)
            }
          }
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
    }
  }
  
  if (onFinish) {
    // Estimate token usage for local LLMs (rough approximation)
    const totalMessages = messages.length
    const estimatedPromptTokens = Math.floor(totalMessages * 50) // rough estimate
    const estimatedCompletionTokens = Math.floor(Math.random() * 200 + 50) // rough estimate
    
    console.log('📊 Local LLM estimated usage:', {
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens,
      totalTokens: estimatedPromptTokens + estimatedCompletionTokens
    })
    
    onFinish({
      promptTokens: estimatedPromptTokens,
      completionTokens: estimatedCompletionTokens,
      totalTokens: estimatedPromptTokens + estimatedCompletionTokens,
      intent: processedState.intent,
      confidence: processedState.confidence,
      systemPrompt: processedState.systemPrompt
    })
  }
  
  console.log('✅ Local LLM stream completed')
}