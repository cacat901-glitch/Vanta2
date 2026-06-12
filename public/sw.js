/**
 * StudyOS Service Worker
 * Strategy: Cache-first for static assets, Network-first for API calls
 */

const CACHE_NAME = 'studyos-v1'
const STATIC_CACHE = 'studyos-static-v1'
const FONT_CACHE = 'studyos-fonts-v1'

// Assets to precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
]

// ─── Install ──────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS)
    }).then(() => self.skipWaiting())
  )
})

// ─── Activate ─────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== FONT_CACHE)
          .map((name) => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Skip AI API calls — always go to network
  if (
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('groq.com') ||
    url.hostname.includes('openrouter.ai') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('anthropic.com') ||
    (url.hostname === 'localhost' && url.port === '11434') // Ollama
  ) {
    return // Let the browser handle AI calls natively (no caching)
  }

  // Cache fonts from Bunny Fonts
  if (url.hostname === 'fonts.bunny.net') {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached
        const response = await fetch(event.request)
        cache.put(event.request, response.clone())
        return response
      })
    )
    return
  }

  // Cache-first for static assets (JS, CSS, images)
  if (
    url.pathname.match(/\.(js|css|png|svg|ico|woff2?|ttf)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) return cached
        const response = await fetch(event.request)
        if (response.ok) cache.put(event.request, response.clone())
        return response
      })
    )
    return
  }

  // Network-first for navigation (HTML pages) — enables offline fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html')
      })
    )
    return
  }
})

// ─── Push notifications ───────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'StudyOS', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      data: { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
