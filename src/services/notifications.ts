import { getNotificationAdapter } from '@/platform'
import { getDB } from '@/db'
import { aiService } from '@/services/ai'
import type { NotificationSettings, NotificationTone } from '@/types/settings'

/** Generate notification text — AI if available, otherwise templated. */
async function notificationText(type: string, context: string, tone: NotificationTone): Promise<string> {
  if (aiService.isConfigured) {
    try { return await aiService.generateNotification(type, context, tone) } catch { /* fallback */ }
  }
  const templates: Record<string, string> = {
    morning: `Good morning! ${context}`,
    evening: `Evening check-in: ${context}`,
    streak: `Don't break your streak tonight! ${context}`,
    inactivity: `You haven't studied recently. ${context}`,
  }
  return templates[type] ?? context
}

/** Request permission and schedule today's notifications based on settings. */
export async function initNotifications(settings: NotificationSettings): Promise<void> {
  if (!settings.enabled) return
  const notif = await getNotificationAdapter()
  const granted = await notif.requestPermission()
  if (!granted) return

  await notif.cancelAll()
  const db = await getDB()
  const dueCount = await db.flashcards.getDueCountAll()
  const todayTasks = await db.tasks.getTodayTasks()

  const scheduleAt = (time: string): Date => {
    const [h, m] = time.split(':').map(Number)
    const d = new Date(); d.setHours(h ?? 8, m ?? 0, 0, 0)
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
    return d
  }

  if (settings.morningBriefing) {
    const body = await notificationText('morning', `You have ${todayTasks.length} tasks and ${dueCount} flashcards due today.`, settings.tone)
    await notif.schedule({ id: 'morning-briefing', title: 'StudyOS', body, scheduleAt: scheduleAt(settings.morningBriefingTime), actionUrl: '/dashboard' })
  }
  if (settings.eveningReminder) {
    const body = await notificationText('evening', `Have you hit your study goal today?`, settings.tone)
    await notif.schedule({ id: 'evening-reminder', title: 'StudyOS', body, scheduleAt: scheduleAt(settings.eveningReminderTime), actionUrl: '/dashboard' })
  }
  if (settings.streakAlert) {
    const body = await notificationText('streak', `Keep your momentum going.`, settings.tone)
    await notif.schedule({ id: 'streak-alert', title: 'StudyOS 🔥', body, scheduleAt: scheduleAt(settings.streakAlertTime), actionUrl: '/flashcards' })
  }
}

/** Send a one-off notification immediately. */
export async function notifyNow(title: string, body: string, actionUrl?: string): Promise<void> {
  const notif = await getNotificationAdapter()
  if (await notif.isPermitted()) {
    await notif.send({ id: `now-${Date.now()}`, title, body, actionUrl })
  }
}
