import type { FileSystemAdapter, FileEntry, DialogOptions, UnwatchFn } from '../adapters/FileSystemAdapter'

/**
 * Web / PWA implementation of FileSystemAdapter.
 * Uses the browser File System Access API where available.
 * Falls back gracefully with clear error messages.
 */
export class WebFileSystemAdapter implements FileSystemAdapter {
  private _appDataDir = 'studyos-data'

  async readFile(path: string): Promise<Uint8Array> {
    // In browser mode, files are stored as Blobs in IndexedDB
    // This is called by the document pipeline for uploaded files
    const db = await this._getFileDb()
    const record = await db.get('files', path) as { data: Uint8Array } | undefined
    if (!record) throw new Error(`File not found: ${path}`)
    return record.data
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const db = await this._getFileDb()
    await db.put('files', { path, data, savedAt: new Date() }, path)
  }

  async readText(path: string): Promise<string> {
    const bytes = await this.readFile(path)
    return new TextDecoder().decode(bytes)
  }

  async writeText(path: string, text: string): Promise<void> {
    const bytes = new TextEncoder().encode(text)
    await this.writeFile(path, bytes)
  }

  async deleteFile(path: string): Promise<void> {
    const db = await this._getFileDb()
    await db.delete('files', path)
  }

  async listDirectory(path: string): Promise<FileEntry[]> {
    const db = await this._getFileDb()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- IDB returns unknown
    const all = await db.getAll('files') as any[]
    return all
      .filter((f: { path: string }) => f.path.startsWith(path + '/'))
      .map((f: { path: string; data: Uint8Array; savedAt: Date }) => ({
        name: f.path.split('/').pop() ?? '',
        path: f.path,
        isDirectory: false,
        size: f.data.byteLength,
        modifiedAt: f.savedAt,
      }))
  }

  async createDirectory(_path: string): Promise<void> {
    // No-op in browser — directories are implicit in path strings
  }

  async openFileDialog(options?: DialogOptions): Promise<string[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = options?.multiple ?? false
      
      if (options?.filters?.length) {
        const accepts = options.filters
          .flatMap(f => f.extensions.map(ext => `.${ext}`))
          .join(',')
        input.accept = accepts
      }

      input.onchange = async () => {
        const files = Array.from(input.files ?? [])
        const paths: string[] = []
        
        for (const file of files) {
          const path = `uploads/${Date.now()}-${file.name}`
          const bytes = await file.arrayBuffer()
          await this.writeFile(path, new Uint8Array(bytes))
          paths.push(path)
        }
        
        resolve(paths)
      }

      input.oncancel = () => resolve([])
      input.click()
    })
  }

  async openSaveDialog(_options?: DialogOptions): Promise<string | null> {
    // Browser doesn't have a native save dialog — return a timestamp-based path
    return `exports/export-${Date.now()}`
  }

  async watchFile(_path: string, _callback: () => void): Promise<UnwatchFn> {
    // File watching not available in browser
    console.warn('File watching is not available in browser mode')
    return () => { /* no-op */ }
  }

  async getAppDataDir(): Promise<string> {
    return this._appDataDir
  }

  async revealInExplorer(_path: string): Promise<void> {
    console.warn('File system reveal not available in browser mode')
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.readFile(path)
      return true
    } catch {
      return false
    }
  }

  joinPath(...segments: string[]): string {
    return segments.join('/').replace(/\/+/g, '/')
  }

  // ─── Private helpers ───────────────────────────────────────────────

  private _db: IDBDatabase | null = null

  private async _getFileDb(): Promise<IDBDatabase> {
    if (this._db) return this._db
    
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('studyos-files', 1)
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'path' })
        }
      }
      req.onsuccess = (e) => {
        this._db = (e.target as IDBOpenDBRequest).result
        resolve(this._db)
      }
      req.onerror = () => reject(req.error)
    })
  }
}

// Polyfill IDBDatabase methods as async
declare global {
  interface IDBDatabase {
    get(store: string, key: string): Promise<unknown>
    put(store: string, value: unknown, key?: string): Promise<void>
    delete(store: string, key: string): Promise<void>
    getAll(store: string): Promise<unknown[]>
  }
}

IDBDatabase.prototype.get = function(store: string, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = this.transaction(store, 'readonly')
    const req = tx.objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

IDBDatabase.prototype.put = function(store: string, value: unknown, key?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = this.transaction(store, 'readwrite')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- IDB put accepts any
    const req = key !== undefined ? tx.objectStore(store).put(value as any, key) : tx.objectStore(store).put(value as any)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

IDBDatabase.prototype.delete = function(store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = this.transaction(store, 'readwrite')
    const req = tx.objectStore(store).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

IDBDatabase.prototype.getAll = function(store: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const tx = this.transaction(store, 'readonly')
    const req = tx.objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
