/**
 * AIService — single facade for all AI capabilities.
 *
 * RULES:
 * - No UI code imports providers directly. Everything goes through AIService.
 * - If no provider is configured, every method throws AIServiceError with code='no_provider'.
 * - All methods accept AbortSignal for cancellation.
 * - Streaming is always preferred; complete() is a convenience wrapper.
 */
import type { ChatMessage, ChatOptions, ChatChunk, AIProviderConfig, AIProviderType } from '@/types/ai'
import type { AIProvider } from './types'
import { AIServiceError, makeAIError } from './types'
import { streamToString, singleChunkStream } from './stream'
import { OllamaProvider } from './providers/OllamaProvider'
import { GeminiProvider } from './providers/GeminiProvider'
import { GroqProvider } from './providers/GroqProvider'
import { OpenAICompatibleProvider } from './providers/OpenAICompatibleProvider'

// ─── Request queue item ───────────────────────────────────────────────

interface QueueItem {
  id: string
  execute: () => Promise<void>
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
  controller: AbortController
}

export class AIService {
  private _provider: AIProvider | null = null
  private _config: AIProviderConfig | null = null
  private _queue: QueueItem[] = []
  private _processing = false
  private _requestCounter = 0

  /** Configure the active provider. Called from Settings. */
  configure(config: AIProviderConfig): void {
    this._config = config
    this._provider = this._buildProvider(config)
  }

  /** True if a provider is configured and enabled */
  get isConfigured(): boolean {
    return this._provider !== null && (this._config?.isEnabled ?? false)
  }

  get activeProvider(): AIProviderType {
    return this._config?.type ?? 'none'
  }

  get activeModel(): string {
    return this._config?.model ?? ''
  }

  // ─── Core API ─────────────────────────────────────────────────────────

  /**
   * Stream a chat completion.
   * Returns a ReadableStream<ChatChunk> that yields tokens until done=true.
   */
  async chat(
    messages: ChatMessage[],
    options?: ChatOptions,
  ): Promise<ReadableStream<ChatChunk>> {
    this._assertConfigured()
    return this._provider!.chat(messages, options)
  }

