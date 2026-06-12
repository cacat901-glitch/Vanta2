import { BaseRepository } from './base'
import type { ActivityLog, ActivityActionType, UserStats } from '@/types'
import { XP_REWARDS, levelFromXP, xpForLevel } from '@/types/activity'

interface ActivityRow {
  id: string; action_type: string; object_id: string | null
  object_type: string | null; course_id: string | null
  duration_seconds: number | null; metadata: string; logged_at: string
}

interface UserStatsRow {
  id: string; total_xp: number; level: number; current_streak: number
  longest_streak: number; last_study_date: string | null
  total_study_hours: number; total_flashcards_reviewed: number
  total_tasks_completed: number; updated_at: string
}

export class ActivityRepository extends BaseRepository {
  async log(
    actionType: ActivityActionType,
    opts: { objectId?: string; objectType?: string; courseId?: string; durationSeconds?: number; metadata?: Record<string, unknown> }
  ): Promise<void> {
    const id = this.newId()
    await this.storage.execute(
      `INSERT INTO activity_log
        (id, action_type, object_id, object_type, course_id, duration_seconds, metadata, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, actionType,
        opts.objectId ?? null, opts.objectType ?? null, opts.courseId ?? null,
        opts.durationSeconds ?? null, JSON.stringify(opts.metadata ?? {}), this.now(),
      ]
    )
    // Award XP
    const xp = XP_REWARDS[actionType] ?? 0
    if (xp > 0) await this._addXP(xp)
  }

  async getRecentActivity(limit = 50): Promise<ActivityLog[]> {
    const rows = await this.storage.query<ActivityRow>(
      'SELECT * FROM activity_log ORDER BY logged_at DESC LIMIT ?',
      [limit]
    )
    return rows.map(this._rowToActivity.bind(this))
  }

  async getActivityByDateRange(from: Date, to: Date): Promise<ActivityLog[]> {
    const rows = await this.storage.query<ActivityRow>(
      'SELECT * FROM activity_log WHERE logged_at >= ? AND logged_at <= ? ORDER BY logged_at ASC',
      [from.toISOString(), to.toISOString()]
    )
    return rows.map(this._rowToActivity.bind(this))
  }

  async getTodayStudyHours(courseId?: string): Promise<number> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const params: unknown[] = ['writing_session', 'pomodoro_completed', today.toISOString()]
    const courseFilter = courseId ? 'AND course_id = ?' : ''
    if (courseId) params.push(courseId)
    const row = await this.storage.queryOne<{ total: number }>(
      `SELECT COALESCE(SUM(duration_seconds), 0) / 3600.0 as total
       FROM activity_log
       WHERE action_type IN ('writing_session', 'pomodoro_completed')
         AND logged_at >= ? ${courseFilter}`,
      params
    )
    return row?.total ?? 0
  }

  async getStreakData(): Promise<{ current: number; longest: number }> {
    const stats = await this._getUserStats()
    return { current: stats.currentStreak, longest: stats.longestStreak }
  }

  async getUserStats(): Promise<UserStats> {
    return this._getUserStats()
  }

  async updateStreak(): Promise<void> {
    const stats = await this._getUserStats()
    const today = new Date().toDateString()
    const lastStudy = stats.lastStudyDate ? stats.lastStudyDate.toDateString() : null
    const yesterday = new Date(Date.now() - 86400000).toDateString()

    let newStreak = stats.currentStreak
    if (lastStudy === today) {
      // Already counted today
      return
    } else if (lastStudy === yesterday) {
      newStreak = stats.currentStreak + 1
    } else if (lastStudy !== today) {
      newStreak = 1 // Reset streak
    }

    const longest = Math.max(newStreak, stats.longestStreak)

    await this.storage.execute(
      `UPDATE user_stats SET current_streak=?, longest_streak=?, last_study_date=?, updated_at=?
       WHERE id='singleton'`,
      [newStreak, longest, new Date().toISOString(), this.now()]
    )
  }

  private async _addXP(xp: number): Promise<void> {
    await this.storage.execute(
      'UPDATE user_stats SET total_xp = total_xp + ?, updated_at = ? WHERE id = ?',
      [xp, this.now(), 'singleton']
    )
    // Update level based on total XP
    const row = await this.storage.queryOne<{ total_xp: number }>('SELECT total_xp FROM user_stats WHERE id = ?', ['singleton'])
    if (row) {
      const newLevel = levelFromXP(row.total_xp)
      await this.storage.execute('UPDATE user_stats SET level = ? WHERE id = ?', [newLevel, 'singleton'])
    }
  }

  private async _getUserStats(): Promise<UserStats> {
    const row = await this.storage.queryOne<UserStatsRow>('SELECT * FROM user_stats WHERE id = ?', ['singleton'])
    if (!row) {
      return {
        totalXP: 0, level: 1, xpToNextLevel: xpForLevel(1),
        currentStreak: 0, longestStreak: 0, lastStudyDate: null,
        totalStudyHours: 0, totalFlashcardsReviewed: 0, totalTasksCompleted: 0, badges: [],
      }
    }
    const level = row.level
    return {
      totalXP: row.total_xp, level, xpToNextLevel: xpForLevel(level + 1),
      currentStreak: row.current_streak, longestStreak: row.longest_streak,
      lastStudyDate: row.last_study_date ? new Date(row.last_study_date) : null,
      totalStudyHours: row.total_study_hours,
      totalFlashcardsReviewed: row.total_flashcards_reviewed,
      totalTasksCompleted: row.total_tasks_completed,
      badges: [],
    }
  }

  private _rowToActivity(r: ActivityRow): ActivityLog {
    return {
      id: r.id, actionType: r.action_type as ActivityActionType,
      objectId: r.object_id, objectType: r.object_type, courseId: r.course_id,
      durationSeconds: r.duration_seconds,
      metadata: this.deserialize<Record<string, unknown>>(r.metadata, {}),
      loggedAt: new Date(r.logged_at),
    }
  }
}
