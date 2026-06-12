import { useEffect, useRef, useState } from 'react'
import { FileText, Upload, Trash2, Loader2 } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useAppStore } from '@/store/appStore'
import { PDFViewer } from './PDFViewer'
import { Button } from '@/components/ui'
import { relativeDate } from '@/lib/utils'
import type { StudyDocument } from '@/types/media'

export function PDFsPage() {
  const documents = useDocumentStore((s) => s.documents)
  const load = useDocumentStore((s) => s.load)
  const importPdf = useDocumentStore((s) => s.importPdf)
  const remove = useDocumentStore((s) => s.remove)
  const toast = useAppStore((s) => s.addToast)
  const fileRef = useRef<HTMLInputElement>(null)
  const [active, setActive] = useState<StudyDocument | null>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => { void load() }, [load])

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setImporting(true)
    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        await importPdf(file)
      }
    }
    setImporting(false)
    toast({ type: 'success', title: 'PDF imported' })
  }

  if (active) {
    return <PDFViewer document={active} onBack={() => setActive(null)} />
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">PDFs & Documents</h1>
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import PDF
        </Button>
        <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {documents.length === 0 ? (
        <div
          onDrop={(e) => { e.preventDefault(); void handleFiles(e.dataTransfer.files) }}
          onDragOver={(e) => e.preventDefault()}
          className="flex flex-col items-center gap-4 py-20 text-center border-2 border-dashed border-border-default rounded-xl"
        >
          <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center"><FileText size={28} className="text-text-muted" /></div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">No PDFs yet</h2>
            <p className="text-text-muted text-sm mt-1">Import a PDF to read, annotate, and study with AI</p>
          </div>
          <Button onClick={() => fileRef.current?.click()}><Upload size={14} /> Import PDF</Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {documents.map((d) => (
            <div key={d.id} className="group relative">
              <button onClick={() => setActive(d)}
                className="w-full aspect-[3/4] rounded-xl bg-surface border border-border-subtle hover:border-accent-primary/50 transition-colors flex flex-col items-center justify-center gap-2">
                <FileText size={32} className="text-danger" />
                <span className="text-xs text-text-muted">{d.pageCount ?? '?'} pages</span>
              </button>
              <div className="mt-2 px-1">
                <p className="text-sm font-medium text-text-primary truncate">{d.title}</p>
                <p className="text-xs text-text-muted">{relativeDate(d.importedAt)}</p>
              </div>
              <button onClick={() => { if (confirm('Delete this PDF?')) void remove(d.id) }}
                className="absolute top-2 right-2 w-7 h-7 rounded-md bg-surface-elevated text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
