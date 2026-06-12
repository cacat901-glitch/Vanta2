import { useRef, useEffect, useState } from 'react'
import {
  Bot, X, Send, StopCircle, Trash2, Sparkles,
  FileText, RotateCcw, Languages, Lightbulb, BookOpen,
  ChevronDown, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAIStore } from '@/store/aiStore'
import { useAppStore } from '@/store/appStore'
import { AISetupPrompt } from '../ai/AISetupPrompt'
import { AIMessageBubble } from '../ai/AIMessageBubble'

interface AIPanelProps {
  className?: string
}

type QuickAction = {
  icon: LucideIcon
  label: string
  description: string
  action: () => void
}

export function AIPanel({ className }: AIPanelProps) {
  const [input, setInput] = useState('')
  const [quickActionsOpen, setQuickActionsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const messages = useAIStore((s) => s.messages)
  const status = useAIStore((s) => s.status)
  const isConfigured = useAIStore((s) => s.isConfigured)
  const sendMessage = useAIStore((s) => s.sendMessage)
  const cancelStream = useAIStore((s) => s.cancelStream)
  const clearConversation = useAIStore((s) => s.clearConversation)
  const toggleAIPanel = useAppStore((s) => s.toggleAIPanel)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  const handleSend = () => {
    const text = input.trim()
    if (!text || status === 'streaming') return
    setInput('')
    void sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const quickActions: QuickAction[] = [
    {
      icon: FileText,
      label: 'Summarize',
      description: 'Summarize selected text or current page',
      action: () => { setInput('Summarize this content as bullet points:'); inputRef.current?.focus(); setQuickActionsOpen(false) },
    },
    {
      icon: Lightbulb,
      label: 'Explain',
      description: 'Explain a concept simply',
      action: () => { setInput('Explain this to me:'); inputRef.current?.focus(); setQuickActionsOpen(false) },
    },
    {
      icon: BookOpen,
      label: 'Flashcards',
      description: 'Generate flashcards from content',
      action: () => { setInput('Generate 10 flashcards from this content:'); inputRef.current?.focus(); setQuickActionsOpen(false) },
    },
    {
      icon: RotateCcw,
      label: 'Rewrite',
      description: 'Rewrite and improve text',
      action: () => { setInput('Rewrite this more clearly and concisely:'); inputRef.current?.focus(); setQuickActionsOpen(false) },
    },
    {
      icon: Languages,
      label: 'Translate',
      description: 'Translate to any language',
      action: () => { setInput('Translate this to Spanish:'); inputRef.current?.focus(); setQuickActionsOpen(false) },
    },
    {
      icon: Sparkles,
      label: 'Ask My Notes',
      description: 'Answer questions using your notes',
      action: () => { setInput('Based on my notes, explain:'); inputRef.current?.focus(); setQuickActionsOpen(false) },
    },
  ]

  return (
    <div className={cn('flex flex-col w-80 bg-sidebar-bg border-l border-border-subtle', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-12 border-b border-border-subtle flex-shrink-0">
        <div className="w-6 h-6 rounded-md bg-accent-primary/20 flex items-center justify-center">
          <Bot size={14} className="text-accent-primary" />
        </div>
        <span className="text-sm font-medium text-text-primary flex-1">AI Assistant</span>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearConversation}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              title="Clear conversation"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={toggleAIPanel}
            className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            title="Close AI panel (⌘/)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isConfigured && <AISetupPrompt />}

      {isConfigured && (
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-3 no-scrollbar">
          {messages.length === 0 && (
            <AIWelcome onAction={(text) => { setInput(text); inputRef.current?.focus() }} />
          )}
          {messages.map((msg) => (
            <AIMessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {isConfigured && (
        <div className="flex-shrink-0 border-t border-border-subtle p-2 space-y-2">
          <div>
            <button
              onClick={() => setQuickActionsOpen(!quickActionsOpen)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors px-1"
            >
              <Sparkles size={12} />
              <span>Quick Actions</span>
              <ChevronDown size={11} className={cn('transition-transform', quickActionsOpen && 'rotate-180')} />
            </button>

            {quickActionsOpen && (
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={qa.action}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-surface hover:bg-surface-elevated text-xs text-text-secondary hover:text-text-primary transition-colors text-left"
                  >
                    <qa.icon size={11} />
                    <span>{qa.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-end gap-1.5">
            <div className={cn(
              'flex-1 relative rounded-lg border bg-surface transition-all duration-200',
              status === 'streaming'
                ? 'border-accent-primary/60 ai-generating'
                : 'border-border-default focus-within:border-accent-primary/60',
            )}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted px-3 py-2 resize-none outline-none max-h-32 overflow-y-auto"
                style={{ minHeight: '36px' }}
                onInput={(e) => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = `${Math.min(el.scrollHeight, 128)}px`
                }}
              />
            </div>

            {status === 'streaming' ? (
              <button
                onClick={cancelStream}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors flex-shrink-0"
                title="Cancel generation"
              >
                <StopCircle size={16} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-accent-primary text-white hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                title="Send (Enter)"
              >
                <Send size={15} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AIWelcome({ onAction }: { onAction: (text: string) => void }) {
  const suggestions = [
    { label: 'Summarize my notes', text: 'Summarize my recent notes as bullet points.' },
    { label: 'Explain a concept', text: 'Explain ' },
    { label: 'Create flashcards', text: 'Generate 10 flashcards from this topic: ' },
    { label: 'Quiz me', text: 'Quiz me on ' },
  ]

  return (
    <div className="space-y-4 py-4">
      <div className="text-center">
        <div className="w-12 h-12 rounded-2xl bg-accent-primary/15 flex items-center justify-center mx-auto mb-3">
          <Bot size={24} className="text-accent-primary" />
        </div>
        <p className="text-sm font-medium text-text-primary">How can I help?</p>
        <p className="text-xs text-text-muted mt-1">Ask anything about your studies</p>
      </div>
      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onAction(s.text)}
            className="w-full text-left px-3 py-2 rounded-lg bg-surface hover:bg-surface-elevated border border-border-subtle hover:border-border-default text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
