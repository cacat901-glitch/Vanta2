import type { NotificationAdapter, AppNotification, ScheduledNotification } from '../adapters/NotificationAdapter'

export class TauriNotificationAdapter implements NotificationAdapter {
  async send(notification: AppNotification): Promise<void> {
    const { sendNotification } = await import('@tauri-apps/plugin-notification')
    sendNotification({
      title: notification.title,
      body: notification.body,
      icon: notification.icon,
    })
  }

  async schedule(notification: ScheduledNotification): Promise<string> {
    // Use Tauri notification scheduling when available
    // For now, fall back to setTimeout + send
    const delay = notification.scheduleAt.getTime() - Date.now()
    if (delay > 0) {
      setTimeout(() => void this.send(notification), delay)
    } else {
      await this.send(notification)
    }
    return notification.id
  }

  async cancel(_id: string): Promise<void> {
    // Full cancellation requires storing timeout IDs
    // Simplified: no-op for now
  }

  async cancelAll(): Promise<void> {
    // no-op - full implementation requires tracking all scheduled IDs
  }

  async requestPermission(): Promise<boolean> {
    const { requestPermission, isPermissionGranted } = await import('@tauri-apps/plugin-notification')
    const alreadyGranted = await isPermissionGranted()
    if (alreadyGranted) return true
    const permission = await requestPermission()
    return permission === 'granted'
  }

  async isPermitted(): Promise<boolean> {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification')
    return isPermissionGranted()
  }
}
