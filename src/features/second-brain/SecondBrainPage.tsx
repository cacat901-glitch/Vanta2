import { useState, useRef } from 'react'
import { Sparkles, Send, Loader2 } from 'lucide-react'
import { ragAnswer, type RetrievedChunk } from '@/services/rag'
import { aiService, isNoProviderError } from '@/services/ai'
import { useAppStore } from '@/store/appStore'
import { AISetupPrompt } from '@/components/ai/AISetupPrompt'
import { truncate } from '@/lib/utils'

const SUGGESTIONS = [
  'What have I learned this week?',
  'Summarize everything I know about this topic',
  'What concepts appear across multiple courses?',
  'What should I review based on my notes?',
]

export function SecondBrainPage() {
  const toast = useAppStore((s) => s.addToast)
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [sources, setSources] = useState<RetrievedChunk[]>([])
  const [loading, setLoading] = useState(false)
  const [asked, setAsked] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const ask = async (q: string) => {
    if (!q.trim()) return
    if (!aiService.isConfigured) { toast({ type: 'warning', title: 'Set up AI in Settings' }); return }
    setAsked(true); setLoading(true); setAnswer(''); setSources([])
    try {
      const { stream, sources: src } = await ragAnswer(q)
      setSources(src)
      const reader = stream.getReader()
      let acc = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        acc += value.text
        setAnswer(acc)
        endRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    } catch (err) {
      if (isNoProviderError(err)) toast({ type: 'warning', title: 'No AI provider configured' })
      else setAnswer('Something went wrong querying your knowledge base.')
    } finally { setLoading(false) }
  }

  if (!aiService.isConfigured) {
    return <div className="flex h-full items-center justify-center"><div className="w-80"><AISetupPrompt /></div></div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {!asked ? (
            <div className="flex flex-col items-center gap-5 py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent-primary/15 flex items-center justify-center"><Sparkles size={28} className="text-accent-primary" /></div>
              <div>
                <h1 className="text-2xl font-bold text-text-primary">Second Brain</h1>
                <p className="text-text-muted text-sm mt-1 max-w-md">Ask anything across all your notes, PDFs, and lectures. Answers are grounded in your own knowledge base with citations.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => { setQuery(s); void ask(s) }}
                    className="text-left px-3 py-2.5 rounded-lg bg-surface border border-border-subtle hover:border-accent-primary/40 text-sm text-text-secondary hover:text-text-primary transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl bg-surface border border-border-subtle p-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Answer</p>
                {loading && !answer ? <Loader2 className="animate-spin text-accent-primary" /> :
                  <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{answer}{loading && <span className="inline-block w-1.5 h-4 bg-accent-primary/60 animate-pulse ml-0.5" />}</p>}
              </div>

              {sources.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Sources ({sources.length})</p>
                  <div className="space-y-1.5">
                    {sources.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-surface/60 text-xs">
                        <span className="w-5 h-5 rounded bg-accent-primary/15 text-accent-primary flex items-center justify-center flex-shrink-0 font-medium">{i + 1}</span>
                        <span className="text-text-secondary">{truncate(s.content, 180)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      {/* Query input */}
      <div className="border-t border-border-subtle p-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void ask(query) }}
            placeholder="Ask your knowledge base anything…"
            className="flex-1 bg-surface border border-border-default rounded-lg px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-accent-primary/60" />
          <button onClick={() => ask(query)} disabled={loading || !query.trim()}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-accent-primary text-white hover:bg-accent-hover disabled:opacity-40 transition-colors">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  )
}
