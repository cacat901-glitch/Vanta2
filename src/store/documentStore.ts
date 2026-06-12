import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { StudyDocument, Annotation } from '@/types/media'
import { getDB } from '@/db'
import { getFileSystemAdapter } from '@/platform'
import { loadPdf, extractPdfText } from '@/lib/pdf'
import { ingest, removeFromKnowledge, knowledgeId } from '@/services/knowledgeEngine'

interface DocumentState {
  documents: StudyDocument[]
  isLoading: boolean
  load: () => Promise<void>
  importPdf: (file: File) => Promise<StudyDocument | null>
  remove: (id: string) => Promise<void>
  getBytes: (filePath: string) => Promise<Uint8Array>
  addAnnotation: (a: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Annotation>
  deleteAnnotation: (id: string, documentId: string) => Promise<void>
}

export const useDocumentStore = create<DocumentState>()(
  immer((set) => ({
    documents: [],
    isLoading: false,

    load: async () => {
      set((s) => { s.isLoading = true })
      const db = await getDB()
      const docs = await db.documents.getAll()
      set((s) => { s.documents = docs; s.isLoading = false })
    },

    importPdf: async (file) => {
      const db = await getDB()
      const fs = await getFileSystemAdapter()
      const bytes = new Uint8Array(await file.arrayBuffer())
      const path = `documents/${Date.now()}-${file.name}`
      await fs.writeFile(path, bytes)

      // Extract text + page count via pdf.js
      let contentText = ''
      let pageCount = 0
      try {
        const doc = await loadPdf(bytes.slice())
        pageCount = doc.numPages
        contentText = await extractPdfText(doc)
      } catch { /* extraction optional */ }

      const created = await db.documents.create({
        title: file.name.replace(/\.pdf$/i, ''), filePath: path, fileType: 'pdf',
        contentText, pageCount,
      })
      // Funnel into the unified Knowledge Engine: chunk + embed + index + graph.
      // This is what makes the PDF visible to Second Brain, quiz/flashcard
      // generators, the tutor, and chat.
      ingest({
        id: knowledgeId.pdf(created.id),
        type: 'pdf',
        title: created.title,
        content: contentText,
        courseId: created.courseId,
      })
      await db.activity.log('pdf_opened', { objectId: created.id, objectType: 'pdf' })

      set((s) => { s.documents.unshift(created) })
      return created
    },

    remove: async (id) => {
      const db = await getDB()
      await db.documents.delete(id)
      void removeFromKnowledge(knowledgeId.pdf(id))
      set((s) => { s.documents = s.documents.filter((d) => d.id !== id) })
    },

    getBytes: async (filePath) => {
      const fs = await getFileSystemAdapter()
      return fs.readFile(filePath)
    },

    addAnnotation: async (a) => {
      const db = await getDB()
      const ann = await db.documents.addAnnotation(a)
      set((s) => {
        const doc = s.documents.find((d) => d.id === a.documentId)
        if (doc) doc.annotations.push(ann)
      })
      return ann
    },

    deleteAnnotation: async (id, documentId) => {
      const db = await getDB()
      await db.documents.deleteAnnotation(id)
      set((s) => {
        const doc = s.documents.find((d) => d.id === documentId)
        if (doc) doc.annotations = doc.annotations.filter((an) => an.id !== id)
      })
    },
  })),
)
