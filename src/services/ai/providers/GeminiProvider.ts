import type { ChatMessage, ChatOptions, ChatChunk } from '@/types/ai'
import type { AIProvider } from '../types'
import { AIServiceError, makeAIError } from '../types'
import { singleChunkStream } from '../stream'

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

interface GeminiContent {
  role: 'user' | 'model'
  parts: GeminiPart[]
}

interface GeminiCandidate {
  content: { parts: GeminiPart[] }
  finishReason?: string
}

interface GeminiStreamChunk {
  candidates?: GeminiCandidate[]
  usageMetadata?: { totalTokenCount: number }
}

export class GeminiProvider implements AIProvider {
  readonly type = 'gemini' as const
  readonly name = 'Google Gemini'

  constructor(
    private readonly apiKey: string,
    private readonly model: string = 'gemini-2.0-flash',
  ) {}

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ReadableStream<ChatChunk>> {
    const { systemPrompt, contents } = this._formatMessages(messages, options?.systemPrompt)

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens,
      },
    }

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] }
    }

    let response: Response
    try {
      response = await fetch(
        `${BASE_URL}/models/${this.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: options?.signal,
          body: JSON.stringify(body),
        },
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AIServiceError(makeAIError('cancelled', 'Request cancelled', 'gemini'), 'Cancelled')
      }
      throw new AIServiceError(
        makeAIError('connection_failed', 'Failed to connect to Gemini API', 'gemini', true),
        'Connection failed',
      )
    }

    if (response.status === 401 || response.status === 403) {
      throw new AIServiceError(
        makeAIError('auth_failed', 'Invalid Gemini API key. Get a free key at aistudio.google.com', 'gemini'),
        'Invalid API key',
      )
    }

    if (response.status === 429) {
      throw new AIServiceError(
        makeAIError('rate_limited', 'Gemini rate limit reached (15 RPM on free tier). Try again in a minute.', 'gemini', true),
        'Rate limited',
      )
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new AIServiceError(
        makeAIError('unknown', `Gemini error ${response.status}: ${text}`, 'gemini', response.status >= 500),
        `Gemini error: ${response.status}`,
      )
    }

    // Parse Gemini SSE format
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    return new ReadableStream<ChatChunk>({
      async pull(controller) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.enqueue({ text: '', done: true })
            controller.close()
            return
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (!data || data === '[DONE]') continue

            try {
              const chunk = JSON.parse(data) as GeminiStreamChunk
              const text = chunk.candidates?.[0]?.content?.parts
                ?.map(p => p.text ?? '')
                .join('') ?? ''
              const isDone = chunk.candidates?.[0]?.finishReason === 'STOP'
              if (text) controller.enqueue({ text, done: false })
              if (isDone) {
                controller.enqueue({ text: '', done: true })
                controller.close()
                return
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      },
      cancel() {
        reader.cancel()
      },
    })
  }

  async complete(prompt: string, options?: ChatOptions): Promise<string> {
    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens,
      },
    }

    const response = await fetch(
      `${BASE_URL}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: options?.signal,
        body: JSON.stringify(body),
      },
    )

    const data = await response.json() as {
      candidates?: Array<{ content: { parts: GeminiPart[] } }>
    }
    return data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Gemini embedding model
    const results: number[][] = []
    for (const text of texts) {
      try {
        const response = await fetch(
          `${BASE_URL}/models/text-embedding-004:embedContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'models/text-embedding-004',
              content: { parts: [{ text }] },
            }),
          },
        )
        const data = await response.json() as { embedding: { values: number[] } }
        results.push(data.embedding.values)
      } catch {
        results.push([])
      }
    }
    return results
  }

  async vision(imageBase64: string, prompt: string, mimeType = 'image/png'): Promise<string> {
    const body = {
      contents: [{
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: prompt },
        ],
      }],
    }

    const response = await fetch(
      `${BASE_URL}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )

    const data = await response.json() as {
      candidates?: Array<{ content: { parts: GeminiPart[] } }>
    }
    return data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${BASE_URL}/models?key=${this.apiKey}`,
        { signal: AbortSignal.timeout(5000) },
      )
      return response.ok
    } catch {
      return false
    }
  }

  private _formatMessages(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): { systemPrompt: string | undefined; contents: GeminiContent[] } {
    // Gemini expects alternating user/model turns
    const contents: GeminiContent[] = []
    let extractedSystem: string | undefined = systemPrompt

    for (const msg of messages) {
      if (msg.role === 'system') {
        extractedSystem = Array.isArray(msg.content)
          ? msg.content.map(c => c.text ?? '').join('')
          : msg.content
        continue
      }

      const parts: GeminiPart[] = []
      if (Array.isArray(msg.content)) {
        for (const c of msg.content) {
          if (c.type === 'text' && c.text) {
            parts.push({ text: c.text })
          } else if (c.type === 'image_url' && c.image_url) {
            const base64Match = c.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
            if (base64Match) {
              parts.push({ inlineData: { mimeType: base64Match[1]!, data: base64Match[2]! } })
            }
          }
        }
      } else {
        parts.push({ text: msg.content })
      }

      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      })
    }

    // Gemini requires starting with 'user' role — insert a dummy if needed
    if (contents.length > 0 && contents[0]?.role !== 'user') {
      contents.unshift({ role: 'user', parts: [{ text: '.' }] })
    }

    return { systemPrompt: extractedSystem, contents }
  }
}

void singleChunkStream
