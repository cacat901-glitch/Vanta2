/// <reference types="vite/client" />

declare module '*?url' {
  const src: string
  export default src
}

// Web Speech API (vendor-prefixed) — loose typing for graceful fallback
interface Window {
  webkitSpeechRecognition?: unknown
  SpeechRecognition?: unknown
}


// ─── sql.js minimal type surface (we only use these members) ──────────
declare module 'sql.js' {
  export interface SqlJsStatement {
    bind(params?: unknown[] | Record<string, unknown>): boolean
    step(): boolean
    getAsObject(): Record<string, unknown>
    free(): boolean
    reset(): boolean
  }
  export interface SqlJsDatabase {
    run(sql: string, params?: unknown[] | Record<string, unknown>): SqlJsDatabase
    prepare(sql: string, params?: unknown[] | Record<string, unknown>): SqlJsStatement
    exec(sql: string, params?: unknown[]): Array<{ columns: string[]; values: unknown[][] }>
    export(): Uint8Array
    close(): void
  }
  export interface SqlJsStatic {
    Database: new (data?: Uint8Array | null) => SqlJsDatabase
  }
  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string
  }
  export default function initSqlJs(config?: InitSqlJsConfig): Promise<SqlJsStatic>
}

declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const src: string
  export default src
}
