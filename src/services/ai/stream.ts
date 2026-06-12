import type { ChatChunk } from '@/types/ai'
// Re-export so callers can import ChatChunk from this module
export type { ChatChunk }

/** Parse a Server-Sent Events stream into ChatChunk objects */
export function parseSSEStream(
  response: Response,
  extractChunk: (data: string) => ChatChunk | null,
): ReadableStream<ChatChunk> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream<ChatChunk>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // Flush buffer
          if (buffer.trim()) {
            const chunk = extractChunk(buffer.trim())
            if (chunk) controller.enqueue(chunk)
          }
          controller.close()
          return
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? '' // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') {
            if (trimmed === 'data: [DONE]') {
              controller.enqueue({ text: '', done: true })
              controller.close()
              return
            }
            continue
          }

          const dataLine = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed
          if (!dataLine) continue

          const chunk = extractChunk(dataLine)
          if (chunk) {
            controller.enqueue(chunk)
            if (chunk.done) {
              controller.close()
              return
            }
          }
        }
      }
    },
    cancel() {
      reader.cancel()
    },
  })
}

/** Parse newline-delimited JSON stream (Ollama format) */
export function parseNDJSONStream(
  response: Response,
  extractChunk: (json: Record<string, unknown>) => ChatChunk | null,
): ReadableStream<ChatChunk> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return new ReadableStream<ChatChunk>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          return
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const json = JSON.parse(line) as Record<string, unknown>
            const chunk = extractChunk(json)
            if (chunk) {
              controller.enqueue(chunk)
              if (chunk.done) {
                controller.close()
                return
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    },
    cancel() {
      reader.cancel()
    },
  })
}

/** Convert a ReadableStream<ChatChunk> to a full string by consuming it */
export async function streamToString(stream: ReadableStream<ChatChunk>): Promise<string> {
  const reader = stream.getReader()
  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += value.text
  }
  return result
}

/** Create a single-value stream (for non-streaming providers) */
export function singleChunkStream(text: string): ReadableStream<ChatChunk> {
  return new ReadableStream<ChatChunk>({
    start(controller) {
      controller.enqueue({ text, done: false })
      controller.enqueue({ text: '', done: true })
      controller.close()
    },
  })
}
