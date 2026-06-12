export { aiService, AIService, isNoProviderError, isCancelledError, streamToString } from './AIService'
export { AIServiceError, makeAIError } from './types'
export type { AIProvider } from './types'
export { OllamaProvider } from './providers/OllamaProvider'
export { GeminiProvider } from './providers/GeminiProvider'
export { GroqProvider } from './providers/GroqProvider'
export { OpenAICompatibleProvider } from './providers/OpenAICompatibleProvider'
// Re-export ChatChunk so stores/components can import it from this barrel file
export type { ChatChunk } from './stream'
