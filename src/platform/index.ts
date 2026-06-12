/**
 * Platform detection and adapter factory.
 *
 * This is the ONLY file that knows which platform we're running on.
 * All UI code imports adapters from this file ONLY.
 *
 * Usage:
 *   import { fs, notifications, audio, shell } from '@/platform'
 */

import type { FileSystemAdapter } from './adapters/FileSystemAdapter'
import type { NotificationAdapter } from './adapters/NotificationAdapter'
import type { AudioAdapter } from './adapters/AudioAdapter'
import type { ShellAdapter } from './adapters/ShellAdapter'
import type { StorageAdapter } from './adapters/StorageAdapter'

// ─── Platform detection ───────────────────────────────────────────────

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && 'electron' in window
}

export const isBrowser = (): boolean => !isTauri() && !isElectron()

export const isPWA = (): boolean => {
  return (
    isBrowser() &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone === true)
  )
}

// ─── Lazy adapter initialization ─────────────────────────────────────
// Adapters are created once and cached

let _fs: FileSystemAdapter | null = null
let _notifications: NotificationAdapter | null = null
let _audio: AudioAdapter | null = null
let _shell: ShellAdapter | null = null
let _storage: StorageAdapter | null = null

export async function getFileSystemAdapter(): Promise<FileSystemAdapter> {
  if (_fs) return _fs

  if (isTauri()) {
    const { TauriFileSystemAdapter } = await import('./tauri/TauriFileSystemAdapter')
    _fs = new TauriFileSystemAdapter()
  } else {
    const { WebFileSystemAdapter } = await import('./web/WebFileSystemAdapter')
    _fs = new WebFileSystemAdapter()
  }

  return _fs
}

export async function getNotificationAdapter(): Promise<NotificationAdapter> {
  if (_notifications) return _notifications

  if (isTauri()) {
    const { TauriNotificationAdapter } = await import('./tauri/TauriNotificationAdapter')
    _notifications = new TauriNotificationAdapter()
  } else {
    const { WebNotificationAdapter } = await import('./web/WebNotificationAdapter')
    _notifications = new WebNotificationAdapter()
  }

  return _notifications
}

export async function getAudioAdapter(): Promise<AudioAdapter> {
  if (_audio) return _audio

  if (isTauri()) {
    const { TauriAudioAdapter } = await import('./tauri/TauriAudioAdapter')
    _audio = new TauriAudioAdapter()
  } else {
    const { WebAudioAdapter } = await import('./web/WebAudioAdapter')
    _audio = new WebAudioAdapter()
  }

  return _audio
}

export async function getShellAdapter(): Promise<ShellAdapter> {
  if (_shell) return _shell

  if (isTauri()) {
    const { TauriShellAdapter } = await import('./tauri/TauriShellAdapter')
    _shell = new TauriShellAdapter()
  } else {
    const { WebShellAdapter } = await import('./web/WebShellAdapter')
    _shell = new WebShellAdapter()
  }

  return _shell
}

export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (_storage) return _storage

  if (isTauri()) {
    const { TauriStorageAdapter } = await import('./tauri/TauriStorageAdapter')
    _storage = new TauriStorageAdapter()
  } else {
    const { DexieStorageAdapter } = await import('./web/DexieStorageAdapter')
    _storage = new DexieStorageAdapter()
  }

  await _storage.initialize()
  return _storage
}

// ─── Re-exports for convenience ────────────────────────────────────────
export type { FileSystemAdapter } from './adapters/FileSystemAdapter'
export type { NotificationAdapter } from './adapters/NotificationAdapter'
export type { StorageAdapter } from './adapters/StorageAdapter'
export type { AudioAdapter } from './adapters/AudioAdapter'
export type { ShellAdapter } from './adapters/ShellAdapter'
