import { BaseRepository } from './base'
import type { AppSettings } from '@/types'
import { DEFAULT_SETTINGS } from '@/types/settings'

export class SettingsRepository extends BaseRepository {
  async get<T>(key: string, fallback: T): Promise<T> {
    const row = await this.storage.queryOne<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    )
    if (!row) return fallback
    return this.deserialize<T>(row.value, fallback)
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.storage.execute(
      'INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(value), this.now()]
    )
  }

  async getAll(): Promise<AppSettings> {
    return this.get<AppSettings>('app_settings', DEFAULT_SETTINGS)
  }

  async saveAll(settings: AppSettings): Promise<void> {
    await this.set('app_settings', settings)
  }

  async updatePartial(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getAll()
    const merged = { ...current, ...updates }
    await this.saveAll(merged)
    return merged
  }
}
