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
    const delay = notification.scheduleAt.getTime() - Date.now()
    if (delay > 0) {
      setTimeout(() => void this.send(notification), delay)
    } else {
      await this.send(notification)
    }
    return notification.id
  }

  async cancel(_id: string): Promise<void> {
    // Full implementation requires storing timeout IDs per scheduled notification
  }

  async cancelAll(): Promise<void> {
    // Full implementation requires a registry of all pending timeouts
  }

  async requestPermission(): Promise<boolean> {
    const { requestPermission, isPermissionGranted } = await import('@tauri-apps/plugin-notification')
    const alreadyGranted = await isPermissionGranted()
    if (alreadyGranted) return true
    const result = await requestPermission()
    return result === 'granted'
  }

  async isPermitted(): Promise<boolean> {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification')
    return isPermissionGranted()
  }
}
