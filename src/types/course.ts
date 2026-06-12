// ─── Course Types ─────────────────────────────────────────────────────

export type CourseColor =
  | '#7C6FFF' | '#3ECFB2' | '#FFBB38' | '#FF5263'
  | '#4DA6FF' | '#4CAF50' | '#E91E8C' | '#FF9040'
  | '#00BCD4' | '#8BC34A'

export interface CourseScheduleSlot {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6
  startTime: string // HH:mm
  endTime: string   // HH:mm
}

export interface Course {
  id: string
  name: string
  icon: string // emoji
  color: CourseColor
  semester: string | null
  professor: string | null
  courseCode: string | null
  schedule: CourseScheduleSlot[]
  room: string | null
  zoomLink: string | null
  syllabusDocumentId: string | null
  isActive: boolean
  createdAt: Date
}

export interface CourseLink {
  id: string
  courseId: string
  objectId: string
  objectType: string
}

// Aggregated stats for course overview
export interface CourseStats {
  hoursThisWeek: number
  hoursAllTime: number
  flashcardRetentionRate: number | null
  notesWordCount: number
  lectureCount: number
  pdfCount: number
  assignmentCompletionRate: number | null
  currentGrade: number | null
  upcomingDeadlines: number
  readinessScore: number | null
}
