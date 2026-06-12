import type { ChatMessage, ChatOptions, ChatChunk } from '@/types/ai'
import type { AIProvider } from '../types'
import { AIServiceError, makeAIError } from '../types'
import { parseNDJSONStream, singleChunkStream } from '../stream'

interface OllamaChatResponse {
  model: string
  message?: { role: string; content: string }
  done: boolean
  done_reason?: string
}

interface OllamaEmbedResponse {
  embeddings: number[][]
}

export class OllamaProvider implements AIProvider {
  readonly type = 'ollama' as const
  readonly name = 'Ollama (Local)'

  constructor(
    private readonly baseUrl: string,
    private readonly model: string,
    private readonly visionModel?: string,
    private readonly embeddingModel?: string,
  ) {}

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ReadableStream<ChatChunk>> {
    const controller = options?.signal ? undefined : new AbortController()
    const signal = options?.signal ?? controller?.signal

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          model: this.model,
          messages: this._formatMessages(messages),
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens,
          },
        }),
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new AIServiceError(
          makeAIError('cancelled', 'Request cancelled', 'ollama'),
          'Request cancelled',
        )
      }
      throw new AIServiceError(
        makeAIError('connection_failed', `Cannot connect to Ollama at ${this.baseUrl}. Is Ollama running?`, 'ollama', true),
        `Cannot connect to Ollama at ${this.baseUrl}`,
      )
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new AIServiceError(
        makeAIError('unknown', `Ollama returned ${response.status}: ${text}`, 'ollama', response.status >= 500),
        `Ollama error: ${response.status}`,
      )
    }

    return parseNDJSONStream(response, (json) => {
      const data = json as OllamaChatResponse
      const content = data.message?.content ?? ''
      return { text: content, done: data.done }
    })
  }

  async complete(prompt: string, options?: ChatOptions): Promise<string> {
    const stream = await this.chat(
      [{ role: 'user', content: prompt }],
      { ...options, stream: true },
    )
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
    const model = this.embeddingModel ?? 'nomic-embed-text'
    const results: number[][] = []

    for (const text of texts) {
      try {
        const response = await fetch(`${this.baseUrl}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: text }),
        })
        if (!response.ok) {
          // Fallback: try the older /api/embeddings endpoint
          const r2 = await fetch(`${this.baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: text }),
          })
          const data = await r2.json() as { embedding: number[] }
          results.push(data.embedding)
          continue
        }
        const data = await response.json() as OllamaEmbedResponse
        results.push(data.embeddings[0] ?? [])
      } catch {
        results.push([]) // Empty embedding on error
      }
    }

    return results
  }

  async vision(imageBase64: string, prompt: string, mimeType = 'image/png'): Promise<string> {
    const model = this.visionModel ?? 'llava'
    void mimeType // Ollama doesn't need mime type — it auto-detects

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        images: [imageBase64],
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new AIServiceError(
        makeAIError('unknown', `Vision request failed: ${response.status}`, 'ollama'),
        'Vision request failed',
      )
    }

    const data = await response.json() as { response: string }
    return data.response
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  /** Fetch list of installed models */
  async listModels(): Promise<Array<{ name: string; size: number; modifiedAt: string }>> {
    const response = await fetch(`${this.baseUrl}/api/tags`)
    if (!response.ok) return []
    const data = await response.json() as {
      models: Array<{ name: string; size: number; modified_at: string }>
    }
    return data.models.map(m => ({ name: m.name, size: m.size, modifiedAt: m.modified_at }))
  }

  private _formatMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
    return messages.map(m => ({
      role: m.role,
      content: Array.isArray(m.content)
        ? m.content.map(c => (c.type === 'text' ? c.text ?? '' : '[image]')).join('')
        : m.content,
    }))
  }
}

// Unused import guard
void singleChunkStream
