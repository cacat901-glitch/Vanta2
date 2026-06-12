import Dexie from 'dexie'
import type { StorageAdapter, Transaction } from '../adapters/StorageAdapter'

/**
 * Dexie/IndexedDB implementation of StorageAdapter for browser/PWA mode.
 *
 * Design: every row is stored as { id: "table:rowId", table, data: "{...json}" }.
 * All SQL-style queries are executed against the parsed JSON data in memory.
 * This handles arbitrary WHERE clauses with column = ? patterns.
 */

interface SqlRow {
  id: string        // composite key: "table:rowId"
  table: string
  data: string      // JSON of the actual row columns
  createdAt: number
  updatedAt: number
}

class StudyOSDatabase extends Dexie {
  sqlRows!: Dexie.Table<SqlRow, string>

  constructor() {
    super('StudyOSDB')
    this.version(1).stores({
      // Only the composite id and table are indexed. Everything else is in data.
      sqlRows: 'id, table, createdAt, updatedAt',
    })
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Extract table name from any SQL statement. */
function extractTable(sql: string): string {
  const m = sql.match(/(?:INTO|UPDATE|FROM|TABLE)\s+([\w_]+)/i)
  return m?.[1]?.toLowerCase() ?? ''
}

/**
 * Parse every "col = ?" pair in a WHERE clause, return {col → paramIndex} map.
 * Handles:
 *   WHERE id = ?
 *   WHERE workspace_id = ? AND name = ?
 *   WHERE page_id = ?  (from sub-queries we skip)
 *   WHERE is_favorite = 1  (literal integer)
 */
interface WhereClause {
  colParamPairs: Array<{ col: string; paramIndex: number | null; literal: unknown }>
}

function parseWhere(sql: string, params: unknown[]): WhereClause {
  const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s+GROUP|$)/is)
  if (!whereMatch) return { colParamPairs: [] }

  const clause = whereMatch[1]!
  // Split on AND (ignore OR for now — we don't use it)
  const parts = clause.split(/\bAND\b/i)
  let paramPos = 0

  const colParamPairs: WhereClause['colParamPairs'] = []

  for (const part of parts) {
    const eq = part.match(/(\w+)\s*=\s*(\?|[-\d]+)/i)
    if (!eq) continue
    const col = eq[1]!.toLowerCase()
    const val = eq[2]!
    if (val === '?') {
      colParamPairs.push({ col, paramIndex: paramPos++, literal: null })
    } else {
      // Literal value (e.g. is_favorite = 1)
      colParamPairs.push({ col, paramIndex: null, literal: Number(val) })
    }
  }

  return { colParamPairs }
}

/** Check whether a parsed data row matches all WHERE conditions. */
function rowMatches(data: Record<string, unknown>, where: WhereClause, params: unknown[]): boolean {
  for (const { col, paramIndex, literal } of where.colParamPairs) {
    const expected = paramIndex !== null ? params[paramIndex] : literal
    const actual = data[col]
    // Coerce: DB stores 0/1 for booleans; compare as strings if types differ
    if (String(actual) !== String(expected)) return false
  }
  return true
}

