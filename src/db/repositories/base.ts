import type { StorageAdapter } from '@/platform/adapters/StorageAdapter'

/** Base class all repositories extend. Provides the storage adapter. */
export abstract class BaseRepository {
  constructor(protected readonly storage: StorageAdapter) {}

  /** Serialize a JS value to a JSON string for TEXT columns */
  protected serialize<T>(value: T): string {
    return JSON.stringify(value)
  }

  /** Deserialize a JSON string from a TEXT column */
  protected deserialize<T>(json: string | null | undefined, fallback: T): T {
    if (!json) return fallback
    try {
      return JSON.parse(json) as T
    } catch {
      return fallback
    }
  }

  /** Convert ISO string from DB to Date */
  protected toDate(iso: string | null | undefined): Date | null {
    if (!iso) return null
    return new Date(iso)
  }

  /** Convert Date to ISO string for DB */
  protected fromDate(date: Date | null | undefined): string | null {
    if (!date) return null
    return date.toISOString()
  }

  /** Convert 0/1 integer from SQLite to boolean */
  protected toBool(val: number | boolean | null | undefined): boolean {
    if (typeof val === 'boolean') return val
    return val === 1
  }

  /** Generate a unique ID */
  protected newId(): string {
    return crypto.randomUUID()
  }

  /** Now as ISO string */
  protected now(): string {
    return new Date().toISOString()
  }
}
