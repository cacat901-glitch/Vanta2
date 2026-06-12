import type { NotificationAdapter, AppNotification, ScheduledNotification } from '../adapters/NotificationAdapter'

/**
 * Web / PWA implementation of NotificationAdapter.
 * Uses the browser Notification API.
 */
export class WebNotificationAdapter implements NotificationAdapter {
  private _scheduled = new Map<string, ReturnType<typeof setTimeout>>()

  async send(notification: AppNotification): Promise<void> {
    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser')
      return
    }

    if (Notification.permission !== 'granted') {
      const granted = await this.requestPermission()
      if (!granted) return
    }

    const n = new Notification(notification.title, {
      body: notification.body,
      icon: notification.icon ?? '/icon-192.png',
      data: { actionUrl: notification.actionUrl },
    })

    if (notification.actionUrl) {
      n.onclick = () => {
        window.focus()
        // Navigate to the action URL
        if (notification.actionUrl) {
          window.location.hash = notification.actionUrl
        }
      }
    }
  }

  async schedule(notification: ScheduledNotification): Promise<string> {
    const delay = notification.scheduleAt.getTime() - Date.now()
    
    if (delay <= 0) {
      await this.send(notification)
      return notification.id
    }

    const timeoutId = setTimeout(async () => {
      await this.send(notification)
      this._scheduled.delete(notification.id)
    }, delay)

    this._scheduled.set(notification.id, timeoutId)
    return notification.id
  }

  async cancel(id: string): Promise<void> {
    const timeoutId = this._scheduled.get(id)
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      this._scheduled.delete(id)
    }
  }

  async cancelAll(): Promise<void> {
    for (const [id, timeoutId] of this._scheduled) {
      clearTimeout(timeoutId)
      this._scheduled.delete(id)
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    
    const result = await Notification.requestPermission()
    return result === 'granted'
  }

  async isPermitted(): Promise<boolean> {
    if (!('Notification' in window)) return false
    return Notification.permission === 'granted'
  }
}
