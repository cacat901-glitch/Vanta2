import type { StorageAdapter, Transaction } from '../adapters/StorageAdapter'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- opaque Tauri DB handle
let _db: any = null

async function getDb(): Promise<{
  execute: (sql: string, params: unknown[]) => Promise<unknown>
  select: <T>(sql: string, params: unknown[]) => Promise<T[]>
}> {
  if (_db) return _db as ReturnType<typeof getDb> extends Promise<infer T> ? T : never
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tauri plugin-sql uses a default export
  const Database = ((await import('@tauri-apps/plugin-sql')) as any).default
  _db = await Database.load('sqlite:studyos.db')
  return _db
}

/**
 * Tauri SQLite implementation of StorageAdapter.
 * Uses tauri-plugin-sql for all database operations.
 */
export class TauriStorageAdapter implements StorageAdapter {
  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const db = await getDb()
    await db.execute(sql, params)
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await getDb()
    return db.select<T>(sql, params)
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results[0] ?? null
  }

  async transaction(fn: (tx: Transaction) => Promise<void>): Promise<void> {
    await this.execute('BEGIN')
    try {
      const tx: Transaction = {
        execute: (sql, params) => this.execute(sql, params),
        query: <T>(sql: string, params?: unknown[]) => this.query<T>(sql, params),
        queryOne: <T>(sql: string, params?: unknown[]) => this.queryOne<T>(sql, params),
      }
      await fn(tx)
      await this.execute('COMMIT')
    } catch (err) {
      await this.execute('ROLLBACK')
      throw err
    }
  }

  async initialize(): Promise<void> {
    await getDb()
    const { runMigrations } = await import('../../db/migrations/runner')
    await runMigrations(this)
  }

  async close(): Promise<void> {
    _db = null
  }
}
