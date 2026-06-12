import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatMessage } from '@/types/ai'
import { aiService, isNoProviderError, isCancelledError, streamToString } from '@/services/ai'
import type { ChatChunk } from '@/types/ai'

export type AIRequestStatus = 'idle' | 'streaming' | 'complete' | 'error' | 'cancelled'

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  isStreaming: boolean
  error?: string
  timestamp: Date
}

interface AIState {
  // ─── Conversation ─────────────────────────────────────────────────────
  messages: AIMessage[]
  status: AIRequestStatus
  currentStreamController: AbortController | null
  currentStreamText: string

  // ─── Inline generation (used in editor, canvas, etc.) ─────────────────
  inlineResult: string | null
  inlineStatus: AIRequestStatus

  // ─── Provider state ───────────────────────────────────────────────────
  isConfigured: boolean
  providerName: string
  modelName: string

  // ─── Actions ──────────────────────────────────────────────────────────
  sendMessage: (content: string, contextText?: string) => Promise<void>
  cancelStream: () => void
  clearConversation: () => void

  runInline: (prompt: string, signal?: AbortSignal) => Promise<string>
  cancelInline: () => void

  // Quick commands from AI panel
  summarize: (content: string, format?: 'bullets' | 'paragraph' | 'tldr') => Promise<void>
  explain: (text: string, mode?: 'standard' | 'eli5' | 'technical') => Promise<void>
  generateFlashcards: (content: string, count?: number) => Promise<void>
  rewrite: (text: string, style: 'formal' | 'casual' | 'simpler' | 'concise' | 'grammar' | 'expand' | 'bullets' | 'prose') => Promise<void>

  // Sync provider state from settings
  syncProvider: () => void
}

let _inlineController: AbortController | null = null

export const useAIStore = create<AIState>()(
  immer((set, get) => ({
    messages: [],
    status: 'idle',
    currentStreamController: null,
    currentStreamText: '',
    inlineResult: null,
    inlineStatus: 'idle',
    isConfigured: false,
    providerName: '',
    modelName: '',

    syncProvider: () => {
      set((s) => {
        s.isConfigured = aiService.isConfigured
        s.providerName = aiService.activeProvider
        s.modelName = aiService.activeModel
      })
    },

    sendMessage: async (content, contextText) => {
      const { messages, status } = get()
      if (status === 'streaming') return

      // Build user message
      const userMsg: AIMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        isStreaming: false,
        timestamp: new Date(),
      }

      // Build assistant placeholder
      const assistantMsg: AIMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: new Date(),
      }

      set((s) => {
        s.messages.push(userMsg)
        s.messages.push(assistantMsg)
        s.status = 'streaming'
        s.currentStreamText = ''
      })

      const controller = new AbortController()
      set((s) => { s.currentStreamController = controller })

      try {
        // Build conversation history for the API
        const history: ChatMessage[] = messages
          .filter((m) => !m.isStreaming)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        history.push({ role: 'user', content: content })

        // Add context if provided
        const systemPrompt = contextText
          ? `You are a helpful study assistant. Use the following notes as context when answering:

${contextText}

If asked about something not in the notes, you can draw on your general knowledge but say so.`
          : `You are StudyOS AI — a smart, precise, helpful study assistant. 
Help the user understand concepts, answer questions, and assist with their studies.`

        const stream = await aiService.chatWithSystem(systemPrompt, content, {
          signal: controller.signal,
        })

        const reader = stream.getReader()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = value as ChatChunk
          accumulated += chunk.text

          set((s) => {
            const msg = s.messages.find((m) => m.id === assistantMsg.id)
            if (msg) {
              msg.content = accumulated
              msg.isStreaming = !chunk.done
            }
            s.currentStreamText = accumulated
          })
        }

        set((s) => {
          const msg = s.messages.find((m) => m.id === assistantMsg.id)
          if (msg) { msg.isStreaming = false }
          s.status = 'complete'
          s.currentStreamController = null
        })
      } catch (err) {
        const isCancelled = isCancelledError(err)
        const isNoProvider = isNoProviderError(err)

        set((s) => {
          const msg = s.messages.find((m) => m.id === assistantMsg.id)
          if (msg) {
            msg.isStreaming = false
            msg.error = isCancelled
              ? 'Generation cancelled'
              : isNoProvider
                ? 'No AI provider configured. Go to Settings → AI.'
                : err instanceof Error ? err.message : 'Unknown error'
            msg.content = msg.error
          }
          s.status = isCancelled ? 'cancelled' : 'error'
          s.currentStreamController = null
        })
      }
    },

    cancelStream: () => {
      const { currentStreamController } = get()
      if (currentStreamController) {
        currentStreamController.abort()
        set((s) => {
          s.status = 'cancelled'
          s.currentStreamController = null
          // Mark last message as not streaming
          const last = s.messages[s.messages.length - 1]
          if (last?.role === 'assistant') last.isStreaming = false
        })
      }
    },

    clearConversation: () =>
      set((s) => {
        s.messages = []
        s.status = 'idle'
        s.currentStreamText = ''
      }),

    runInline: async (prompt, signal) => {
      // Cancel any previous inline request
      _inlineController?.abort()
      _inlineController = new AbortController()
      const combinedSignal = signal ?? _inlineController.signal

      set((s) => { s.inlineStatus = 'streaming'; s.inlineResult = null })

      try {
        const stream = await aiService.chat(
          [{ role: 'user', content: prompt }],
          { signal: combinedSignal },
        )
        const result = await streamToString(stream)
        set((s) => { s.inlineResult = result; s.inlineStatus = 'complete' })
        return result
      } catch (err) {
        if (isCancelledError(err)) {
          set((s) => { s.inlineStatus = 'cancelled' })
          return ''
        }
        const msg = err instanceof Error ? err.message : 'AI error'
        set((s) => { s.inlineStatus = 'error'; s.inlineResult = msg })
        throw err
      }
    },

    cancelInline: () => {
      _inlineController?.abort()
      set((s) => { s.inlineStatus = 'cancelled' })
    },

    summarize: async (content, format = 'bullets') => {
      const { status } = get()
      if (status === 'streaming') return
      const label = { bullets: 'bullet points', paragraph: 'paragraph', tldr: 'TL;DR' }[format]
      get().sendMessage(`Please summarize this content as ${label}:\n\n${content}`)
    },

    explain: async (text, mode = 'standard') => {
      const { status } = get()
      if (status === 'streaming') return
      get().sendMessage(`Please explain this (${mode} mode):\n\n${text}`)
    },

    generateFlashcards: async (content, count = 10) => {
      const { status } = get()
      if (status === 'streaming') return
      get().sendMessage(`Generate ${count} flashcards from this content:\n\n${content}`)
    },

    rewrite: async (text, style) => {
      const { status } = get()
      if (status === 'streaming') return
      get().sendMessage(`Rewrite this text (${style}):\n\n${text}`)
    },
  })),
)
