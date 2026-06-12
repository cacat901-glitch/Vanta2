import { useEffect, useState } from 'react'
import { Clock, BookOpen, Brain, FileText, CheckSquare, Mic, Award, Zap } from 'lucide-react'
import { getDB } from '@/db'
import { format, isSameDay } from 'date-fns'
import type { ActivityLog, ActivityActionType } from '@/types/activity'

const ICON: Partial<Record<ActivityActionType, typeof Clock>> = {
  note_created: BookOpen, flashcard_review: Brain, pdf_opened: FileText,
  task_completed: CheckSquare, lecture_recorded: Mic, pomodoro_completed: Zap,
  quiz_completed: Award, canvas_created: BookOpen,
}

const LABEL: Partial<Record<ActivityActionType, string>> = {
  note_created: 'Created a note', flashcard_review: 'Reviewed flashcards',
  pdf_opened: 'Studied a PDF', task_completed: 'Completed a task',
  lecture_recorded: 'Recorded a lecture', pomodoro_completed: 'Completed a Pomodoro',
  quiz_completed: 'Took a quiz', writing_session: 'Writing session', canvas_created: 'Created a canvas',
}

export function TimelinePage() {
  const [events, setEvents] = useState<ActivityLog[]>([])

  useEffect(() => {
    void (async () => {
      const db = await getDB()
      const from = new Date(); from.setDate(from.getDate() - 60)
      setEvents((await db.activity.getActivityByDateRange(from, new Date())).reverse())
    })()
  }, [])

  // Group by day
  const days: { date: Date; items: ActivityLog[] }[] = []
  for (const e of events) {
    const last = days[days.length - 1]
    if (last && isSameDay(last.date, e.loggedAt)) last.items.push(e)
    else days.push({ date: e.loggedAt, items: [e] })
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="flex items-center gap-2 text-xl font-bold text-text-primary mb-6"><Clock size={20} className="text-accent-primary" /> Learning Timeline</h1>

      {days.length === 0 ? (
        <div className="text-center py-16 text-text-muted text-sm">Your learning journey will appear here as you study.</div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day.date.toISOString()}>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 sticky top-0 bg-app-bg py-1">{format(day.date, 'EEEE, MMMM d')}</p>
              <div className="space-y-2 border-l-2 border-border-subtle pl-4 ml-1">
                {day.items.map((e) => {
                  const Icon = ICON[e.actionType] ?? Clock
                  return (
                    <div key={e.id} className="relative flex items-center gap-3">
                      <div className="absolute -left-[1.42rem] w-6 h-6 rounded-full bg-surface border border-border-default flex items-center justify-center">
                        <Icon size={12} className="text-accent-primary" />
                      </div>
                      <div className="flex-1 flex items-center justify-between py-1">
                        <span className="text-sm text-text-secondary">{LABEL[e.actionType] ?? e.actionType.replace(/_/g, ' ')}</span>
                        <span className="text-xs text-text-muted">{format(e.loggedAt, 'HH:mm')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
