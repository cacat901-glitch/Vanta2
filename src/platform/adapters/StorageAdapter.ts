// ─── Storage Adapter Interface ────────────────────────────────────────
// Low-level SQL-like interface used by repositories.
// No service or UI code calls this directly.

export interface Transaction {
  execute(sql: string, params?: unknown[]): Promise<void>
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>
}

export interface StorageAdapter {
  /** Execute a statement (INSERT, UPDATE, DELETE, CREATE TABLE) */
  execute(sql: string, params?: unknown[]): Promise<void>
  /** Query and return all matching rows */
  query<T>(sql: string, params?: unknown[]): Promise<T[]>
  /** Query and return the first matching row (or null) */
  queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>
  /** Run multiple operations in a single atomic transaction */
  transaction(fn: (tx: Transaction) => Promise<void>): Promise<void>
  /** Initialize database schema (run on first boot) */
  initialize(): Promise<void>
  /** Close the database connection */
  close(): Promise<void>
}
