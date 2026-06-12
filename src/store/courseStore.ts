import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Course } from '@/types'
import { getDB } from '@/db'

interface CourseState {
  courses: Course[]
  isLoading: boolean

  load: () => Promise<void>
  create: (data: Omit<Course, 'id' | 'createdAt'>) => Promise<Course>
  update: (id: string, updates: Partial<Omit<Course, 'id' | 'createdAt'>>) => Promise<void>
  delete: (id: string) => Promise<void>
  getCourseById: (id: string) => Course | undefined
  getColorById: (id: string) => string
}

export const useCourseStore = create<CourseState>()(
  immer((set, get) => ({
    courses: [],
    isLoading: false,

    load: async () => {
      set((s) => { s.isLoading = true })
      const db = await getDB()
      const courses = await db.courses.getActive()
      set((s) => { s.courses = courses; s.isLoading = false })
    },

    create: async (data) => {
      const db = await getDB()
      const course = await db.courses.create(data)
      set((s) => { s.courses.push(course) })
      return course
    },

    update: async (id, updates) => {
      const db = await getDB()
      await db.courses.update(id, updates)
      set((s) => {
        const c = s.courses.find((c) => c.id === id)
        if (c) Object.assign(c, updates)
      })
    },

    delete: async (id) => {
      const db = await getDB()
      await db.courses.delete(id)
      set((s) => { s.courses = s.courses.filter((c) => c.id !== id) })
    },

    getCourseById: (id) => get().courses.find((c) => c.id === id),

    getColorById: (id) => {
      const course = get().courses.find((c) => c.id === id)
      return course?.color ?? '#7C6FFF'
    },
  })),
)
