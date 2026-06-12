// ─── Notification Adapter Interface ──────────────────────────────────

export interface AppNotification {
  id: string
  title: string
  body: string
  actionUrl?: string
  icon?: string
}

export interface ScheduledNotification extends AppNotification {
  scheduleAt: Date
}

export interface NotificationAdapter {
  /** Send an immediate notification */
  send(notification: AppNotification): Promise<void>
  /** Schedule a notification for a future time */
  schedule(notification: ScheduledNotification): Promise<string>
  /** Cancel a scheduled notification by ID */
  cancel(id: string): Promise<void>
  /** Cancel all pending scheduled notifications */
  cancelAll(): Promise<void>
  /** Request notification permission from OS/browser */
  requestPermission(): Promise<boolean>
  /** Check if notifications are currently permitted */
  isPermitted(): Promise<boolean>
}