/** Parse SET clause, return [{col, paramIndex}] advancing from startParamIndex. */
function parseSet(sql: string): Array<{ col: string }> {
  const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is)
  if (!setMatch) return []
  return setMatch[1]!
    .split(',')
    .map(p => p.trim())
    .map(p => ({ col: p.split('=')[0]!.trim().toLowerCase() }))
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class DexieStorageAdapter implements StorageAdapter {
  private db: StudyOSDatabase

  constructor() {
    this.db = new StudyOSDatabase()
  }

  async initialize(): Promise<void> {
    await this.db.open()
  }

  async close(): Promise<void> {
    this.db.close()
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const upper = sql.trim().toUpperCase()

    // DDL: silently ignore — no physical schema needed in Dexie
    if (
      upper.startsWith('CREATE') ||
      upper.startsWith('DROP') ||
      upper.startsWith('BEGIN') ||
      upper.startsWith('COMMIT') ||
      upper.startsWith('ROLLBACK') ||
      upper.startsWith('PRAGMA') ||
      upper.startsWith('CREATE VIRTUAL')
    ) return

    if (upper.startsWith('INSERT OR IGNORE') || upper.startsWith('INSERT OR REPLACE')) {
      await this._handleInsert(sql, params, true)
    } else if (upper.startsWith('INSERT')) {
      await this._handleInsert(sql, params, false)
    } else if (upper.startsWith('UPDATE')) {
      await this._handleUpdate(sql, params)
    } else if (upper.startsWith('DELETE')) {
      await this._handleDelete(sql, params)
    }
    // Everything else (e.g. FTS inserts) silently succeeds
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const upper = sql.trim().toUpperCase()

    // COUNT(*) shorthand
    if (upper.includes('COUNT(*)')) {
      return this._handleCount<T>(sql, params)
    }

    return this._handleSelect<T>(sql, params)
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results[0] ?? null
  }

  async transaction(fn: (tx: Transaction) => Promise<void>): Promise<void> {
    await this.db.transaction('rw', this.db.sqlRows, async () => {
      const tx: Transaction = {
        execute: (s, p) => this.execute(s, p),
        query: <T>(s: string, p?: unknown[]) => this.query<T>(s, p),
        queryOne: <T>(s: string, p?: unknown[]) => this.queryOne<T>(s, p),
      }
      await fn(tx)
    })
  }

  // ─── INSERT ─────────────────────────────────────────────────────────

  private async _handleInsert(sql: string, params: unknown[], upsert: boolean): Promise<void> {
    const table = extractTable(sql)
    if (!table) return

    // Extract column list from "(col1, col2, ...) VALUES"
    const colMatch = sql.match(/\(([^)]+)\)\s+VALUES/i)
    if (!colMatch) return

    const columns = colMatch[1]!.split(',').map(c => c.trim().toLowerCase())
    const row: Record<string, unknown> = {}
    columns.forEach((col, i) => { row[col] = params[i] ?? null })

    const rowId = (row['id'] as string) ?? `${table}-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const compositeKey = `${table}:${rowId}`

    if (!upsert) {
      // Standard INSERT: only write if not already present
      const existing = await this.db.sqlRows.get(compositeKey)
      if (existing) return
    }

    await this.db.sqlRows.put({
      id: compositeKey,
      table,
      data: JSON.stringify(row),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  }

  // ─── UPDATE ─────────────────────────────────────────────────────────

  private async _handleUpdate(sql: string, params: unknown[]): Promise<void> {
    const table = extractTable(sql)
    if (!table) return

    const setCols = parseSet(sql)
    const where = parseWhere(sql, params)

    // params: [set_val0, set_val1, ..., where_val0, where_val1, ...]
    const numSetParams = setCols.length
    const whereParams = params.slice(numSetParams)
    const whereCopy = parseWhere(sql, whereParams)

    const rows = await this.db.sqlRows.where('table').equals(table).toArray()

    for (const sqlRow of rows) {
      const data = JSON.parse(sqlRow.data) as Record<string, unknown>
      if (!rowMatches(data, whereCopy, whereParams)) continue

      setCols.forEach((s, i) => { data[s.col] = params[i] })
      await this.db.sqlRows.put({ ...sqlRow, data: JSON.stringify(data), updatedAt: Date.now() })
    }
    void where
  }

  // ─── DELETE ─────────────────────────────────────────────────────────

  private async _handleDelete(sql: string, params: unknown[]): Promise<void> {
    const table = extractTable(sql)
    if (!table) return

    const where = parseWhere(sql, params)

    if (where.colParamPairs.length === 0) {
      // DELETE FROM table (no WHERE) — delete all
      await this.db.sqlRows.where('table').equals(table).delete()
      return
    }

    const rows = await this.db.sqlRows.where('table').equals(table).toArray()
    for (const sqlRow of rows) {
      const data = JSON.parse(sqlRow.data) as Record<string, unknown>
      if (rowMatches(data, where, params)) {
        await this.db.sqlRows.delete(sqlRow.id)
      }
    }
  }

  // ─── SELECT ─────────────────────────────────────────────────────────

  private async _handleSelect<T>(sql: string, params: unknown[]): Promise<T[]> {
    const table = extractTable(sql)
    if (!table) return []

    // Skip FTS / virtual table queries — return empty
    if (sql.toLowerCase().includes('pages_fts') || sql.toLowerCase().includes('match ?')) {
      return []
    }

    let rows = await this.db.sqlRows.where('table').equals(table).toArray()

    // WHERE filtering
    const where = parseWhere(sql, params)
    if (where.colParamPairs.length > 0) {
      rows = rows.filter(r => {
        const data = JSON.parse(r.data) as Record<string, unknown>
        return rowMatches(data, where, params)
      })
    }

    // ORDER BY
    const orderMatch = sql.match(/ORDER BY\s+([\w_.]+)\s*(ASC|DESC)?/i)
    if (orderMatch) {
      const col = orderMatch[1]!.toLowerCase().replace(/^\w+\./, '') // strip "table."
      const dir = (orderMatch[2] ?? 'ASC').toUpperCase()
      rows.sort((a, b) => {
        const aData = JSON.parse(a.data) as Record<string, unknown>
        const bData = JSON.parse(b.data) as Record<string, unknown>
        const av = String(aData[col] ?? '')
        const bv = String(bData[col] ?? '')
        return dir === 'ASC' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }

    // LIMIT
    const limitMatch = sql.match(/\bLIMIT\s+(\d+)/i)
    if (limitMatch) rows = rows.slice(0, parseInt(limitMatch[1]!))

    return rows.map(r => JSON.parse(r.data) as T)
  }

  // ─── COUNT(*) ───────────────────────────────────────────────────────

  private async _handleCount<T>(sql: string, params: unknown[]): Promise<T[]> {
    const table = extractTable(sql)
    if (!table) return [{ count: 0 } as unknown as T]

    let rows = await this.db.sqlRows.where('table').equals(table).toArray()
    const where = parseWhere(sql, params)
    if (where.colParamPairs.length > 0) {
      rows = rows.filter(r => {
        const data = JSON.parse(r.data) as Record<string, unknown>
        return rowMatches(data, where, params)
      })
    }
    return [{ count: rows.length } as unknown as T]
  }
}
