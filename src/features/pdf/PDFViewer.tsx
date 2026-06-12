import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowLeft, ZoomIn, ZoomOut, Loader2, Sparkles, FileText, Brain, BookOpen } from 'lucide-react'
import { loadPdf, renderPage, extractPdfText, type PdfDoc } from '@/lib/pdf'
import { useDocumentStore } from '@/store/documentStore'
import { useAppStore } from '@/store/appStore'
import { useFlashcardStore } from '@/store/flashcardStore'
import { aiService, streamToString } from '@/services/ai'
import { Button } from '@/components/ui'
import type { StudyDocument } from '@/types/media'

interface PDFViewerProps {
  document: StudyDocument
  onBack: () => void
}

export function PDFViewer({ document: doc, onBack }: PDFViewerProps) {
  const getBytes = useDocumentStore((s) => s.getBytes)
  const toast = useAppStore((s) => s.addToast)
  const [pdf, setPdf] = useState<PdfDoc | null>(null)
  const [scale, setScale] = useState(1.4)
  const [loading, setLoading] = useState(true)
  const [aiPanel, setAiPanel] = useState<{ title: string; content: string; loading: boolean } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const bytes = await getBytes(doc.filePath)
        const loaded = await loadPdf(bytes)
        if (!cancelled) setPdf(loaded)
      } catch {
        toast({ type: 'error', title: 'Could not load PDF' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [doc.filePath, getBytes, toast])

  const runAI = useCallback(async (kind: 'summary' | 'flashcards' | 'glossary' | 'chat', question?: string) => {
    if (!pdf) return
    if (!aiService.isConfigured) { toast({ type: 'warning', title: 'Set up AI in Settings' }); return }
    setAiPanel({ title: kind === 'chat' ? 'Answer' : kind, content: '', loading: true })
    try {
      const text = (doc.contentText || (await extractPdfText(pdf))).slice(0, 12000)
      let result = ''
      if (kind === 'summary') {
        const stream = await aiService.summarize(text, 'executive')
        result = await streamToString(stream)
      } else if (kind === 'glossary') {
        result = await aiService.complete(`Extract the key terms from this document and define each one concisely. Format as "Term: definition".\n\n${text}`)
      } else if (kind === 'chat' && question) {
        const stream = await aiService.askWithContext(question, text)
        result = await streamToString(stream)
      } else if (kind === 'flashcards') {
        const fcStore = useFlashcardStore.getState()
        const stream = await aiService.generateFlashcards(text, 15)
        const raw = await streamToString(stream)
        const match = raw.match(/\[[\s\S]*\]/)
        const cards = match ? JSON.parse(match[0]) as Array<{ front: string; back: string }> : []
        const deck = await fcStore.createDeck(`${doc.title} (PDF)`)
        for (const c of cards) await fcStore.createCard(deck.id, c.front, c.back, 'basic')
        await fcStore.loadDecks()
        result = `Created ${cards.length} flashcards in a new deck "${doc.title} (PDF)".`
      }
      setAiPanel({ title: kind, content: result, loading: false })
    } catch (err) {
      setAiPanel({ title: kind, content: err instanceof Error ? err.message : 'AI request failed', loading: false })
    }
  }, [pdf, doc, toast])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
        <button onClick={onBack} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface"><ArrowLeft size={16} /></button>
        <span className="text-sm font-medium text-text-primary truncate flex-1">{doc.title}</span>
        <span className="text-xs text-text-muted">{doc.pageCount ?? '?'} pages</span>
        <div className="w-px h-5 bg-border-subtle" />
        <button onClick={() => setScale((s) => Math.max(0.6, s - 0.2))} className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface"><ZoomOut size={15} /></button>
        <span className="text-xs text-text-muted w-10 text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(3, s + 0.2))} className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface"><ZoomIn size={15} /></button>
        <div className="w-px h-5 bg-border-subtle" />
        <Button size="sm" variant="ghost" onClick={() => runAI('summary')}><FileText size={14} /> Summary</Button>
        <Button size="sm" variant="ghost" onClick={() => runAI('flashcards')}><Brain size={14} /> Cards</Button>
        <Button size="sm" variant="ghost" onClick={() => runAI('glossary')}><BookOpen size={14} /> Glossary</Button>
        <Button size="sm" variant="ghost" onClick={() => { const q = prompt('Ask about this PDF:'); if (q) void runAI('chat', q) }}><Sparkles size={14} /> Ask</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Pages */}
        <div ref={containerRef} className="flex-1 overflow-y-auto bg-app-bg p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-accent-primary" /></div>
          ) : pdf ? (
            <div className="flex flex-col items-center gap-4">
              {Array.from({ length: pdf.numPages }, (_, i) => (
                <PdfPageCanvas key={i} pdf={pdf} pageNum={i + 1} scale={scale} />
              ))}
            </div>
          ) : (
            <p className="text-center text-text-muted">Failed to render PDF.</p>
          )}
        </div>

        {/* AI result panel */}
        {aiPanel && (
          <div className="w-80 border-l border-border-subtle bg-sidebar-bg flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
              <span className="text-sm font-medium text-text-primary capitalize">{aiPanel.title}</span>
              <button onClick={() => setAiPanel(null)} className="text-text-muted hover:text-text-primary text-xs">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">
              {aiPanel.loading ? <Loader2 className="animate-spin text-accent-primary" /> : aiPanel.content}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PdfPageCanvas({ pdf, pageNum, scale }: { pdf: PdfDoc; pageNum: number; scale: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) void renderPage(pdf, pageNum, ref.current, scale)
  }, [pdf, pageNum, scale])
  return <canvas ref={ref} className="rounded-lg shadow-lg bg-white max-w-full" />
}
