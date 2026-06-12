import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Pen, Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import { CanvasBoard } from './CanvasBoard'
import { useCanvasStore } from '@/store/canvasStore'
import { useAppStore } from '@/store/appStore'
import { aiService, isNoProviderError } from '@/services/ai'
import type { CanvasDocument, CanvasBackgroundType } from '@/types'
import { relativeDate } from '@/lib/utils'

export function CanvasPage() {
  const { canvasId } = useParams()
  const navigate = useNavigate()
  const documents = useCanvasStore((s) => s.documents)
  const load = useCanvasStore((s) => s.load)
  const create = useCanvasStore((s) => s.create)
  const getById = useCanvasStore((s) => s.getById)
  const save = useCanvasStore((s) => s.save)
  const remove = useCanvasStore((s) => s.remove)
  const toast = useAppStore((s) => s.addToast)

  const [active, setActive] = useState<CanvasDocument | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!canvasId) { setActive(null); return }
    setLoading(true)
    void getById(canvasId).then((doc) => { setActive(doc); setLoading(false) })
  }, [canvasId, getById])

  const handleSave = useCallback((data: unknown, bg: CanvasBackgroundType) => {
    if (active) void save(active.id, data, bg)
  }, [active, save])

  const handleAI = useCallback(async (action: 'transcribe' | 'explain' | 'cleanup', dataUrl: string) => {
    if (!aiService.isConfigured) {
      toast({ type: 'warning', title: 'Set up AI first', description: 'Configure an AI provider in Settings → AI.' })
      return
    }
    const prompts = {
      transcribe: 'Transcribe all handwritten and typed text in this image. Return only the extracted text, preserving structure.',
      explain: 'Explain what this diagram or sketch shows. Describe the concepts and relationships.',
      cleanup: 'Describe what this rough sketch depicts and suggest how to turn it into a clean, formal diagram.',
    }
    toast({ type: 'info', title: 'AI is analyzing the canvas…' })
    try {
      const result = await aiService.vision(dataUrl, prompts[action], 'image/png')
      window.dispatchEvent(new CustomEvent('studyos:ai-result', { detail: { title: `Canvas: ${action}`, text: result } }))
      toast({ type: 'success', title: 'AI analysis complete', description: result.slice(0, 120) })
    } catch (err) {
      if (isNoProviderError(err)) toast({ type: 'warning', title: 'No AI provider configured' })
      else toast({ type: 'error', title: 'AI request failed', description: err instanceof Error ? err.message : '' })
    }
  }, [toast])

  // Board view
  if (canvasId) {
    if (loading) {
      return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-accent-primary" /></div>
    }
    if (!active) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3">
          <p className="text-text-muted">Canvas not found</p>
          <button onClick={() => navigate('/canvas')} className="text-accent-primary hover:underline text-sm">← Back to canvases</button>
        </div>
      )
    }
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
          <button onClick={() => navigate('/canvas')} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface">
            <ArrowLeft size={16} />
          </button>
          <input
            defaultValue={active.title}
            onBlur={(e) => useCanvasStore.getState().rename(active.id, e.target.value || 'Untitled Canvas')}
            className="bg-transparent text-sm font-medium text-text-primary outline-none px-2 py-1 rounded hover:bg-surface focus:bg-surface"
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <CanvasBoard
            key={active.id}
            initialData={active.data}
            initialBackground={active.backgroundType}
            onSave={handleSave}
            onAI={handleAI}
          />
        </div>
      </div>
    )
  }

  // Gallery view
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Canvas</h1>
        <button
          onClick={async () => { const doc = await create(); navigate(`/canvas/${doc.id}`) }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-hover transition-colors"
        >
          <Plus size={14} /> New Canvas
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center"><Pen size={28} className="text-text-muted" /></div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">No canvases yet</h2>
            <p className="text-text-muted text-sm mt-1">Create an infinite canvas for handwriting, diagrams, and mind maps</p>
          </div>
          <button onClick={async () => { const doc = await create(); navigate(`/canvas/${doc.id}`) }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-hover transition-colors">
            <Plus size={14} /> Create your first canvas
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {documents.map((doc) => (
            <div key={doc.id} className="group relative">
              <button
                onClick={() => navigate(`/canvas/${doc.id}`)}
                className="w-full aspect-[4/3] rounded-xl bg-surface border border-border-subtle hover:border-accent-primary/50 transition-colors flex items-center justify-center canvas-bg-dot-small"
              >
                <Pen size={24} className="text-text-muted" />
              </button>
              <div className="mt-2 px-1">
                <p className="text-sm font-medium text-text-primary truncate">{doc.title}</p>
                <p className="text-xs text-text-muted">{relativeDate(doc.updatedAt)}</p>
              </div>
              <button
                onClick={() => { if (confirm('Delete this canvas?')) void remove(doc.id) }}
                className="absolute top-2 right-2 w-7 h-7 rounded-md bg-surface-elevated text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
