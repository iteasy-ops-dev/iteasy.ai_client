import { createOpenAI } from '@ai-sdk/openai'

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json()

    if (!apiKey || !apiKey.startsWith('sk-')) {
      return new Response('Invalid API key format', { status: 400 })
    }

    // Create OpenAI client with the provided API key
    const openai = createOpenAI({
      apiKey,
    })

    // Try to make a simple API call to validate the key
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        return new Response('Valid API key', { status: 200 })
      } else {
        return new Response('Invalid API key', { status: 401 })
      }
    } catch (error) {
      return new Response('Failed to validate API key', { status: 401 })
    }
  } catch (error) {
    console.error('API key validation error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}