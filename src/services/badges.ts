import type { UserStats } from '@/types/activity'

export interface BadgeDef {
  id: string
  name: string
  description: string
  emoji: string
  check: (ctx: BadgeContext) => boolean
}

export interface BadgeContext {
  stats: UserStats
  flashcardsReviewed: number
  notesCreated: number
  activeCourses: number
  studiedAfterMidnight: boolean
  studiedBefore6am: boolean
  hasAGrade: boolean
}

export const BADGES: BadgeDef[] = [
  { id: 'first-step', name: 'First Step', description: 'Create your first note', emoji: '🌱', check: (c) => c.notesCreated >= 1 },
  { id: 'streak-7', name: '7-Day Streak', description: '7 consecutive study days', emoji: '🔥', check: (c) => c.stats.currentStreak >= 7 },
  { id: 'streak-30', name: 'Monthly Master', description: '30-day streak', emoji: '🏆', check: (c) => c.stats.currentStreak >= 30 },
  { id: 'flashcard-100', name: 'Flashcard Apprentice', description: 'Review 100 flashcards', emoji: '🎴', check: (c) => c.flashcardsReviewed >= 100 },
  { id: 'flashcard-1000', name: 'Flashcard Master', description: 'Review 1000 flashcards', emoji: '🃏', check: (c) => c.flashcardsReviewed >= 1000 },
  { id: 'night-owl', name: 'Night Owl', description: 'Studied after midnight', emoji: '🦉', check: (c) => c.studiedAfterMidnight },
  { id: 'early-bird', name: 'Early Bird', description: 'Studied before 6 AM', emoji: '🐦', check: (c) => c.studiedBefore6am },
  { id: 'exam-crusher', name: 'Exam Crusher', description: 'Enter an A grade on any exam', emoji: '💯', check: (c) => c.hasAGrade },
  { id: 'second-brain', name: 'Second Brain', description: '100+ knowledge objects', emoji: '🧠', check: (c) => c.notesCreated >= 100 },
  { id: 'polymath', name: 'Polymath', description: '5+ active courses', emoji: '🎓', check: (c) => c.activeCourses >= 5 },
  { id: 'level-10', name: 'Rising Scholar', description: 'Reach Level 10', emoji: '⭐', check: (c) => c.stats.level >= 10 },
  { id: 'level-25', name: 'Dedicated Learner', description: 'Reach Level 25', emoji: '🌟', check: (c) => c.stats.level >= 25 },
  { id: 'hours-50', name: 'Half-Century', description: '50 total study hours', emoji: '⏳', check: (c) => c.stats.totalStudyHours >= 50 },
  { id: 'tasks-100', name: 'Task Terminator', description: 'Complete 100 tasks', emoji: '✅', check: (c) => c.stats.totalTasksCompleted >= 100 },
]

export function evaluateBadges(ctx: BadgeContext): string[] {
  return BADGES.filter((b) => b.check(ctx)).map((b) => b.id)
}
