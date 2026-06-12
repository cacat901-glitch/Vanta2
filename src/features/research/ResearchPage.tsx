import { useState, useEffect } from 'react'
import { FlaskConical, FileText, BookOpen, Loader2, Check, GitCompare, AlertTriangle, ListTree } from 'lucide-react'
import { getDB } from '@/db'
import { aiService, streamToString, isNoProviderError } from '@/services/ai'
import { useAppStore } from '@/store/appStore'
import { AISetupPrompt } from '@/components/ai/AISetupPrompt'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { KnowledgeObject } from '@/types/knowledge'

type Analysis = 'literature-review' | 'compare' | 'contradictions' | 'outline'

const ANALYSES: { id: Analysis; label: string; icon: typeof FileText; prompt: (sources: string) => string }[] = [
  { id: 'literature-review', label: 'Literature Review', icon: BookOpen,
    prompt: (s) => `Write a structured literature review synthesizing these sources:\n\n${s}` },
  { id: 'compare', label: 'Comparative Analysis', icon: GitCompare,
    prompt: (s) => `Compare and contrast these sources in a structured analysis with a comparison table:\n\n${s}` },
  { id: 'contradictions', label: 'Find Contradictions', icon: AlertTriangle,
    prompt: (s) => `Identify any contradictions, disagreements, or conflicting claims between these sources:\n\n${s}` },
  { id: 'outline', label: 'Generate Outline', icon: ListTree,
    prompt: (s) => `Generate a hierarchical essay/paper outline based on these sources:\n\n${s}` },
]

export function ResearchPage() {
  const toast = useAppStore((s) => s.addToast)
  const [objects, setObjects] = useState<KnowledgeObject[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { void (async () => { const db = await getDB(); setObjects(await db.knowledge.getAll()) })() }, [])

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const runAnalysis = async (a: Analysis) => {
    if (selected.size === 0) { toast({ type: 'warning', title: 'Select at least one source' }); return }
    if (!aiService.isConfigured) { toast({ type: 'warning', title: 'Set up AI in Settings' }); return }
    setLoading(true); setResult('')
    try {
      const sources = objects.filter((o) => selected.has(o.id))
        .map((o) => `### ${o.title}\n${o.content.slice(0, 3000)}`).join('\n\n')
      const def = ANALYSES.find((x) => x.id === a)!
      const stream = await aiService.chatWithSystem('You are a research assistant producing rigorous, well-structured analysis.', def.prompt(sources))
      const text = await streamToString(stream)
      setResult(text)
    } catch (err) {
      if (isNoProviderError(err)) toast({ type: 'warning', title: 'No AI provider configured' })
      else setResult('Analysis failed.')
    } finally { setLoading(false) }
  }

  if (!aiService.isConfigured) {
    return <div className="flex h-full items-center justify-center"><div className="w-80"><AISetupPrompt /></div></div>
  }

  return (
    <div className="flex h-full">
      {/* Sources */}
      <div className="w-72 border-r border-border-subtle bg-sidebar-bg flex flex-col">
        <div className="px-3 py-2.5 border-b border-border-subtle">
          <h2 className="flex items-center gap-2 text-sm font-medium text-text-primary"><FlaskConical size={15} className="text-accent-primary" /> Sources ({selected.size})</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {objects.length === 0 ? (
            <p className="text-xs text-text-muted p-3 text-center">No sources yet. Create notes or import PDFs first.</p>
          ) : objects.map((o) => (
            <button key={o.id} onClick={() => toggle(o.id)}
              className={cn('flex items-start gap-2 w-full px-2 py-2 rounded-lg text-left transition-colors',
                selected.has(o.id) ? 'bg-accent-primary/15' : 'hover:bg-surface')}>
              <div className={cn('w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5', selected.has(o.id) ? 'bg-accent-primary text-white' : 'border border-border-default')}>
                {selected.has(o.id) && <Check size={11} />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{o.title}</p>
                <p className="text-2xs text-text-muted">{o.type}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-subtle flex-wrap">
          {ANALYSES.map((a) => (
            <Button key={a.id} size="sm" variant="outline" onClick={() => runAnalysis(a.id)} disabled={loading}>
              <a.icon size={14} /> {a.label}
            </Button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-accent-primary" /></div>
          ) : result ? (
            <div className="max-w-3xl mx-auto">
              <div className="rounded-xl border border-border-subtle bg-surface p-5">
                <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{result}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <FlaskConical size={40} className="text-text-muted" />
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Research Workspace</h2>
                <p className="text-text-muted text-sm mt-1 max-w-sm">Select sources on the left, then run an AI analysis: literature review, comparison, contradiction detection, or outline.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
