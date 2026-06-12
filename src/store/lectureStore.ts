import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Lecture, TranscriptLine } from '@/types/knowledge'
import { getDB } from '@/db'

interface LectureState {
  lectures: Lecture[]
  isLoading: boolean
  load: () => Promise<void>
  create: (title: string, courseId?: string, duration?: number) => Promise<Lecture>
  getById: (id: string) => Promise<Lecture | null>
  update: (id: string, updates: Partial<Lecture>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useLectureStore = create<LectureState>()(
  immer((set) => ({
    lectures: [],
    isLoading: false,

    load: async () => {
      set((s) => { s.isLoading = true })
      const db = await getDB()
      const lectures = await db.lectures.getAll()
      set((s) => { s.lectures = lectures; s.isLoading = false })
    },

    create: async (title, courseId, duration) => {
      const db = await getDB()
      const lecture = await db.lectures.create({ title, courseId, duration })
      set((s) => { s.lectures.unshift(lecture) })
      return lecture
    },

    getById: async (id) => {
      const db = await getDB()
      return db.lectures.getById(id)
    },

    update: async (id, updates) => {
      const db = await getDB()
      await db.lectures.update(id, updates)
      set((s) => {
        const lec = s.lectures.find((l) => l.id === id)
        if (lec) Object.assign(lec, updates)
      })
    },

    remove: async (id) => {
      const db = await getDB()
      await db.lectures.delete(id)
      set((s) => { s.lectures = s.lectures.filter((l) => l.id !== id) })
    },
  })),
)

export type { TranscriptLine }
