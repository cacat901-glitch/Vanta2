/**
 * PageAttachmentsPanel
 *
 * Shown in the right gutter of the PageEditor. Allows the user to:
 *   1. Link the page to a course  (sets page.courseId)
 *   2. Attach one or more imported PDFs to the page
 *   3. Open any attached PDF in the PDF viewer
 *   4. Detach a PDF from the page
 *
 * All data persists in the page_attachments table.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, X, Plus, Loader2, ChevronDown, ChevronUp,
  ExternalLink, Upload,
} from 'lucide-react'
import { getDB } from '@/db'
import { useDocumentStore } from '@/store/documentStore'
import { useCourseStore } from '@/store/courseStore'
import { useAppStore } from '@/store/appStore'
import { cn } from '@/lib/utils'
import type { StudyDocument } from '@/types/media'

interface PageAttachmentsPanelProps {
  pageId: string
}

export function PageAttachmentsPanel({ pageId }: PageAttachmentsPanelProps) {
  const navigate = useNavigate()
  const documents = useDocumentStore(s => s.documents)
  const loadDocuments = useDocumentStore(s => s.load)
  const importPdf = useDocumentStore(s => s.importPdf)
  const courses = useCourseStore(s => s.courses)
  const toast = useAppStore(s => s.addToast)

  const [attachedDocIds, setAttachedDocIds] = useState<string[]>([])
  const [linkedCourseId, setLinkedCourseId] = useState<string | null>(null)
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Load existing attachments for this page
  const reload = useCallback(async () => {
    const db = await getDB()
    const [ids, cid] = await Promise.all([
      db.pageAttachments.getDocumentIds(pageId),
      db.pageAttachments.getCourseId(pageId),
    ])
    setAttachedDocIds(ids)
    setLinkedCourseId(cid)
  }, [pageId])

  useEffect(() => {
    void loadDocuments()
    void reload()
  }, [pageId, reload, loadDocuments])

  const attachedDocs = documents.filter(d => attachedDocIds.includes(d.id))
  const unattachedDocs = documents.filter(d => !attachedDocIds.includes(d.id))

  const handleAttach = async (docId: string) => {
    const db = await getDB()
    await db.pageAttachments.attachDocument(pageId, docId)
    await reload()
    setShowDocPicker(false)
    toast({ type: 'success', title: 'PDF attached to page' })
  }

  const handleDetach = async (docId: string) => {
    const db = await getDB()
    await db.pageAttachments.detachDocument(pageId, docId)
    await reload()
  }

  const handleLinkCourse = async (courseId: string | null) => {
    const db = await getDB()
    await db.pageAttachments.setPageCourse(pageId, courseId)
    setLinkedCourseId(courseId)
    toast({ type: 'success', title: courseId ? 'Page linked to course' : 'Course unlinked' })
  }

  const handleImportAndAttach = async () => {
    return new Promise<void>((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/pdf'
      input.multiple = true
      input.onchange = async () => {
        const files = Array.from(input.files ?? [])
        if (!files.length) { resolve(); return }
        setLoading(true)
        try {
          for (const file of files) {
            const doc = await importPdf(file)
            if (doc) await handleAttach(doc.id)
          }
          toast({ type: 'success', title: `${files.length} PDF${files.length > 1 ? 's' : ''} imported and attached` })
        } finally {
          setLoading(false)
          resolve()
        }
      }
      input.oncancel = () => resolve()
      input.click()
    })
  }

  const linkedCourse = courses.find(c => c.id === linkedCourseId)

  return (
    <div className="border-t border-border-subtle">
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <FileText size={12} /> Attachments & Links
        </span>
        {collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">

          {/* Course link */}
          <div>
            <p className="text-2xs text-text-muted uppercase tracking-wider mb-1.5 px-1">Course</p>
            <select
              value={linkedCourseId ?? ''}
              onChange={e => handleLinkCourse(e.target.value || null)}
              className="w-full bg-surface border border-border-default rounded-md px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent-primary/60"
            >
              <option value="">— No course —</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            {linkedCourse && (
              <button
                onClick={() => navigate(`/courses/${linkedCourse.id}`)}
                className="flex items-center gap-1 mt-1 text-2xs px-1 text-accent-primary hover:underline"
              >
                <ExternalLink size={9} /> Open {linkedCourse.name}
              </button>
            )}
          </div>

          {/* Attached PDFs */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <p className="text-2xs text-text-muted uppercase tracking-wider">PDFs</p>
              <div className="flex gap-1">
                <button
                  onClick={handleImportAndAttach}
                  disabled={loading}
                  className="flex items-center gap-0.5 text-2xs text-text-muted hover:text-accent-primary transition-colors"
                  title="Import new PDF and attach"
                >
                  {loading ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                  Import
                </button>
                {unattachedDocs.length > 0 && (
                  <button
                    onClick={() => setShowDocPicker(v => !v)}
                    className="flex items-center gap-0.5 text-2xs text-text-muted hover:text-accent-primary transition-colors"
                    title="Attach an existing PDF"
                  >
                    <Plus size={10} /> Attach
                  </button>
                )}
              </div>
            </div>

            {/* Attached doc list */}
            {attachedDocs.length === 0 ? (
              <p className="text-2xs text-text-muted px-1 py-2">No PDFs attached. Import or attach one.</p>
            ) : (
              <div className="space-y-1">
                {attachedDocs.map(doc => (
                  <AttachedDocRow
                    key={doc.id}
                    doc={doc}
                    onOpen={() => navigate('/pdf')}
                    onDetach={() => handleDetach(doc.id)}
                  />
                ))}
              </div>
            )}

            {/* Picker for existing docs */}
            {showDocPicker && unattachedDocs.length > 0 && (
              <div className="mt-1.5 rounded-lg border border-border-default bg-surface-elevated shadow-lg max-h-48 overflow-y-auto">
                <p className="text-2xs text-text-muted px-2 py-1.5 border-b border-border-subtle">
                  Pick an imported PDF
                </p>
                {unattachedDocs.map(doc => (
                  <button
                    key={doc.id}
                    onClick={() => handleAttach(doc.id)}
                    className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-text-secondary hover:bg-surface hover:text-text-primary transition-colors text-left"
                  >
                    <FileText size={12} className="text-danger flex-shrink-0" />
                    <span className="truncate">{doc.title}</span>
                    <span className="text-2xs text-text-muted ml-auto flex-shrink-0">{doc.pageCount ?? '?'}p</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AttachedDocRow({ doc, onOpen, onDetach }: {
  doc: StudyDocument; onOpen: () => void; onDetach: () => void
}) {
  return (
    <div className="group flex items-center gap-1.5 px-1 py-1 rounded-md hover:bg-surface transition-colors">
      <FileText size={12} className="text-danger flex-shrink-0" />
      <button
        onClick={onOpen}
        className="flex-1 min-w-0 text-left text-xs text-text-secondary hover:text-accent-primary transition-colors truncate"
        title="Open in PDF viewer"
      >
        {doc.title}
      </button>
      <span className="text-2xs text-text-muted flex-shrink-0">{doc.pageCount ?? '?'}p</span>
      <button
        onClick={onDetach}
        className={cn('opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all flex-shrink-0')}
        title="Detach"
      >
        <X size={10} />
      </button>
    </div>
  )
}
