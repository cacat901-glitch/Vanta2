import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Task, CalendarEvent, Assignment, Exam, PomodoroState } from '@/types'
import { getDB } from '@/db'

interface PlannerState {
  tasks: Task[]
  events: CalendarEvent[]
  assignments: Assignment[]
  exams: Exam[]
  pomodoro: PomodoroState
  pomodoroInterval: ReturnType<typeof setInterval> | null
  isLoading: boolean

  // Tasks
  loadTasks: () => Promise<void>
  createTask: (data: Partial<Task> & { title: string }) => Promise<Task>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  completeTask: (id: string) => Promise<void>

  // Events
  loadEvents: (from: Date, to: Date) => Promise<void>
  createEvent: (data: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>
  deleteEvent: (id: string) => Promise<void>

  // Assignments & Exams
  loadAssignments: () => Promise<void>
  createAssignment: (data: Omit<Assignment, 'id' | 'createdAt'>) => Promise<Assignment>
  loadExams: () => Promise<void>
  createExam: (data: Omit<Exam, 'id' | 'createdAt'>) => Promise<Exam>

  // Pomodoro
  startPomodoro: (courseId?: string, taskId?: string) => void
  pausePomodoro: () => void
  resumePomodoro: () => void
  skipPomodoro: () => void
  stopPomodoro: () => void
  tickPomodoro: () => void
}

const DEFAULT_POMODORO: PomodoroState = {
  phase: 'idle',
  timeRemaining: 25 * 60,
  currentRound: 0,
  totalRounds: 4,
  isRunning: false,
  linkedCourseId: null,
  linkedTaskId: null,
}

export const usePlannerStore = create<PlannerState>()(
  immer((set, get) => ({
    tasks: [],
    events: [],
    assignments: [],
    exams: [],
    pomodoro: DEFAULT_POMODORO,
    pomodoroInterval: null,
    isLoading: false,

    // ─── Tasks ────────────────────────────────────────────────────────────

    loadTasks: async () => {
      const db = await getDB()
      const tasks = await db.tasks.getAllTasks()
      set((s) => { s.tasks = tasks })
    },

    createTask: async (data) => {
      const db = await getDB()
      const task = await db.tasks.createTask(data)
      set((s) => { s.tasks.push(task) })
      return task
    },

    updateTask: async (id, updates) => {
      const db = await getDB()
      await db.tasks.updateTask(id, updates)
      set((s) => {
        const task = s.tasks.find((t) => t.id === id)
        if (task) Object.assign(task, updates)
      })
    },

    deleteTask: async (id) => {
      const db = await getDB()
      await db.tasks.deleteTask(id)
      set((s) => { s.tasks = s.tasks.filter((t) => t.id !== id) })
    },

    completeTask: async (id) => {
      const db = await getDB()
      await db.tasks.updateTask(id, { status: 'done' })
      await db.activity.log('task_completed', { objectId: id, objectType: 'task' })
      set((s) => {
        const task = s.tasks.find((t) => t.id === id)
        if (task) { task.status = 'done'; task.completedAt = new Date() }
      })
    },

    // ─── Events ──────────────────────────────────────────────────────────

    loadEvents: async (from, to) => {
      const db = await getDB()
      const events = await db.tasks.getEventsInRange(from, to)
      set((s) => { s.events = events })
    },

    createEvent: async (data) => {
      const db = await getDB()
      const event = await db.tasks.createEvent(data)
      set((s) => { s.events.push(event) })
      return event
    },

    deleteEvent: async (id) => {
      const db = await getDB()
      await db.tasks.deleteEvent(id)
      set((s) => { s.events = s.events.filter((e) => e.id !== id) })
    },

    // ─── Assignments ─────────────────────────────────────────────────────

    loadAssignments: async () => {
      const db = await getDB()
      const assignments = await db.tasks.getAllAssignments()
      set((s) => { s.assignments = assignments })
    },

    createAssignment: async (data) => {
      const db = await getDB()
      const assignment = await db.tasks.createAssignment(data)
      set((s) => { s.assignments.push(assignment) })
      return assignment
    },

    loadExams: async () => {
      const db = await getDB()
      const exams = await db.tasks.getUpcomingExams(90)
      set((s) => { s.exams = exams })
    },

    createExam: async (data) => {
      const db = await getDB()
      const exam = await db.tasks.createExam(data)
      set((s) => { s.exams.push(exam) })
      return exam
    },

    // ─── Pomodoro ─────────────────────────────────────────────────────────

    startPomodoro: (courseId, taskId) => {
      const { pomodoroInterval } = get()
      if (pomodoroInterval) clearInterval(pomodoroInterval)

      set((s) => {
        s.pomodoro = {
          phase: 'work',
          timeRemaining: 25 * 60, // Will be overridden by settings
          currentRound: 0,
          totalRounds: 4,
          isRunning: true,
          linkedCourseId: courseId ?? null,
          linkedTaskId: taskId ?? null,
        }
      })

      const intervalId = setInterval(() => { get().tickPomodoro() }, 1000)
      set((s) => { s.pomodoroInterval = intervalId })
    },

    pausePomodoro: () => {
      const { pomodoroInterval } = get()
      if (pomodoroInterval) clearInterval(pomodoroInterval)
      set((s) => {
        s.pomodoro.isRunning = false
        s.pomodoroInterval = null
      })
    },

    resumePomodoro: () => {
      const intervalId = setInterval(() => { get().tickPomodoro() }, 1000)
      set((s) => {
        s.pomodoro.isRunning = true
        s.pomodoroInterval = intervalId
      })
    },

    skipPomodoro: () => get().tickPomodoro(),

    stopPomodoro: () => {
      const { pomodoroInterval } = get()
      if (pomodoroInterval) clearInterval(pomodoroInterval)
      set((s) => {
        s.pomodoro = DEFAULT_POMODORO
        s.pomodoroInterval = null
      })
    },

    tickPomodoro: () => {
      const { pomodoro } = get()
      if (!pomodoro.isRunning) return

      if (pomodoro.timeRemaining > 1) {
        set((s) => { s.pomodoro.timeRemaining-- })
        return
      }

      // Phase complete — advance to next phase
      const { phase, currentRound, totalRounds, linkedCourseId, linkedTaskId } = pomodoro

      if (phase === 'work') {
        // Log completed pomodoro
        void (async () => {
          const db = await getDB()
          await db.tasks.logPomodoro({
            courseId: linkedCourseId, taskId: linkedTaskId,
            durationMinutes: 25, completed: true,
            startedAt: new Date(Date.now() - 25 * 60 * 1000),
            endedAt: new Date(),
          })
          await db.activity.log('pomodoro_completed', {
            courseId: linkedCourseId ?? undefined,
            durationSeconds: 25 * 60,
          })
        })()

        const nextRound = currentRound + 1
        const isLongBreak = nextRound % totalRounds === 0
        set((s) => {
          s.pomodoro.currentRound = nextRound
          s.pomodoro.phase = isLongBreak ? 'long-break' : 'short-break'
          s.pomodoro.timeRemaining = isLongBreak ? 15 * 60 : 5 * 60
        })
      } else {
        // Break complete — back to work
        set((s) => {
          s.pomodoro.phase = 'work'
          s.pomodoro.timeRemaining = 25 * 60
        })
      }
    },
  })),
)
