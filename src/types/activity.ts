// ─── Activity Log Types ───────────────────────────────────────────────

export type ActivityActionType =
  | 'page_opened'
  | 'writing_session'
  | 'flashcard_review'
  | 'pomodoro_completed'
  | 'pdf_opened'
  | 'video_watched'
  | 'lecture_recorded'
  | 'quiz_completed'
  | 'oral_exam_completed'
  | 'tutor_session'
  | 'task_completed'
  | 'assignment_submitted'
  | 'exam_result_entered'
  | 'note_created'
  | 'canvas_created'
  | 'badge_earned'
  | 'streak_milestone'
  | 'level_up'

export interface ActivityLog {
  id: string
  actionType: ActivityActionType
  objectId: string | null
  objectType: string | null
  courseId: string | null
  durationSeconds: number | null
  metadata: Record<string, unknown>
  loggedAt: Date
}

// ─── Gamification ─────────────────────────────────────────────────────

export interface Badge {
  id: string
  name: string
  description: string
  icon: string // emoji
  condition: string // description of unlock condition
  xpReward: number
  earnedAt: Date | null
}

export interface UserStats {
  totalXP: number
  level: number
  xpToNextLevel: number
  currentStreak: number
  longestStreak: number
  lastStudyDate: Date | null
  totalStudyHours: number
  totalFlashcardsReviewed: number
  totalTasksCompleted: number
  badges: Badge[]
}

export const XP_REWARDS: Record<ActivityActionType, number> = {
  page_opened: 0,
  writing_session: 50,
  flashcard_review: 1,
  pomodoro_completed: 25,
  pdf_opened: 5,
  video_watched: 10,
  lecture_recorded: 100,
  quiz_completed: 30,
  oral_exam_completed: 75,
  tutor_session: 40,
  task_completed: 20,
  assignment_submitted: 50,
  exam_result_entered: 0,
  note_created: 15,
  canvas_created: 15,
  badge_earned: 0,
  streak_milestone: 100,
  level_up: 0,
}

export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.3, level - 1))
}

export function levelFromXP(xp: number): number {
  let level = 1
  let totalRequired = 0
  while (true) {
    const required = xpForLevel(level)
    if (totalRequired + required > xp) break
    totalRequired += required
    level++
  }
  return level
}
