import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { CanvasDocument, CanvasBackgroundType } from '@/types'
import { getDB } from '@/db'

interface CanvasState {
  documents: CanvasDocument[]
  isLoading: boolean
  load: () => Promise<void>
  create: (title?: string) => Promise<CanvasDocument>
  getById: (id: string) => Promise<CanvasDocument | null>
  save: (id: string, data: unknown, bg?: CanvasBackgroundType) => Promise<void>
  rename: (id: string, title: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useCanvasStore = create<CanvasState>()(
  immer((set) => ({
    documents: [],
    isLoading: false,

    load: async () => {
      set((s) => { s.isLoading = true })
      const db = await getDB()
      const docs = await db.canvas.getAll()
      set((s) => { s.documents = docs; s.isLoading = false })
    },

    create: async (title) => {
      const db = await getDB()
      const doc = await db.canvas.create(title ?? 'Untitled Canvas')
      void db.activity.log('canvas_created', { objectId: doc.id, objectType: 'canvas' })
      set((s) => { s.documents.unshift(doc) })
      return doc
    },

    getById: async (id) => {
      const db = await getDB()
      return db.canvas.getById(id)
    },

    save: async (id, data, bg) => {
      const db = await getDB()
      await db.canvas.save(id, data, bg)
      set((s) => {
        const doc = s.documents.find((d) => d.id === id)
        if (doc) { doc.data = data; doc.updatedAt = new Date(); if (bg) doc.backgroundType = bg }
      })
    },

    rename: async (id, title) => {
      const db = await getDB()
      await db.canvas.rename(id, title)
      set((s) => {
        const doc = s.documents.find((d) => d.id === id)
        if (doc) doc.title = title
      })
    },

    remove: async (id) => {
      const db = await getDB()
      await db.canvas.delete(id)
      set((s) => { s.documents = s.documents.filter((d) => d.id !== id) })
    },
  })),
)
