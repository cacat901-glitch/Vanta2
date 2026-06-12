import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isToday, isSameDay, addMonths, subMonths,
} from 'date-fns'
import { usePlannerStore } from '@/store/plannerStore'
import { useCourseStore } from '@/store/courseStore'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

export function CalendarView() {
  const [month, setMonth] = useState(new Date())
  const events = usePlannerStore((s) => s.events)
  const tasks = usePlannerStore((s) => s.tasks)
  const loadEvents = usePlannerStore((s) => s.loadEvents)
  const createEvent = usePlannerStore((s) => s.createEvent)
  const courses = useCourseStore((s) => s.courses)

  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  useEffect(() => { void loadEvents(gridStart, gridEnd) }, [month, loadEvents, gridStart, gridEnd])

  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd])

  const itemsForDay = (day: Date) => {
    const evs = events.filter((e) => isSameDay(e.startAt, day)).map((e) => ({ id: e.id, title: e.title, color: e.color ?? courses.find((c) => c.id === e.courseId)?.color ?? '#7C6FFF', type: 'event' as const }))
    const tks = tasks.filter((t) => t.status !== 'done' && t.dueAt && isSameDay(t.dueAt, day)).map((t) => ({ id: t.id, title: t.title, color: courses.find((c) => c.id === t.courseId)?.color ?? '#8A8AA8', type: 'task' as const }))
    return [...evs, ...tks]
  }

  const addEvent = async (day: Date) => {
    const title = prompt('Event title:')
    if (!title) return
    const start = new Date(day); start.setHours(9, 0, 0, 0)
    const end = new Date(day); end.setHours(10, 0, 0, 0)
    await createEvent({ title, type: 'personal', courseId: null, startAt: start, endAt: end, recurrence: 'none', recurrenceRule: null, notes: null, color: '#7C6FFF', location: null })
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-text-primary">{format(month, 'MMMM yyyy')}</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft size={16} /></Button>
          <Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>Today</Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={16} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden border border-border-subtle bg-border-subtle">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="bg-sidebar-bg px-2 py-1.5 text-xs font-medium text-text-muted text-center">{d}</div>
        ))}
        {days.map((day) => {
          const items = itemsForDay(day)
          return (
            <div key={day.toISOString()}
              className={cn('group bg-surface min-h-[90px] p-1.5 relative', !isSameMonth(day, month) && 'opacity-40')}>
              <div className="flex items-center justify-between">
                <span className={cn('text-xs w-6 h-6 flex items-center justify-center rounded-full',
                  isToday(day) ? 'bg-accent-primary text-white font-medium' : 'text-text-secondary')}>
                  {format(day, 'd')}
                </span>
                <button onClick={() => addEvent(day)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-accent-primary transition-all">
                  <Plus size={12} />
                </button>
              </div>
              <div className="mt-1 space-y-0.5">
                {items.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-center gap-1 text-2xs truncate rounded px-1 py-0.5"
                    style={{ backgroundColor: `${item.color}22`, color: item.color }}>
                    <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate">{item.title}</span>
                  </div>
                ))}
                {items.length > 3 && <span className="text-2xs text-text-muted px-1">+{items.length - 3} more</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
