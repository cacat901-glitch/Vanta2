import type { StorageAdapter, Transaction } from '../adapters/StorageAdapter'

let _db: unknown = null

async function getDb(): Promise<unknown> {
  if (_db) return _db
  const Database = (await import('@tauri-apps/plugin-sql')).default
  _db = await Database.load('sqlite:studyos.db')
  return _db
}

/**
 * Tauri SQLite implementation of StorageAdapter.
 * Uses tauri-plugin-sql for all database operations.
 */
export class TauriStorageAdapter implements StorageAdapter {
  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const db = await getDb() as { execute: (sql: string, params: unknown[]) => Promise<unknown> }
    await db.execute(sql, params)
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = await getDb() as { select: <T>(sql: string, params: unknown[]) => Promise<T[]> }
    return db.select<T>(sql, params)
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results[0] ?? null
  }

  async transaction(fn: (tx: Transaction) => Promise<void>): Promise<void> {
    // SQLite in Tauri doesn't expose explicit transaction API
    // Execute as a series of statements — real transactions via BEGIN/COMMIT
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
    // Schema initialization handled by migration runner
    const { runMigrations } = await import('../../db/migrations/runner')
    await runMigrations(this)
  }

  async close(): Promise<void> {
    // Connection management handled by Tauri plugin
    _db = null
  }
}
