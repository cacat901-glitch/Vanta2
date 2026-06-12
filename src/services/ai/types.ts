import type { ChatMessage, ChatOptions, ChatChunk, AIError, AIProviderType } from '@/types/ai'

/** Every provider implements this interface. Nothing else is needed. */
export interface AIProvider {
  readonly type: AIProviderType
  readonly name: string

  /** Streaming chat — yields chunks until done=true */
  chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ReadableStream<ChatChunk>>

  /** Single-shot completion (non-streaming) */
  complete(prompt: string, options?: ChatOptions): Promise<string>

  /** Generate embeddings for an array of texts */
  embed(texts: string[]): Promise<number[][]>

  /** Describe / extract text from an image (base64 encoded) */
  vision(imageBase64: string, prompt: string, mimeType?: string): Promise<string>

  /** Test the connection — returns true if reachable */
  testConnection(): Promise<boolean>
}

/** Structured error thrown by all providers */
export class AIServiceError extends Error {
  constructor(
    public readonly error: AIError,
    message: string,
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

/** Build a structured AIError */
export function makeAIError(
  code: AIError['code'],
  message: string,
  provider?: AIProviderType,
  retryable = false,
): AIError {
  return { code, message, provider, retryable }
}
