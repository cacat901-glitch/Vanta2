import { useMemo, useEffect, useState } from 'react'
import { Play, Pause, SkipForward, Square } from 'lucide-react'
import { usePlannerStore } from '@/store/plannerStore'
import { useCourseStore } from '@/store/courseStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui'
import { formatDuration } from '@/lib/utils'

export function PomodoroView() {
  const pomodoro = usePlannerStore((s) => s.pomodoro)
  const startPomodoro = usePlannerStore((s) => s.startPomodoro)
  const pausePomodoro = usePlannerStore((s) => s.pausePomodoro)
  const resumePomodoro = usePlannerStore((s) => s.resumePomodoro)
  const skipPomodoro = usePlannerStore((s) => s.skipPomodoro)
  const stopPomodoro = usePlannerStore((s) => s.stopPomodoro)
  const settings = useSettingsStore((s) => s.settings.pomodoro)
  const courses = useCourseStore((s) => s.courses)
  const [linkedCourse, setLinkedCourse] = useState('')
  const [todayCount, setTodayCount] = useState(0)

  useEffect(() => {
    void (async () => {
      const { getDB } = await import('@/db')
      const db = await getDB()
      const sessions = await db.tasks.getTodayPomodoros()
      setTodayCount(sessions.length)
    })()
  }, [pomodoro.phase])

  const phaseDuration = useMemo(() => {
    if (pomodoro.phase === 'work') return settings.workDuration * 60
    if (pomodoro.phase === 'long-break') return settings.longBreakDuration * 60
    if (pomodoro.phase === 'short-break') return settings.shortBreakDuration * 60
    return settings.workDuration * 60
  }, [pomodoro.phase, settings])

  const progress = pomodoro.phase === 'idle' ? 0 : 1 - pomodoro.timeRemaining / phaseDuration
  const circumference = 2 * Math.PI * 120
  const phaseColor = pomodoro.phase === 'work' ? '#7C6FFF' : '#3ECFB2'
  const phaseLabel = pomodoro.phase === 'work' ? 'Focus' : pomodoro.phase === 'long-break' ? 'Long Break' : pomodoro.phase === 'short-break' ? 'Short Break' : 'Ready'

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8">
      {/* Course selector */}
      {pomodoro.phase === 'idle' && courses.length > 0 && (
        <div className="w-48">
          <Select value={linkedCourse} onValueChange={setLinkedCourse}>
            <SelectTrigger><SelectValue placeholder="Link a course (optional)" /></SelectTrigger>
            <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {/* Circular timer */}
      <div className="relative w-72 h-72">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 256 256">
          <circle cx="128" cy="128" r="120" fill="none" stroke="#1F1F2E" strokeWidth="8" />
          <circle
            cx="128" cy="128" r="120" fill="none" stroke={phaseColor} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-medium uppercase tracking-widest" style={{ color: phaseColor }}>{phaseLabel}</span>
          <span className="text-6xl font-bold text-text-primary tabular-nums mt-1">
            {pomodoro.phase === 'idle' ? formatDuration(settings.workDuration * 60) : formatDuration(pomodoro.timeRemaining)}
          </span>
          {pomodoro.phase !== 'idle' && (
            <span className="text-sm text-text-muted mt-1">Round {pomodoro.currentRound + 1} of {pomodoro.totalRounds}</span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {pomodoro.phase === 'idle' ? (
          <Button size="lg" onClick={() => startPomodoro(linkedCourse || undefined)} className="gap-2 px-8">
            <Play size={18} /> Start Focus
          </Button>
        ) : (
          <>
            <Button variant="outline" size="icon" onClick={() => pomodoro.isRunning ? pausePomodoro() : resumePomodoro()}>
              {pomodoro.isRunning ? <Pause size={18} /> : <Play size={18} />}
            </Button>
            <Button variant="outline" size="icon" onClick={skipPomodoro} title="Skip phase"><SkipForward size={18} /></Button>
            <Button variant="outline" size="icon" onClick={stopPomodoro} title="Stop"><Square size={16} /></Button>
          </>
        )}
      </div>

      {/* Today's count */}
      <div className="text-center">
        <p className="text-3xl font-bold text-text-primary">{todayCount}</p>
        <p className="text-sm text-text-muted">pomodoros completed today</p>
      </div>
    </div>
  )
}
