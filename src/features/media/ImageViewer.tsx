import { useState } from 'react'
import { ArrowLeft, ScanText, Eye, Loader2, Copy } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { aiService } from '@/services/ai'
import { Button } from '@/components/ui'
import type { MediaItem } from '@/types/media'

export function ImageViewer({ item, onBack }: { item: MediaItem; onBack: () => void }) {
  const toast = useAppStore((s) => s.addToast)
  const [ocrText, setOcrText] = useState('')
  const [aiDesc, setAiDesc] = useState('')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const runOCR = async () => {
    setOcrLoading(true)
    try {
      const Tesseract = await import('tesseract.js')
      const { data } = await Tesseract.recognize(item.url, 'eng')
      setOcrText(data.text.trim() || 'No text detected.')
    } catch (err) {
      toast({ type: 'error', title: 'OCR failed', description: err instanceof Error ? err.message : '' })
    } finally {
      setOcrLoading(false)
    }
  }

  const runVision = async () => {
    if (!aiService.isConfigured) { toast({ type: 'warning', title: 'Set up AI in Settings' }); return }
    setAiLoading(true)
    try {
      const base64 = item.url.includes(',') ? item.url.split(',')[1]! : item.url
      const mime = item.url.match(/^data:([^;]+);/)?.[1] ?? 'image/png'
      const desc = await aiService.vision(base64, 'Describe this image in detail. If it contains diagrams, charts, or text, explain them.', mime)
      setAiDesc(desc)
    } catch (err) {
      toast({ type: 'error', title: 'Vision failed', description: err instanceof Error ? err.message : '' })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
        <button onClick={onBack} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface"><ArrowLeft size={16} /></button>
        <span className="text-sm font-medium text-text-primary truncate flex-1">{item.title}</span>
        <Button size="sm" variant="ghost" onClick={runOCR} disabled={ocrLoading}>
          {ocrLoading ? <Loader2 size={14} className="animate-spin" /> : <ScanText size={14} />} Extract Text (OCR)
        </Button>
        <Button size="sm" variant="ghost" onClick={runVision} disabled={aiLoading}>
          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} AI Describe
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <img src={item.url} alt={item.title ?? ''} className="max-w-full rounded-xl border border-border-subtle" />

          {ocrText && (
            <ResultBox title="Extracted Text (OCR)" text={ocrText} onCopy={() => { void navigator.clipboard.writeText(ocrText); toast({ type: 'success', title: 'Copied' }) }} />
          )}
          {aiDesc && (
            <ResultBox title="AI Description" text={aiDesc} onCopy={() => { void navigator.clipboard.writeText(aiDesc); toast({ type: 'success', title: 'Copied' }) }} />
          )}
        </div>
      </div>
    </div>
  )
}

function ResultBox({ title, text, onCopy }: { title: string; text: string; onCopy: () => void }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</p>
        <button onClick={onCopy} className="text-text-muted hover:text-text-primary"><Copy size={13} /></button>
      </div>
      <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  )
}
