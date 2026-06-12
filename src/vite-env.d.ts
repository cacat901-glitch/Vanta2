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
