/**
 * PWA service worker registration.
 * Called once on app boot, only in browser mode.
 */
export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return

  // Don't register in Tauri (Tauri doesn't use service workers)
  if ('__TAURI_INTERNALS__' in window) return

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing
      if (!newWorker) return
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available — could show an "update available" toast
          console.log('[SW] New version available. Reload to update.')
        }
      })
    })

    console.log('[SW] Registered:', registration.scope)
  } catch (err) {
    console.warn('[SW] Registration failed:', err)
  }
}

/** Prompt the user to install the PWA */
let _installPrompt: BeforeInstallPromptEvent | null = null

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function initPWAInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _installPrompt = e as BeforeInstallPromptEvent
  })
}

export async function showInstallPrompt(): Promise<boolean> {
  if (!_installPrompt) return false
  await _installPrompt.prompt()
  const result = await _installPrompt.userChoice
  _installPrompt = null
  return result.outcome === 'accepted'
}

export function canInstall(): boolean {
  return _installPrompt !== null
}
