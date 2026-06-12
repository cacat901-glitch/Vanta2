import initSqlJs, { type SqlJsDatabase, type SqlJsStatic } from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import type { StorageAdapter, Transaction } from '../adapters/StorageAdapter'

/**
 * Browser/PWA StorageAdapter backed by REAL SQLite compiled to WebAssembly
 * (sql.js). The exact same SQL that runs against Tauri's native SQLite runs
 * here — ranges, JOINs, FTS5, IN/LIKE, proper PRIMARY KEY upserts all work.
 *
 * Persistence: sql.js keeps the database in WASM memory. We snapshot the whole
 * database (db.export()) into a single IndexedDB record, debounced after writes
 * and flushed on page hide, then restore it on the next boot.
 */

const IDB_NAME = 'studyos-sqlite'
const IDB_STORE = 'db'
const IDB_KEY = 'main'

// ─── tiny IndexedDB blob store (one Uint8Array) ───────────────────────────────
function openBlobStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function loadSnapshot(): Promise<Uint8Array | null> {
  try {
    const idb = await openBlobStore()
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
      req.onsuccess = () => resolve((req.result as Uint8Array) ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

async function saveSnapshot(bytes: Uint8Array): Promise<void> {
  const idb = await openBlobStore()
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(bytes, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}


// ─── param coercion (sql.js rejects undefined / Date / boolean) ───────────────
function coerceParams(params: unknown[]): unknown[] {
  return params.map((p) => {
    if (p === undefined) return null
    if (p instanceof Date) return p.toISOString()
    if (typeof p === 'boolean') return p ? 1 : 0
    return p
  })
}

/** True if a statement targets the FTS5 virtual table (optional feature). */
function isFtsStatement(sql: string): boolean {
  return /pages_fts/i.test(sql) || /\bfts5\b/i.test(sql)
}

export class SqlJsStorageAdapter implements StorageAdapter {
  private static _sql: SqlJsStatic | null = null
  private _db: SqlJsDatabase | null = null
  private _saveTimer: ReturnType<typeof setTimeout> | null = null
  private _dirty = false
  private _ftsAvailable = true

  async initialize(): Promise<void> {
    if (this._db) return

    if (!SqlJsStorageAdapter._sql) {
      SqlJsStorageAdapter._sql = await initSqlJs({ locateFile: () => wasmUrl })
    }

    const snapshot = await loadSnapshot()
    this._db = new SqlJsStorageAdapter._sql.Database(snapshot ?? null)

    // Probe FTS5 availability once so we can gracefully skip if unsupported.
    try {
      this._db.run('CREATE VIRTUAL TABLE IF NOT EXISTS __fts_probe USING fts5(x)')
      this._db.run('DROP TABLE IF EXISTS __fts_probe')
      this._ftsAvailable = true
    } catch {
      this._ftsAvailable = false
    }

    // Flush pending writes when the tab is hidden or closed.
    if (typeof window !== 'undefined') {
      const flush = () => { if (this._dirty) void this._persistNow() }
      window.addEventListener('pagehide', flush)
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush()
      })
    }

    // Run migrations (real DDL now — tables, indexes, FKs all created).
    const { runMigrations } = await import('../../db/migrations/runner')
    await runMigrations(this)
    await this._persistNow()
  }

  async close(): Promise<void> {
    await this._persistNow()
    this._db?.close()
    this._db = null
  }


  // ─── mutations ──────────────────────────────────────────────────────────────
  async execute(sql: string, params: unknown[] = []): Promise<void> {
    const db = this._require()

    // Skip FTS statements entirely if FTS5 isn't available in this build.
    if (!this._ftsAvailable && isFtsStatement(sql)) return

    try {
      db.run(sql, coerceParams(params))
      this._scheduleSave()
    } catch (err) {
      // FTS statements are best-effort: never let search break the app.
      if (isFtsStatement(sql)) { this._ftsAvailable = false; return }
      throw err
    }
  }

  // ─── reads ────────────────────────────────────────────────────────────────
  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = this._require()

    // If FTS isn't available, throw on FTS reads so repositories fall back
    // to their LIKE-based search path (real SQLite supports LIKE).
    if (!this._ftsAvailable && isFtsStatement(sql)) {
      throw new Error('FTS5 unavailable')
    }

    try {
      const stmt = db.prepare(sql, coerceParams(params))
      const rows: T[] = []
      while (stmt.step()) rows.push(stmt.getAsObject() as T)
      stmt.free()
      return rows
    } catch (err) {
      if (isFtsStatement(sql)) { this._ftsAvailable = false; throw err }
      throw err
    }
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params)
    return rows[0] ?? null
  }

  async transaction(fn: (tx: Transaction) => Promise<void>): Promise<void> {
    const db = this._require()
    db.run('BEGIN')
    try {
      const tx: Transaction = {
        execute: (s, p) => this.execute(s, p),
        query: <T>(s: string, p?: unknown[]) => this.query<T>(s, p),
        queryOne: <T>(s: string, p?: unknown[]) => this.queryOne<T>(s, p),
      }
      await fn(tx)
      db.run('COMMIT')
      this._scheduleSave()
    } catch (err) {
      db.run('ROLLBACK')
      throw err
    }
  }

  // ─── persistence ────────────────────────────────────────────────────────────
  private _scheduleSave(): void {
    this._dirty = true
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => { void this._persistNow() }, 400)
  }

  private async _persistNow(): Promise<void> {
    if (!this._db || !this._dirty) return
    this._dirty = false
    try {
      await saveSnapshot(this._db.export())
    } catch (err) {
      // If a save fails, mark dirty again so the next change retries.
      this._dirty = true
      console.error('[SqlJsStorageAdapter] snapshot save failed', err)
    }
  }

  private _require(): SqlJsDatabase {
    if (!this._db) throw new Error('SqlJsStorageAdapter not initialized')
    return this._db
  }
}
