export interface LLMConfig {
  provider: 'openai' | 'local' | 'ollama'
  apiKey?: string
  endpoint?: string
  model: string
  temperature?: number
  maxTokens?: number
}

// OpenAI API call via server route (recommended approach)
export async function streamWithOpenAI(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  config: LLMConfig,
  onStream: (chunk: string) => void,
  onFinish?: (usage?: any) => void
) {
  console.log('🚀 Starting OpenAI stream via API route...')
  console.log('📝 Input messages:', messages)
  
  // Call server API route which handles LangGraph processing
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      apiKey: config.apiKey,
      model: config.model || 'gpt-3.5-turbo',
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('No response body')
  }

  let usage: any = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.trim() === '') continue
      
      // Handle Vercel AI SDK stream format
      if (line.startsWith('0:')) {
        // Text delta format: 0:"chunk"
        try {
          const textChunk = JSON.parse(line.slice(2))
          if (typeof textChunk === 'string') {
            onStream(textChunk)
          }
        } catch (e) {
          console.warn('❌ Failed to parse text delta:', e)
        }
      } else if (line.startsWith('e:')) {
        // Finish/usage data format: e:{"finishReason":"stop","usage":{...}}
        try {
          const finishData = JSON.parse(line.slice(2))
          if (finishData.usage) {
            usage = finishData.usage
            console.log('📊 Received usage data:', usage)
          }
        } catch (e) {
          console.warn('❌ Failed to parse finish data:', e)
        }
      } else if (line.startsWith('data: ')) {
        // Fallback SSE format: data: {...}
        const data = line.slice(6).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          
          // Handle text stream
          if (parsed.type === 'text-delta' && parsed.textDelta) {
            onStream(parsed.textDelta)
          }
          
          // Handle usage data
          if (parsed.type === 'finish' && parsed.usage) {
            usage = parsed.usage
          }
        } catch (e) {
          console.warn('❌ Failed to parse SSE data:', e)
        }
      }
    }
  }

  console.log('📊 OpenAI usage data:', usage)
  
  if (onFinish) {
    onFinish(usage)
  }
  
  console.log('✅ OpenAI stream completed')
}

// Custom LLM streaming via server API (now includes LangGraph processing)
export async function streamWithLocalLLM(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  config: LLMConfig,
  onStream: (chunk: string) => void,
  onFinish?: (usage?: any) => void
) {
  console.log('🚀 Starting Custom LLM stream via API route...')
  console.log('📝 Input messages:', messages)
  console.log('🔧 LLM Config:', config)
  
  // Call server API route which handles LangGraph processing + Custom LLM
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      model: config.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      provider: config.provider,
      endpoint: config.endpoint,
    }),
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('No response body')
  }

  let usage: any = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.trim() === '') continue
      
      // Handle Vercel AI SDK stream format (same as OpenAI)
      if (line.startsWith('0:')) {
        // Text delta format: 0:"chunk"
        try {
          const textChunk = JSON.parse(line.slice(2))
          if (typeof textChunk === 'string') {
            onStream(textChunk)
          }
        } catch (e) {
          console.warn('❌ Failed to parse text delta:', e)
        }
      } else if (line.startsWith('e:')) {
        // Finish/usage data format: e:{"finishReason":"stop","usage":{...}}
        try {
          const finishData = JSON.parse(line.slice(2))
          if (finishData.usage) {
            usage = finishData.usage
            console.log('📊 Received usage data:', usage)
          }
        } catch (e) {
          console.warn('❌ Failed to parse finish data:', e)
        }
      }
    }
  }

  console.log('📊 Custom LLM usage data:', usage)
  
  if (onFinish) {
    onFinish(usage)
  }
  
  console.log('✅ Custom LLM stream completed')
}