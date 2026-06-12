// ─── AI Provider Types ────────────────────────────────────────────────

export type AIProviderType =
  | 'ollama'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'lmstudio'
  | 'jan'
  | 'llamacpp'
  | 'koboldcpp'
  | 'textgenwebui'
  | 'openwebui'
  | 'custom'
  | 'none'

export interface AIProviderConfig {
  type: AIProviderType
  name: string
  baseUrl?: string
  apiKey?: string
  model: string
  embeddingModel?: string
  visionModel?: string
  audioModel?: string
  maxTokens?: number
  temperature?: number
  isEnabled: boolean
}

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
  details?: {
    family: string
    parameterSize: string
    quantizationLevel: string
  }
}

// ─── AI Request/Response Types ────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | ChatMessageContent[]
}

export interface ChatMessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  stream?: boolean
  signal?: AbortSignal
  systemPrompt?: string
}

export interface ChatChunk {
  text: string
  done: boolean
}

export interface EmbedRequest {
  texts: string[]
  model?: string
}

export interface TranscribeRequest {
  audioBlob: Blob
  language?: string
  prompt?: string
}

export interface TranscriptionResult {
  text: string
  segments?: Array<{
    text: string
    start: number
    end: number
  }>
}

export interface VisionRequest {
  imageBase64: string
  prompt: string
  mimeType?: string
}

// ─── AI Feature Types ─────────────────────────────────────────────────

export type SummarizeFormat =
  | 'bullets'
  | 'paragraph'
  | 'tldr'
  | 'executive'
  | 'key-concepts'

export type ExplainMode =
  | 'standard'
  | 'eli5'
  | 'technical'
  | 'historical'

export type QuestionType =
  | 'multiple-choice'
  | 'true-false'
  | 'short-answer'
  | 'fill-blank'
  | 'essay'
  | 'scenario'

export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed'

export type AITutorMode =
  | 'standard'
  | 'friendly'
  | 'socratic'
  | 'professor'
  | 'exam-coach'
  | 'oral-examiner'
  | 'debate-partner'
  | 'interview-simulator'

export type NotificationTone =
  | 'motivational'
  | 'neutral'
  | 'sarcastic'
  | 'tough-love'

// ─── AI Conversation ──────────────────────────────────────────────────

export interface AIConversation {
  id: string
  title: string
  contextObjectIds: string[]
  messages: ChatMessage[]
  provider: AIProviderType
  model: string
  createdAt: Date
  updatedAt: Date
}

export interface TutorSession {
  id: string
  mode: AITutorMode
  courseId: string | null
  summary: string | null
  conceptsCovered: string[]
  weaknessReport: string | null
  createdAt: Date
}

export interface OralExamSession {
  id: string
  courseId: string | null
  topics: string[]
  transcript: Array<{ role: 'examiner' | 'student'; text: string; score?: number }>
  scores: Record<string, number>
  overallGrade: number | null
  feedback: string | null
  takenAt: Date
}

// ─── AI Service Error ─────────────────────────────────────────────────

export type AIErrorCode =
  | 'no_provider'
  | 'connection_failed'
  | 'auth_failed'
  | 'rate_limited'
  | 'context_too_long'
  | 'model_not_found'
  | 'cancelled'
  | 'unknown'

export interface AIError {
  code: AIErrorCode
  message: string
  provider?: AIProviderType
  retryable: boolean
}
