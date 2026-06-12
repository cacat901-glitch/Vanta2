/** Browser TTS + STT helpers with graceful fallback. */

export function speak(text: string, opts?: { rate?: number; onEnd?: () => void }): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) { opts?.onEnd?.(); return }
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = opts?.rate ?? 1
  if (opts?.onEnd) utter.onend = opts.onEnd
  window.speechSynthesis.speak(utter)
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
}

export function isTTSAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

// ─── Speech recognition (STT) ──────────────────────────────────────────
type SpeechRecognitionType = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

export function isSTTAvailable(): boolean {
  return typeof window !== 'undefined' &&
    ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
}

export interface STTSession {
  stop: () => void
}

/** Start listening; calls onFinal with the recognized text when the user stops speaking. */
export function listen(onFinal: (text: string) => void, onInterim?: (text: string) => void): STTSession | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vendor-prefixed API
  const SR = (window as any).webkitSpeechRecognition ?? (window as any).SpeechRecognition
  if (!SR) return null
  const rec: SpeechRecognitionType = new SR()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = 'en-US'
  let finalText = ''
  rec.onresult = (e) => {
    let interim = ''
    for (let i = 0; i < e.results.length; i++) {
      const transcript = e.results[i]![0]!.transcript
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- isFinal on result
      if ((e.results[i] as any).isFinal) finalText += transcript
      else interim += transcript
    }
    onInterim?.(finalText + interim)
  }
  rec.onend = () => { if (finalText.trim()) onFinal(finalText.trim()) }
  rec.start()
  return { stop: () => rec.stop() }
}
