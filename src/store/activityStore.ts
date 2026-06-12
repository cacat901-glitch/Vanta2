import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { UserStats, ActivityLog, ActivityActionType } from '@/types/activity'
import { getDB } from '@/db'
import { BADGES, evaluateBadges, type BadgeContext } from '@/services/badges'

interface ActivityState {
  stats: UserStats | null
  recent: ActivityLog[]
  earnedBadges: string[]
  weekActivity: ActivityLog[]
  isLoading: boolean
  load: () => Promise<void>
  log: (type: ActivityActionType, opts?: { objectId?: string; courseId?: string; durationSeconds?: number }) => Promise<void>
}

export const useActivityStore = create<ActivityState>()(
  immer((set, get) => ({
    stats: null,
    recent: [],
    earnedBadges: [],
    weekActivity: [],
    isLoading: false,

    load: async () => {
      set((s) => { s.isLoading = true })
      const db = await getDB()
      const [stats, recent] = await Promise.all([
        db.activity.getUserStats(),
        db.activity.getRecentActivity(20),
      ])
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7)
      const weekActivity = await db.activity.getActivityByDateRange(weekStart, new Date())

      // Evaluate badges
      const courses = await db.courses.getActive()
      const ctx: BadgeContext = {
        stats,
        flashcardsReviewed: stats.totalFlashcardsReviewed,
        notesCreated: weekActivity.filter((a) => a.actionType === 'note_created').length + recent.filter((a) => a.actionType === 'note_created').length,
        activeCourses: courses.length,
        studiedAfterMidnight: recent.some((a) => a.loggedAt.getHours() >= 0 && a.loggedAt.getHours() < 4),
        studiedBefore6am: recent.some((a) => a.loggedAt.getHours() >= 4 && a.loggedAt.getHours() < 6),
        hasAGrade: false,
      }
      const earnedBadges = evaluateBadges(ctx)

      set((s) => { s.stats = stats; s.recent = recent; s.weekActivity = weekActivity; s.earnedBadges = earnedBadges; s.isLoading = false })
    },

    log: async (type, opts) => {
      const db = await getDB()
      await db.activity.log(type, opts ?? {})
      await db.activity.updateStreak()
      await get().load()
    },
  })),
)

export { BADGES }