  /**
   * Stream a chat completion with a system prompt.
   */
  async chatWithSystem(
    systemPrompt: string,
    userMessage: string,
    options?: ChatOptions,
  ): Promise<ReadableStream<ChatChunk>> {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]
    return this.chat(messages, options)
  }

  /** Non-streaming completion — waits for the full response */
  async complete(prompt: string, options?: ChatOptions): Promise<string> {
    const stream = await this.chatWithSystem('', prompt, options)
    return streamToString(stream)
  }

  /** Generate embeddings for RAG */
  async embed(texts: string[]): Promise<number[][]> {
    this._assertConfigured()
    return this._provider!.embed(texts)
  }

  /** Vision / image understanding */
  async vision(imageBase64: string, prompt: string, mimeType?: string): Promise<string> {
    this._assertConfigured()
    return this._provider!.vision(imageBase64, prompt, mimeType)
  }

  /** Test the current provider connection */
  async testConnection(): Promise<boolean> {
    if (!this._provider) return false
    return this._provider.testConnection()
  }

  // ─── High-level AI Features ───────────────────────────────────────────

  /** Summarize content in a specific format */
  async summarize(
    content: string,
    format: 'bullets' | 'paragraph' | 'tldr' | 'executive' | 'key-concepts',
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatChunk>> {
    const formatInstructions: Record<typeof format, string> = {
      bullets: 'Format the summary as a concise bullet-point list with the most important points.',
      paragraph: 'Write a clear summary paragraph.',
      tldr: 'Write a single sentence TL;DR summary.',
      executive: 'Write an executive summary with: Key Points, Main Arguments, Conclusions.',
      'key-concepts': 'Extract and define the key concepts. Format as: Concept: Definition.',
    }

    const prompt = `${formatInstructions[format]}

Content to summarize:
---
${content}
---`

    return this.chatWithSystem(
      'You are a precise, accurate study assistant. Summarize clearly and concisely.',
      prompt,
      { signal },
    )
  }

  /** Explain selected text */
  async explain(
    text: string,
    mode: 'standard' | 'eli5' | 'technical' | 'historical',
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatChunk>> {
    const modeInstructions: Record<typeof mode, string> = {
      standard: 'Explain this clearly and accessibly.',
      eli5: "Explain this like I'm 5 years old, using simple words and relatable analogies.",
      technical: 'Give a deep technical explanation with precise terminology, mechanisms, and details.',
      historical: 'Explain the historical context, origin, and development of this concept or event.',
    }

    return this.chatWithSystem(
      `You are an expert tutor. ${modeInstructions[mode]}`,
      `Please explain:\n\n${text}`,
      { signal },
    )
  }

  /** Generate flashcards from content */
  async generateFlashcards(
    content: string,
    count = 10,
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatChunk>> {
    const prompt = `Create exactly ${count} flashcards from the following content.

Return ONLY a valid JSON array. Each flashcard must have this exact structure:
[
  { "front": "Question or concept", "back": "Answer or explanation" }
]

Content:
---
${content}
---

Rules:
- Focus on the most important, testable concepts
- Questions should be specific and unambiguous
- Answers should be complete but concise
- Include definitions, formulas, key dates, cause-effect relationships`

    return this.chatWithSystem(
      'You are an expert study tool. Generate high-quality flashcards. Return only JSON, no other text.',
      prompt,
      { signal },
    )
  }

  /** Generate quiz questions */
  async generateQuestions(
    content: string,
    count: number,
    type: 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-blank' | 'mixed',
    difficulty: 'easy' | 'medium' | 'hard' | 'mixed',
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatChunk>> {
    const prompt = `Generate ${count} ${type === 'mixed' ? '' : type} questions at ${difficulty} difficulty.

Return ONLY a valid JSON array with this structure:
[
  {
    "type": "multiple-choice|true-false|short-answer|fill-blank",
    "question": "...",
    "options": ["A", "B", "C", "D"],  // only for multiple-choice
    "correctAnswer": "...",
    "explanation": "Why this is correct"
  }
]

Source content:
---
${content}
---`

    return this.chatWithSystem(
      'You are an expert educator. Create high-quality assessment questions. Return only JSON.',
      prompt,
      { signal },
    )
  }

  /** Rewrite / improve text */
  async rewrite(
    text: string,
    style: 'formal' | 'casual' | 'simpler' | 'concise' | 'grammar' | 'expand' | 'bullets' | 'prose',
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatChunk>> {
    const instructions: Record<typeof style, string> = {
      formal: 'Rewrite this in a formal, professional tone.',
      casual: 'Rewrite this in a casual, conversational tone.',
      simpler: 'Simplify this text. Use shorter sentences and simpler vocabulary.',
      concise: 'Make this more concise. Remove redundancy, keep all key information.',
      grammar: 'Fix all grammar, spelling, and punctuation errors. Preserve the original meaning exactly.',
      expand: 'Expand this with more detail, examples, and explanation.',
      bullets: 'Convert this to a clear bullet-point list.',
      prose: 'Convert these bullet points into flowing, well-structured prose.',
    }

    return this.chatWithSystem(
      'You are a skilled writing assistant. Rewrite the provided text exactly as instructed. Return only the rewritten text.',
      `${instructions[style]}\n\nText:\n${text}`,
      { signal },
    )
  }

  /** Generate a study outline */
  async generateOutline(topic: string, signal?: AbortSignal): Promise<ReadableStream<ChatChunk>> {
    return this.chatWithSystem(
      'You are an expert educator. Generate comprehensive, hierarchical study outlines.',
      `Create a detailed hierarchical study outline for: "${topic}"

Format as a nested structure with:
- H1: Main topic sections
  - H2: Sub-topics
    - H3: Specific concepts, key points, examples
    
Include: definitions, key formulas, important dates, cause-effect relationships, common exam points.`,
      { signal },
    )
  }

  /** Generate a mind map JSON structure */
  async generateMindMap(
    topic: string,
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatChunk>> {
    return this.chatWithSystem(
      'You are an expert at creating structured knowledge maps. Return only valid JSON.',
      `Create a mind map for: "${topic}"

Return ONLY this exact JSON structure:
{
  "center": "Main Topic",
  "branches": [
    {
      "label": "Branch 1",
      "color": "#7C6FFF",
      "children": [
        { "label": "Sub-concept 1", "children": [] },
        { "label": "Sub-concept 2", "children": [] }
      ]
    }
  ]
}

Include 5-8 main branches, each with 3-5 sub-concepts. Use varied colors from: #7C6FFF, #3ECFB2, #FFBB38, #FF5263, #4DA6FF, #FF9040`,
      { signal },
    )
  }

  /** Ask My Notes — RAG-style query with context */
  async askWithContext(
    question: string,
    context: string,
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatChunk>> {
    const prompt = `Answer the question using ONLY the provided notes as context.
If the answer is not in the notes, say "I couldn't find information about this in your notes."
Always cite which part of the notes you used.

Notes:
---
${context}
---

Question: ${question}`

    return this.chatWithSystem(
      'You are a precise study assistant. Answer questions using only the provided notes. Be specific and cite your sources.',
      prompt,
      { signal },
    )
  }

  /** Translate text */
  async translate(
    text: string,
    targetLanguage: string,
    keepOriginal = false,
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatChunk>> {
    const instruction = keepOriginal
      ? `Translate the following text to ${targetLanguage}. Show the translation followed by the original text in parentheses.`
      : `Translate the following text to ${targetLanguage}. Return only the translation.`

    return this.chatWithSystem(
      'You are an expert translator. Preserve meaning, tone, and formatting.',
      `${instruction}\n\nText:\n${text}`,
      { signal },
    )
  }

  /** Generate AI weekly coach report */
  async generateCoachReport(
    activityData: string,
    signal?: AbortSignal,
  ): Promise<ReadableStream<ChatChunk>> {
    return this.chatWithSystem(
      `You are a personal study coach and learning science expert. Be honest, specific, and actionable.
Your report should feel like a message from a knowledgeable friend who has been watching the student study.
Be direct about what needs improvement, but also acknowledge genuine progress.`,
      `Analyze this week's study data and write a personal performance report.

${activityData}

Write a report with these sections:
1. **This Week's Overview** — what was accomplished
2. **What Went Well** — genuine positives, be specific  
3. **Areas to Improve** — honest, specific, actionable
4. **Retention Analysis** — based on flashcard/quiz performance
5. **Next Week's Priorities** — 3 specific, actionable recommendations
6. **Motivational Note** — personalized to their actual performance (not generic)`,
      { signal },
    )
  }

  /** Generate AI notification message with tone */
  async generateNotification(
    type: string,
    context: string,
    tone: 'motivational' | 'neutral' | 'sarcastic' | 'tough-love',
  ): Promise<string> {
    const toneInstructions: Record<typeof tone, string> = {
      motivational: 'Be genuinely encouraging and inspiring. Reference their specific situation.',
      neutral: 'Be factual and direct. No fluff, just the relevant information.',
      sarcastic: 'Be lightly sarcastic and witty, but not mean. Like a friend teasing you about procrastinating.',
      'tough-love': 'Be honest and direct about what needs to happen. No sugarcoating, but still supportive.',
    }

    const prompt = `Write a push notification for a study app.

Notification type: ${type}
Context: ${context}
Tone: ${toneInstructions[tone]}

Rules:
- Maximum 100 characters
- Do not use generic motivational quotes
- Reference the specific situation
- Return only the notification text, nothing else`

    return this.complete(prompt, { signal: AbortSignal.timeout(10000) })
  }

  // ─── Ollama-specific ──────────────────────────────────────────────────

  async listOllamaModels(): Promise<Array<{ name: string; size: number; modifiedAt: string }>> {
    if (this._provider instanceof OllamaProvider) {
      return this._provider.listModels()
    }
    return []
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private _assertConfigured(): void {
    if (!this._provider || !this._config?.isEnabled) {
      throw new AIServiceError(
        makeAIError('no_provider', 'No AI provider configured. Go to Settings → AI to set one up.'),
        'No AI provider configured',
      )
    }
  }

  private _buildProvider(config: AIProviderConfig): AIProvider | null {
    if (!config.isEnabled || config.type === 'none') return null

    switch (config.type) {
      case 'ollama':
        return new OllamaProvider(
          config.baseUrl ?? 'http://localhost:11434',
          config.model,
          config.visionModel,
          config.embeddingModel,
        )

      case 'gemini':
        if (!config.apiKey) return null
        return new GeminiProvider(config.apiKey, config.model)

      case 'groq':
        if (!config.apiKey) return null
        return new GroqProvider(config.apiKey, config.model)

      case 'openrouter':
        if (!config.apiKey) return null
        return new OpenAICompatibleProvider(
          'openrouter', 'OpenRouter',
          'https://openrouter.ai/api/v1',
          config.model, config.apiKey,
        )

      case 'openai':
        if (!config.apiKey) return null
        return new OpenAICompatibleProvider(
          'openai', 'OpenAI',
          'https://api.openai.com/v1',
          config.model, config.apiKey,
        )

      case 'anthropic':
        // Anthropic uses a different API format — stub as custom for now
        if (!config.apiKey) return null
        return new OpenAICompatibleProvider(
          'anthropic', 'Anthropic Claude',
          'https://api.anthropic.com/v1',
          config.model, config.apiKey,
        )

      case 'lmstudio':
        return new OpenAICompatibleProvider(
          'lmstudio', 'LM Studio',
          config.baseUrl ?? 'http://localhost:1234/v1',
          config.model, config.apiKey,
        )

      case 'jan':
        return new OpenAICompatibleProvider(
          'jan', 'Jan',
          config.baseUrl ?? 'http://localhost:1337/v1',
          config.model, config.apiKey,
        )

      case 'custom':
        if (!config.baseUrl) return null
        return new OpenAICompatibleProvider(
          'custom', config.name ?? 'Custom',
          config.baseUrl, config.model, config.apiKey,
        )

      default:
        return null
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────

export const aiService = new AIService()

// ─── Graceful degradation helper ─────────────────────────────────────

/**
 * Returns true if the error means "no AI configured" so UI can show a CTA.
 */
export function isNoProviderError(err: unknown): boolean {
  return err instanceof AIServiceError && err.error.code === 'no_provider'
}

export function isCancelledError(err: unknown): boolean {
  return err instanceof AIServiceError && err.error.code === 'cancelled'
}

// Re-export stream utility
export { streamToString, singleChunkStream }
export type { ChatChunk }
