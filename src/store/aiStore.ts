import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { ChatMessage } from '@/types/ai'
import { aiService, isNoProviderError, isCancelledError, streamToString } from '@/services/ai'
import type { ChatChunk } from '@/types/ai'
import { retrieveContext } from '@/services/studyContext'
import { getDB } from '@/db'

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

  // ─── Memory / knowledge ───────────────────────────────────────────────
  conversationId: string | null
  useKnowledge: boolean
  lastSources: string[]

  // ─── Actions ──────────────────────────────────────────────────────────
  sendMessage: (content: string, contextText?: string) => Promise<void>
  cancelStream: () => void
  clearConversation: () => void
  newConversation: () => void
  loadLatestConversation: () => Promise<void>
  setUseKnowledge: (v: boolean) => void
  _persist: () => Promise<void>

  runInline: (prompt: string, signal?: AbortSignal) => Promise<string>
  cancelInline: () => void

  // Quick commands from AI panel
  summarize: (content: string, format?: 'bullets' | 'paragraph' | 'tldr') => Promise<void>
  explain: (text: string, mode?: 'standard' | 'eli5' | 'technical') => Promise<void>
  generateFlashcards: (content: string, count?: number) => Promise<void>
  rewrite: (text: string, style: 'formal' | 'casual' | 'simpler' | 'concise' | 'grammar' | 'expand' | 'bullets' | 'prose') => Promise<void>

  // Sync provider state from settings
  syncProvider: () => void

  // Push a standalone assistant message (e.g. results from canvas/PDF AI)
  pushAssistant: (text: string, userLabel?: string) => void
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
    conversationId: null,
    useKnowledge: true,
    lastSources: [],

    syncProvider: () => {
      set((s) => {
        s.isConfigured = aiService.isConfigured
        s.providerName = aiService.activeProvider
        s.modelName = aiService.activeModel
      })
    },

    pushAssistant: (text, userLabel) => {
      set((s) => {
        if (userLabel) {
          s.messages.push({ id: `msg-${Date.now()}-u`, role: 'user', content: userLabel, isStreaming: false, timestamp: new Date() })
        }
        s.messages.push({ id: `msg-${Date.now()}-a`, role: 'assistant', content: text, isStreaming: false, timestamp: new Date() })
        s.status = 'complete'
      })
    },

    sendMessage: async (content, contextText) => {
      const { messages, status, useKnowledge } = get()
      if (status === 'streaming') return

      const userMsg: AIMessage = {
        id: `msg-${Date.now()}`, role: 'user', content, isStreaming: false, timestamp: new Date(),
      }
      const assistantMsg: AIMessage = {
        id: `msg-${Date.now() + 1}`, role: 'assistant', content: '', isStreaming: true, timestamp: new Date(),
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
        // ── Retrieve relevant knowledge from the user's own materials ──
        let knowledge = ''
        let sources: string[] = []
        if (useKnowledge && !contextText) {
          try {
            const r = await retrieveContext(content, 6)
            knowledge = r.context
            sources = r.sourceIds
          } catch { /* retrieval is best-effort */ }
        }
        set((s) => { s.lastSources = sources })

        // ── Build the grounded system prompt ──
        let systemPrompt: string
        if (contextText) {
          systemPrompt = `You are StudyOS AI, the user's study assistant. Use these notes as context:\n\n${contextText}\n\nIf the answer isn't in the notes, say so, then you may use general knowledge.`
        } else if (knowledge.trim()) {
          systemPrompt = `You are StudyOS AI, the user's personal study assistant. You have access to the user's own study materials (notes, PDFs, lectures, videos). Answer using this retrieved context whenever relevant, and cite which source number you used.\n\nRETRIEVED FROM THE USER'S KNOWLEDGE BASE:\n${knowledge}\n\nIf the context doesn't cover the question, say so briefly, then answer from general knowledge.`
        } else {
          systemPrompt = `You are StudyOS AI, a precise, helpful study assistant. The user has no indexed material matching this question yet, so answer from general knowledge and, where useful, suggest what they could import or write to build their knowledge base.`
        }

        // Conversation history for multi-turn memory
        const history: ChatMessage[] = messages
          .filter((m) => !m.isStreaming && !m.error)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        history.push({ role: 'user', content })

        const fullMessages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...history,
        ]

        const stream = await aiService.chat(fullMessages, { signal: controller.signal })
        const reader = stream.getReader()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = value as ChatChunk
          accumulated += chunk.text
          set((s) => {
            const msg = s.messages.find((m) => m.id === assistantMsg.id)
            if (msg) { msg.content = accumulated; msg.isStreaming = !chunk.done }
            s.currentStreamText = accumulated
          })
        }

        set((s) => {
          const msg = s.messages.find((m) => m.id === assistantMsg.id)
          if (msg) msg.isStreaming = false
          s.status = 'complete'
          s.currentStreamController = null
        })

        // ── Persist conversation (memory across reloads) ──
        await get()._persist()
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

    // Persist current messages to the ai_conversations table.
    _persist: async () => {
      const { messages, conversationId, providerName, modelName } = get()
      const real = messages.filter((m) => !m.isStreaming && !m.error)
      if (real.length === 0) return
      const db = await getDB()
      const chatMsgs: ChatMessage[] = real.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      let id = conversationId
      if (!id) {
        const title = real[0]?.content.slice(0, 60) ?? 'Conversation'
        const conv = await db.conversations.create(title, (providerName || 'none') as never, modelName || '')
        id = conv.id
        set((s) => { s.conversationId = id })
      }
      await db.conversations.saveMessages(id, chatMsgs)
    },

    newConversation: () => set((s) => {
      s.messages = []
      s.status = 'idle'
      s.currentStreamText = ''
      s.conversationId = null
      s.lastSources = []
    }),

    loadLatestConversation: async () => {
      if (get().messages.length > 0 || get().conversationId) return
      const db = await getDB()
      const all = await db.conversations.getAll()
      const latest = all[0]
      if (!latest) return
      set((s) => {
        s.conversationId = latest.id
        s.messages = latest.messages.map((m, i) => ({
          id: `hist-${i}`,
          role: (typeof m.content === 'string' ? m.role : 'assistant') as 'user' | 'assistant',
          content: typeof m.content === 'string' ? m.content : '',
          isStreaming: false,
          timestamp: new Date(latest.updatedAt),
        }))
        s.status = 'idle'
      })
    },

    setUseKnowledge: (v) => set((s) => { s.useKnowledge = v }),

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
        s.conversationId = null
        s.lastSources = []
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
