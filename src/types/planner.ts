// ─── Planner Types ────────────────────────────────────────────────────

export type TaskPriority = 'P1' | 'P2' | 'P3' | 'P4'
export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'cancelled'
export type AssignmentStatus = 'not-started' | 'in-progress' | 'submitted' | 'graded'
export type ExamFormat = 'multiple-choice' | 'essay' | 'oral' | 'mixed' | 'practical'
export type ExamDifficulty = 'easy' | 'medium' | 'hard'
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'
export type CalendarEventType = 'class' | 'study-session' | 'exam' | 'assignment-due' | 'personal' | 'reminder'

export interface Task {
  id: string
  title: string
  description: string | null
  dueAt: Date | null
  priority: TaskPriority
  courseId: string | null
  estimatedMinutes: number | null
  actualMinutes: number | null
  status: TaskStatus
  recurrence: RecurrenceType
  parentTaskId: string | null
  subtasks: Task[]
  tags: string[]
  createdAt: Date
  completedAt: Date | null
}

export interface CalendarEvent {
  id: string
  title: string
  type: CalendarEventType
  courseId: string | null
  startAt: Date
  endAt: Date
  recurrence: RecurrenceType
  recurrenceRule: string | null
  notes: string | null
  color: string | null
  location: string | null
}

export interface Assignment {
  id: string
  title: string
  courseId: string
  dueAt: Date
  weight: number | null // percentage of final grade
  status: AssignmentStatus
  grade: number | null
  maxGrade: number
  notes: string | null
  createdAt: Date
}

export interface Exam {
  id: string
  title: string
  courseId: string
  examAt: Date
  topics: string[]
  difficulty: ExamDifficulty
  format: ExamFormat
  location: string | null
  readinessScore: number | null // 0-100
  grade: number | null
  maxGrade: number
  notes: string | null
  createdAt: Date
}

export interface PomodoroSession {
  id: string
  courseId: string | null
  taskId: string | null
  durationMinutes: number
  completed: boolean
  startedAt: Date
  endedAt: Date | null
}

export type PomodoroPhase = 'work' | 'short-break' | 'long-break' | 'idle'

export interface PomodoroState {
  phase: PomodoroPhase
  timeRemaining: number // seconds
  currentRound: number
  totalRounds: number
  isRunning: boolean
  linkedCourseId: string | null
  linkedTaskId: string | null
}

export interface DailyGoal {
  id: string
  courseId: string | null
  goalType: 'study-hours' | 'flashcards' | 'tasks' | 'pomodoros'
  targetValue: number
  createdAt: Date
}
