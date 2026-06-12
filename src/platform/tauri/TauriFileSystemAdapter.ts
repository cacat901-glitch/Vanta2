import type { FileSystemAdapter, FileEntry, DialogOptions, UnwatchFn } from '../adapters/FileSystemAdapter'

/**
 * Tauri implementation of FileSystemAdapter.
 * All Tauri API imports are dynamic so this module is never executed in the
 * browser / Vite build — the platform/index.ts factory only instantiates this
 * class when window.__TAURI_INTERNALS__ is present.
 */
export class TauriFileSystemAdapter implements FileSystemAdapter {
  async readFile(path: string): Promise<Uint8Array> {
    const { readFile } = await import('@tauri-apps/plugin-fs')
    return readFile(path)
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const { writeFile } = await import('@tauri-apps/plugin-fs')
    await writeFile(path, data)
  }

  async readText(path: string): Promise<string> {
    const { readTextFile } = await import('@tauri-apps/plugin-fs')
    return readTextFile(path)
  }

  async writeText(path: string, text: string): Promise<void> {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(path, text)
  }

  async deleteFile(path: string): Promise<void> {
    const { remove } = await import('@tauri-apps/plugin-fs')
    await remove(path)
  }

  async listDirectory(path: string): Promise<FileEntry[]> {
    const { readDir } = await import('@tauri-apps/plugin-fs')
    const entries = await readDir(path)
    return entries.map((e: { name: string; isDirectory?: boolean }) => ({
      name: e.name,
      path: `${path}/${e.name}`,
      isDirectory: e.isDirectory ?? false,
      size: null,
      modifiedAt: null,
    }))
  }

  async createDirectory(path: string): Promise<void> {
    const { mkdir } = await import('@tauri-apps/plugin-fs')
    await mkdir(path, { recursive: true })
  }

  async openFileDialog(options?: DialogOptions): Promise<string[]> {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const result = await open({
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
      multiple: options?.multiple ?? false,
      directory: options?.directory ?? false,
    })
    if (!result) return []
    if (Array.isArray(result)) return result as string[]
    return [result as string]
  }

  async openSaveDialog(options?: DialogOptions): Promise<string | null> {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const result = await save({
      title: options?.title,
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    })
    return (result as string | null) ?? null
  }

  async watchFile(_path: string, _callback: () => void): Promise<UnwatchFn> {
    console.warn('[TauriFS] File watching not yet implemented')
    return () => { /* no-op */ }
  }

  async getAppDataDir(): Promise<string> {
    const { invoke } = await import('@tauri-apps/api/core')
    // invoke<T> with type argument — cast result to string
    const dir = await invoke('get_app_data_dir') as string
    return dir
  }

  async revealInExplorer(path: string): Promise<void> {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('plugin:shell|open', { path })
  }

  async exists(path: string): Promise<boolean> {
    const { exists } = await import('@tauri-apps/plugin-fs')
    return exists(path)
  }

  joinPath(...segments: string[]): string {
    return segments.join('/').replace(/\/+/g, '/')
  }
}
