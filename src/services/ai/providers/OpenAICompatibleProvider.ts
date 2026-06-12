/**
 * Generic OpenAI-compatible provider.
 * Covers: OpenAI, Groq, OpenRouter, LM Studio, Jan, llama.cpp, KoboldCPP,
 * text-generation-webui, Open WebUI, and any custom endpoint.
 */
import type { ChatMessage, ChatOptions, ChatChunk, AIProviderType } from '@/types/ai'
import type { AIProvider } from '../types'
import { AIServiceError, makeAIError } from '../types'
import { parseSSEStream } from '../stream'

interface OAIChunk {
  choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>
}

interface OAIModelsResponse {
  data: Array<{ id: string }>
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly type: AIProviderType
  readonly name: string

  constructor(
    type: AIProviderType,
    name: string,
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly apiKey?: string,
  ) {
    this.type = type
    this.name = name
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ReadableStream<ChatChunk>> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this._headers(),
        signal: options?.signal,
        body: JSON.stringify({
          model: this.model,
          messages: this._formatMessages(messages, options?.systemPrompt),
          stream: true,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens,
        }),
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AIServiceError(makeAIError('cancelled', 'Cancelled', this.type), 'Cancelled')
      }
      throw new AIServiceError(
        makeAIError('connection_failed', `Cannot connect to ${this.name} at ${this.baseUrl}`, this.type, true),
        'Connection failed',
      )
    }

    if (response.status === 401) {
      throw new AIServiceError(
        makeAIError('auth_failed', `Invalid API key for ${this.name}`, this.type),
        'Invalid API key',
      )
    }

    if (response.status === 429) {
      throw new AIServiceError(
        makeAIError('rate_limited', `Rate limit reached for ${this.name}`, this.type, true),
        'Rate limited',
      )
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new AIServiceError(
        makeAIError('unknown', `${this.name} error ${response.status}: ${text}`, this.type, response.status >= 500),
        `Error: ${response.status}`,
      )
    }

    return parseSSEStream(response, (data) => {
      if (!data || data === '[DONE]') return { text: '', done: true }
      try {
        const chunk = JSON.parse(data) as OAIChunk
        const content = chunk.choices?.[0]?.delta?.content ?? ''
        const isDone = chunk.choices?.[0]?.finish_reason != null
        return { text: content, done: isDone }
      } catch {
        return null
      }
    })
  }

  async complete(prompt: string, options?: ChatOptions): Promise<string> {
    const stream = await this.chat([{ role: 'user', content: prompt }], options)
    const reader = stream.getReader()
    let result = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      result += value.text
    }
    return result
  }

  async embed(texts: string[]): Promise<number[][]> {
    const embeddingModel = this.type === 'openai' ? 'text-embedding-3-small' : this.model
    const results: number[][] = []

    for (const text of texts) {
      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: this._headers(),
          body: JSON.stringify({ model: embeddingModel, input: text }),
        })
        const data = await response.json() as { data: Array<{ embedding: number[] }> }
        results.push(data.data[0]?.embedding ?? [])
      } catch {
        results.push([])
      }
    }

    return results
  }

  async vision(imageBase64: string, prompt: string, mimeType = 'image/png'): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        model: this.model,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: prompt },
          ],
        }],
        stream: false,
      }),
    })
    const data = await response.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0]?.message.content ?? ''
  }

  async testConnection(): Promise<boolean> {
    try {
      // Try /models endpoint
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this._headers(),
        signal: AbortSignal.timeout(4000),
      })
      return response.ok || response.status === 404 // 404 means server is up, just no /models endpoint
    } catch {
      return false
    }
  }

  /** Fetch available models from an OpenRouter-style endpoint */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this._headers(),
      })
      if (!response.ok) return []
      const data = await response.json() as OAIModelsResponse
      return data.data.map(m => m.id)
    } catch {
      return []
    }
  }

  private _headers(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`
    // OpenRouter requires site identification
    if (this.type === 'openrouter') {
      headers['HTTP-Referer'] = 'https://studyos.app'
      headers['X-Title'] = 'StudyOS'
    }
    return headers
  }

  private _formatMessages(
    messages: ChatMessage[],
    systemPrompt?: string,
  ): Array<{ role: string; content: unknown }> {
    const formatted: Array<{ role: string; content: unknown }> = []

    if (systemPrompt) {
      formatted.push({ role: 'system', content: systemPrompt })
    }

    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        formatted.push({ role: msg.role, content: msg.content })
      } else {
        formatted.push({ role: msg.role, content: msg.content })
      }
    }

    return formatted
  }
}
