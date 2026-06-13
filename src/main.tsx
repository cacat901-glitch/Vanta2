import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { enableMapSet } from 'immer'
import App from './App'
import './styles/globals.css'
import { registerServiceWorker, initPWAInstallPrompt } from './lib/pwa'

// Immer must be told to support Map/Set drafts — several stores keep Sets
// (e.g. expanded notebook/section ids). Without this, mutating a Set inside a
// producer throws and silently rolls back the whole update (notebooks would
// only appear after a manual refresh).
enableMapSet()

// Register PWA service worker (no-op in Tauri)
void registerServiceWorker()
initPWAInstallPrompt()

// Use HashRouter so Tauri's local file serving works correctly
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
)
