import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { aiService } from '@/services/ai'
import { speak, listen, isSTTAvailable, type STTSession } from '@/lib/speech'
import { usePlannerStore } from '@/store/plannerStore'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'

interface Turn { role: 'user' | 'assistant'; text: string }

export function VoiceAssistantPage() {
  const navigate = useNavigate()
  const toast = useAppStore((s) => s.addToast)
  const createTask = usePlannerStore((s) => s.createTask)
  const startPomodoro = usePlannerStore((s) => s.startPomodoro)
  const [listening, setListening] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [interim, setInterim] = useState('')
  const sttRef = useRef<STTSession | null>(null)

  const handleCommand = async (text: string) => {
    setTurns((t) => [...t, { role: 'user', text }])
    const lower = text.toLowerCase()

    // Local command parsing
    if (lower.includes('pomodoro') || lower.includes('focus timer')) {
      startPomodoro(); respond('Starting a Pomodoro focus session.'); navigate('/planner'); return
    }
    if (lower.startsWith('add task') || lower.startsWith('create task') || lower.startsWith('remind me')) {
      const title = text.replace(/^(add task|create task|remind me to|remind me)/i, '').trim()
      if (title) { await createTask({ title, priority: 'P3', dueAt: new Date() }); respond(`Added task: ${title}`); return }
    }
    if (lower.includes('flashcard')) { respond('Opening your flashcards.'); navigate('/flashcards'); return }
    if (lower.includes('my notes') || lower.includes('notebook')) { respond('Opening your notebooks.'); navigate('/notebooks'); return }

    // Otherwise: ask AI
    if (!aiService.isConfigured) { respond('Set up an AI provider in Settings to ask me questions.'); return }
    setThinking(true)
    try {
      const answer = await aiService.complete(`Answer concisely for a voice assistant (2-3 sentences max): ${text}`)
      respond(answer)
    } catch { respond('Sorry, I had trouble with that.') }
    finally { setThinking(false) }
  }

  const respond = (text: string) => {
    setTurns((t) => [...t, { role: 'assistant', text }])
    speak(text)
  }

  const toggle = () => {
    if (listening) { sttRef.current?.stop(); setListening(false); return }
    if (!isSTTAvailable()) { toast({ type: 'warning', title: 'Voice not supported in this browser' }); return }
    setInterim('')
    sttRef.current = listen(
      (final) => { setListening(false); setInterim(''); void handleCommand(final) },
      (text) => setInterim(text),
    )
    setListening(true)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto">
          {turns.length === 0 ? (
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold text-text-primary">Voice Assistant</h1>
              <p className="text-text-muted text-sm mt-1">Tap the mic and try: "Start a Pomodoro", "Add task read chapter 3", "Quiz me on biology", or ask anything.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {turns.map((t, i) => (
                <div key={i} className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                    t.role === 'user' ? 'bg-accent-primary/15 text-text-primary' : 'bg-surface border border-border-subtle text-text-primary')}>
                    {t.text}
                  </div>
                </div>
              ))}
              {interim && <div className="flex justify-end"><div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-accent-primary/10 text-text-muted italic">{interim}</div></div>}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 py-8 border-t border-border-subtle">
        <button onClick={toggle}
          className={cn('w-20 h-20 rounded-full flex items-center justify-center transition-all',
            listening ? 'bg-danger text-white animate-ai-pulse' : 'bg-accent-primary text-white hover:bg-accent-hover')}>
          {thinking ? <Loader2 size={28} className="animate-spin" /> : listening ? <MicOff size={28} /> : <Mic size={28} />}
        </button>
        <p className="text-xs text-text-muted">{listening ? 'Listening…' : thinking ? 'Thinking…' : 'Tap to speak'}</p>
      </div>
    </div>
  )
}
