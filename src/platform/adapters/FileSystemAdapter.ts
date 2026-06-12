// ─── FileSystem Adapter Interface ────────────────────────────────────
// RULE: No UI code imports Tauri APIs directly. Use this interface only.

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number | null
  modifiedAt: Date | null
}

export interface DialogOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
  multiple?: boolean
  directory?: boolean
}

export type UnwatchFn = () => void

export interface FileSystemAdapter {
  /** Read file as raw bytes (returned as base64 string for serialization) */
  readFile(path: string): Promise<Uint8Array>
  /** Write raw bytes to a file */
  writeFile(path: string, data: Uint8Array): Promise<void>
  /** Read file as UTF-8 text */
  readText(path: string): Promise<string>
  /** Write UTF-8 text to a file */
  writeText(path: string, text: string): Promise<void>
  /** Delete a file */
  deleteFile(path: string): Promise<void>
  /** List contents of a directory */
  listDirectory(path: string): Promise<FileEntry[]>
  /** Create a directory (and all parents) */
  createDirectory(path: string): Promise<void>
  /** Open a file picker dialog */
  openFileDialog(options?: DialogOptions): Promise<string[]>
  /** Open a save dialog */
  openSaveDialog(options?: DialogOptions): Promise<string | null>
  /** Watch a file or directory for changes */
  watchFile(path: string, callback: () => void): Promise<UnwatchFn>
  /** Get the app data directory path */
  getAppDataDir(): Promise<string>
  /** Reveal a file in the system file manager */
  revealInExplorer(path: string): Promise<void>
  /** Check if a file or directory exists */
  exists(path: string): Promise<boolean>
  /** Join path segments */
  joinPath(...segments: string[]): string
}
