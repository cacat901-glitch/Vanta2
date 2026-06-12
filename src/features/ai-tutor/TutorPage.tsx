import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, StopCircle, GraduationCap, RotateCcw } from 'lucide-react'
import { TUTOR_MODES, getModeDef } from './tutorPrompts'
import { aiService, isNoProviderError } from '@/services/ai'
import { useAppStore } from '@/store/appStore'
import { AISetupPrompt } from '@/components/ai/AISetupPrompt'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { AITutorMode, ChatMessage } from '@/types/ai'

interface Msg { role: 'user' | 'assistant'; content: string; streaming?: boolean }

export function TutorPage() {
  const [mode, setMode] = useState<AITutorMode>('standard')
  const [started, setStarted] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const toast = useAppStore((s) => s.addToast)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const isConfigured = aiService.isConfigured

  const send = useCallback(async (text: string, history: Msg[]) => {
    setStreaming(true)
    const controller = new AbortController()
    controllerRef.current = controller
    setMessages((m) => [...m, { role: 'assistant', content: '', streaming: true }])
    try {
      const chatHistory: ChatMessage[] = [
        { role: 'system', content: getModeDef(mode).systemPrompt },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: text },
      ]
      const stream = await aiService.chat(chatHistory, { signal: controller.signal })
      const reader = stream.getReader()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += value.text
        setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: acc, streaming: !value.done }; return c })
      }
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: acc, streaming: false }; return c })
    } catch (err) {
      if (isNoProviderError(err)) toast({ type: 'warning', title: 'Set up AI in Settings' })
      setMessages((m) => { const c = [...m]; c[c.length - 1] = { role: 'assistant', content: 'Error generating response.', streaming: false }; return c })
    } finally {
      setStreaming(false); controllerRef.current = null
    }
  }, [mode, toast])

  const startSession = async () => {
    setStarted(true)
    setMessages([])
    const topic = prompt('What topic would you like to study?', '')
    const opener = topic
      ? `Let's study ${topic}. Begin the session.`
      : 'Begin a tutoring session. Ask me what I want to learn.'
    await send(opener, [])
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text || streaming) return
    const history = messages
    setMessages((m) => [...m, { role: 'user', content: text }])
    setInput('')
    void send(text, history)
  }

  if (!isConfigured) {
    return <div className="flex h-full items-center justify-center"><div className="w-80"><AISetupPrompt /></div></div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode selector */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle overflow-x-auto no-scrollbar">
        <GraduationCap size={16} className="text-accent-primary flex-shrink-0" />
        {TUTOR_MODES.map((m) => (
          <button key={m.id} onClick={() => { setMode(m.id); setStarted(false); setMessages([]) }}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors',
              mode === m.id ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-secondary hover:bg-surface')}>
            <span>{m.emoji}</span> {m.label}
          </button>
        ))}
      </div>

      {!started ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="text-5xl">{getModeDef(mode).emoji}</div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">{getModeDef(mode).label}</h2>
            <p className="text-text-muted text-sm mt-1 max-w-sm">{getModeDef(mode).description}</p>
          </div>
          <Button onClick={startSession}>Start session</Button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                    m.role === 'user' ? 'bg-accent-primary/15 text-text-primary rounded-tr-sm' : 'bg-surface text-text-primary rounded-tl-sm border border-border-subtle')}>
                    {m.content}
                    {m.streaming && <span className="inline-block w-1.5 h-4 bg-accent-primary/60 animate-pulse ml-0.5 rounded-sm" />}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          </div>

          <div className="border-t border-border-subtle p-3">
            <div className="max-w-2xl mx-auto flex items-end gap-2">
              <Button variant="ghost" size="icon" onClick={startSession} title="New session"><RotateCcw size={16} /></Button>
              <textarea
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Type your answer or question…" rows={1}
                className="flex-1 bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-primary/60 resize-none max-h-32"
              />
              {streaming ? (
                <Button variant="destructive" size="icon" onClick={() => controllerRef.current?.abort()}><StopCircle size={16} /></Button>
              ) : (
                <Button size="icon" onClick={handleSend} disabled={!input.trim()}><Send size={15} /></Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
