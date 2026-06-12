import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './styles/globals.css'
import { registerServiceWorker, initPWAInstallPrompt } from './lib/pwa'

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
