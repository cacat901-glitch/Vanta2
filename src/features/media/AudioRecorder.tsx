import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Play, Pause, Loader2 } from 'lucide-react'
import { getAudioAdapter } from '@/platform'
import type { RecordingSession, AudioBlob } from '@/platform/adapters/AudioAdapter'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui'
import { formatDuration } from '@/lib/utils'

interface Recording { id: string; url: string; duration: number; date: Date }

export function AudioRecorder() {
  const toast = useAppStore((s) => s.addToast)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [amplitude, setAmplitude] = useState(0)
  const sessionRef = useRef<RecordingSession | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const ampRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); if (ampRef.current) clearInterval(ampRef.current) }, [])

  const start = async () => {
    try {
      const audio = await getAudioAdapter()
      if (!audio.isRecordingSupported()) { toast({ type: 'error', title: 'Recording not supported here' }); return }
      const session = await audio.startRecording()
      sessionRef.current = session
      setRecording(true); setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
      ampRef.current = setInterval(() => setAmplitude(audio.getAmplitude(session)), 100)
    } catch {
      toast({ type: 'error', title: 'Microphone access denied' })
    }
  }

  const stop = async () => {
    const audio = await getAudioAdapter()
    if (!sessionRef.current) return
    const blob: AudioBlob = await audio.stopRecording(sessionRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    if (ampRef.current) clearInterval(ampRef.current)
    const url = URL.createObjectURL(blob.blob)
    setRecordings((r) => [{ id: `rec-${Date.now()}`, url, duration: elapsed, date: new Date() }, ...r])
    setRecording(false); setAmplitude(0)
    sessionRef.current = null
    toast({ type: 'success', title: 'Recording saved' })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 py-8 rounded-xl border border-border-subtle bg-surface">
        {/* Waveform */}
        <div className="flex items-center gap-1 h-16">
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className="w-1.5 rounded-full bg-accent-primary transition-all duration-100"
              style={{ height: `${recording ? Math.max(4, amplitude * 64 * (0.5 + Math.random())) : 4}px`, opacity: recording ? 1 : 0.3 }} />
          ))}
        </div>
        <span className="text-2xl font-bold text-text-primary tabular-nums">{formatDuration(elapsed)}</span>
        {recording ? (
          <Button variant="destructive" onClick={stop}><Square size={16} /> Stop</Button>
        ) : (
          <Button onClick={start}><Mic size={16} /> Record</Button>
        )}
      </div>

      {recordings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">Recordings</h3>
          {recordings.map((r) => <RecordingRow key={r.id} rec={r} />)}
        </div>
      )}
    </div>
  )
}

function RecordingRow({ rec }: { rec: Recording }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface border border-border-subtle">
      <button onClick={() => { const a = audioRef.current; if (!a) return; if (playing) { a.pause() } else { void a.play() }; setPlaying(!playing) }}
        className="w-8 h-8 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center">
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <div className="flex-1">
        <p className="text-sm text-text-primary">Voice memo</p>
        <p className="text-xs text-text-muted">{rec.date.toLocaleString()} · {formatDuration(rec.duration)}</p>
      </div>
      <audio ref={audioRef} src={rec.url} onEnded={() => setPlaying(false)} />
    </div>
  )
}

void Loader2
