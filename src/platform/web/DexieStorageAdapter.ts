import Dexie from 'dexie'
import type { StorageAdapter, Transaction } from '../adapters/StorageAdapter'

/**
 * Dexie/IndexedDB implementation of StorageAdapter for browser/PWA mode.
 * Implements a SQL-like interface on top of IndexedDB.
 *
 * NOTE: This uses a simple key-value store approach for the browser build.
 * The full SQL-compatible implementation is provided by the Tauri SQLite plugin.
 * For browser builds, complex relational queries are handled in the repository layer.
 */

interface SqlRow {
  id: string
  table: string
  data: string // JSON serialized row
  createdAt: number
  updatedAt: number
}

class StudyOSDatabase extends Dexie {
  sqlRows!: Dexie.Table<SqlRow, string>

  constructor() {
    super('StudyOSDB')
    this.version(1).stores({
      sqlRows: 'id, table, createdAt, updatedAt',
    })
  }
}

// Simple in-memory SQL-like execution using Dexie
// For complex SQL, the repository layer handles logic in JS
export class DexieStorageAdapter implements StorageAdapter {
  private db: StudyOSDatabase

  constructor() {
    this.db = new StudyOSDatabase()
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    // Parse simple INSERT, UPDATE, DELETE, CREATE TABLE statements
    const normalized = sql.trim().toUpperCase()
    
    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('CREATE INDEX')) {
      // Schema creation - no-op in Dexie mode (schema is defined in Dexie version stores)
      return
    }

    if (normalized.startsWith('INSERT')) {
      await this._handleInsert(sql, params)
      return
    }

    if (normalized.startsWith('UPDATE')) {
      await this._handleUpdate(sql, params)
      return
    }

    if (normalized.startsWith('DELETE')) {
      await this._handleDelete(sql, params)
      return
    }
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this._handleSelect<T>(sql, params)
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results[0] ?? null
  }

  async transaction(fn: (tx: Transaction) => Promise<void>): Promise<void> {
    // Dexie transactions
    await this.db.transaction('rw', this.db.sqlRows, async () => {
      const tx: Transaction = {
        execute: (sql, params) => this.execute(sql, params),
        query: <T>(sql: string, params?: unknown[]) => this.query<T>(sql, params),
        queryOne: <T>(sql: string, params?: unknown[]) => this.queryOne<T>(sql, params),
      }
      await fn(tx)
    })
  }

  async initialize(): Promise<void> {
    // Dexie auto-initializes on first open
    await this.db.open()
  }

  async close(): Promise<void> {
    this.db.close()
  }

  // ─── Private SQL parsing helpers ──────────────────────────────────

  private _extractTableName(sql: string): string {
    // Match "INSERT INTO table_name" or "UPDATE table_name" or "DELETE FROM table_name"
    const match = sql.match(/(?:INTO|UPDATE|FROM)\s+(\w+)/i)
    return match?.[1] ?? ''
  }

  private async _handleInsert(sql: string, params: unknown[]): Promise<void> {
    const table = this._extractTableName(sql)
    if (!table) return

    // Extract column names and values from SQL
    const colMatch = sql.match(/\(([^)]+)\)\s+VALUES/i)
    if (!colMatch) return

    const columns = colMatch[1]!.split(',').map(c => c.trim())
    const row: Record<string, unknown> = {}
    
    columns.forEach((col, i) => {
      row[col] = params[i] ?? null
    })

    const id = (row['id'] as string) ?? `${table}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    
    await this.db.sqlRows.put({
      id: `${table}:${id}`,
      table,
      data: JSON.stringify(row),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  private async _handleUpdate(sql: string, params: unknown[]): Promise<void> {
    const table = this._extractTableName(sql)
    if (!table) return

    // Simple UPDATE table SET col=? WHERE id=?
    const whereMatch = sql.match(/WHERE\s+id\s*=\s*\?/i)
    if (!whereMatch) return

    const id = params[params.length - 1] as string
    const existing = await this.db.sqlRows.get(`${table}:${id}`)
    if (!existing) return

    const currentData = JSON.parse(existing.data) as Record<string, unknown>
    
    // Extract SET clause  
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is)
    if (!setMatch) return

    const setParts = setMatch[1]!.split(',').map(p => p.trim())
    let paramIdx = 0
    
    for (const part of setParts) {
      const [col] = part.split('=').map(s => s.trim())
      if (col) currentData[col] = params[paramIdx++]
    }

    await this.db.sqlRows.put({
      ...existing,
      data: JSON.stringify(currentData),
      updatedAt: Date.now(),
    })
  }

  private async _handleDelete(sql: string, params: unknown[]): Promise<void> {
    const table = this._extractTableName(sql)
    if (!table) return

    const whereMatch = sql.match(/WHERE\s+id\s*=\s*\?/i)
    if (whereMatch && params.length > 0) {
      await this.db.sqlRows.delete(`${table}:${params[0]}`)
    } else {
      // Delete all from table
      await this.db.sqlRows.where('table').equals(table).delete()
    }
  }

  private async _handleSelect<T>(sql: string, params: unknown[]): Promise<T[]> {
    const table = this._extractTableName(sql)
    if (!table) return []

    let rows = await this.db.sqlRows.where('table').equals(table).toArray()

    // Apply simple WHERE id = ? filter
    const whereIdMatch = sql.match(/WHERE\s+(\w+)\.?id\s*=\s*\?/i)
    if (whereIdMatch && params.length > 0) {
      const id = params[0] as string
      rows = rows.filter(r => r.id === `${table}:${id}`)
    }

    // Apply ORDER BY
    const orderMatch = sql.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i)
    if (orderMatch) {
      const col = orderMatch[1]!
      const dir = orderMatch[2]?.toUpperCase() ?? 'ASC'
      rows.sort((a, b) => {
        const aData = JSON.parse(a.data) as Record<string, unknown>
        const bData = JSON.parse(b.data) as Record<string, unknown>
        const aVal = String(aData[col] ?? '')
        const bVal = String(bData[col] ?? '')
        return dir === 'ASC' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    }

    // Apply LIMIT
    const limitMatch = sql.match(/LIMIT\s+(\d+)/i)
    if (limitMatch) {
      rows = rows.slice(0, parseInt(limitMatch[1]!))
    }

    return rows.map(r => JSON.parse(r.data) as T)
  }
}
