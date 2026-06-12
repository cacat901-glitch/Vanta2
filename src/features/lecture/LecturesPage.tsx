import { useEffect, useState, useRef } from 'react'
import { Mic, Square, Plus, Trash2, FileAudio, Loader2 } from 'lucide-react'
import { useLectureStore } from '@/store/lectureStore'
import { useAppStore } from '@/store/appStore'
import { getAudioAdapter } from '@/platform'
import type { RecordingSession } from '@/platform/adapters/AudioAdapter'
import { LectureDetail } from './LectureDetail'
import { Button } from '@/components/ui'
import { relativeDate, formatDuration } from '@/lib/utils'
import type { Lecture } from '@/types/knowledge'

export function LecturesPage() {
  const lectures = useLectureStore((s) => s.lectures)
  const load = useLectureStore((s) => s.load)
  const create = useLectureStore((s) => s.create)
  const remove = useLectureStore((s) => s.remove)
  const toast = useAppStore((s) => s.addToast)
  const [active, setActive] = useState<Lecture | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const sessionRef = useRef<RecordingSession | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => { void load() }, [load])

  const startRec = async () => {
    try {
      const audio = await getAudioAdapter()
      if (!audio.isRecordingSupported()) { toast({ type: 'error', title: 'Recording not supported here' }); return }
      sessionRef.current = await audio.startRecording()
      setRecording(true); setElapsed(0)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch { toast({ type: 'error', title: 'Microphone access denied' }) }
  }

  const stopRec = async () => {
    const audio = await getAudioAdapter()
    if (!sessionRef.current) return
    await audio.stopRecording(sessionRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    const lec = await create(`Lecture ${new Date().toLocaleDateString()}`, undefined, elapsed)
    sessionRef.current = null
    toast({ type: 'success', title: 'Lecture recorded', description: 'Add a transcript to process it with AI.' })
    setActive(lec)
  }

  if (active) {
    return <LectureDetail lectureId={active.id} onBack={() => { setActive(null); void load() }} />
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Lectures</h1>
        {recording ? (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-sm text-danger"><span className="w-2 h-2 rounded-full bg-danger animate-pulse" /> {formatDuration(elapsed)}</span>
            <Button variant="destructive" size="sm" onClick={stopRec}><Square size={14} /> Stop</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={async () => { const l = await create('Untitled Lecture'); setActive(l) }}><Plus size={14} /> New</Button>
            <Button size="sm" onClick={startRec}><Mic size={14} /> Record</Button>
          </div>
        )}
      </div>

      {lectures.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center"><Mic size={28} className="text-text-muted" /></div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">No lectures yet</h2>
            <p className="text-text-muted text-sm mt-1">Record a lecture or create one to add a transcript and process it with AI</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {lectures.map((l) => (
            <div key={l.id} className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border-subtle hover:border-accent-primary/40 transition-colors">
              <button onClick={() => setActive(l)} className="flex items-center gap-3 flex-1 text-left">
                <div className="w-10 h-10 rounded-lg bg-accent-primary/15 flex items-center justify-center"><FileAudio size={18} className="text-accent-primary" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{l.title}</p>
                  <p className="text-xs text-text-muted">{relativeDate(l.recordedAt)} · {l.duration ? formatDuration(l.duration) : '—'} · {l.summary ? 'processed' : 'needs transcript'}</p>
                </div>
              </button>
              {l.status === 'processing' && !l.summary && <Loader2 size={14} className="animate-spin text-text-muted" />}
              <button onClick={() => { if (confirm('Delete lecture?')) void remove(l.id) }} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
