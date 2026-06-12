import { useState, useMemo } from 'react'
import { Plus, Circle, CheckCircle2, Trash2, Flag, Calendar } from 'lucide-react'
import { isToday, isPast, isThisWeek, format } from 'date-fns'
import { usePlannerStore } from '@/store/plannerStore'
import { useCourseStore } from '@/store/courseStore'
import { Checkbox } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Task, TaskPriority } from '@/types/planner'

type Filter = 'today' | 'upcoming' | 'all' | 'completed'

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  P1: 'text-danger', P2: 'text-warning', P3: 'text-info', P4: 'text-text-muted',
}

export function TasksView() {
  const tasks = usePlannerStore((s) => s.tasks)
  const createTask = usePlannerStore((s) => s.createTask)
  const completeTask = usePlannerStore((s) => s.completeTask)
  const updateTask = usePlannerStore((s) => s.updateTask)
  const deleteTask = usePlannerStore((s) => s.deleteTask)
  const courses = useCourseStore((s) => s.courses)

  const [filter, setFilter] = useState<Filter>('today')
  const [quickAdd, setQuickAdd] = useState('')

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'completed') return t.status === 'done'
      if (t.status === 'done') return false
      if (filter === 'all') return true
      if (filter === 'today') return t.dueAt && (isToday(t.dueAt) || isPast(t.dueAt))
      if (filter === 'upcoming') return t.dueAt && isThisWeek(t.dueAt, { weekStartsOn: 1 })
      return true
    }).sort((a, b) => {
      const pa = a.priority.charCodeAt(1), pb = b.priority.charCodeAt(1)
      if (pa !== pb) return pa - pb
      return (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity)
    })
  }, [tasks, filter])

  const counts = useMemo(() => ({
    today: tasks.filter((t) => t.status !== 'done' && t.dueAt && (isToday(t.dueAt) || isPast(t.dueAt))).length,
    upcoming: tasks.filter((t) => t.status !== 'done' && t.dueAt && isThisWeek(t.dueAt, { weekStartsOn: 1 })).length,
    all: tasks.filter((t) => t.status !== 'done').length,
    completed: tasks.filter((t) => t.status === 'done').length,
  }), [tasks])

  const handleQuickAdd = async () => {
    if (!quickAdd.trim()) return
    await createTask({ title: quickAdd.trim(), dueAt: filter === 'today' ? new Date() : null, priority: 'P3' })
    setQuickAdd('')
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-text-primary mb-4">Tasks</h1>

      {/* Filters */}
      <div className="flex gap-1 mb-4">
        {(['today', 'upcoming', 'all', 'completed'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm capitalize transition-colors',
              filter === f ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-secondary hover:bg-surface')}>
            {f}
            <span className="text-xs opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* Quick add */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border border-border-default bg-surface focus-within:border-accent-primary/60">
        <Plus size={16} className="text-text-muted" />
        <input
          value={quickAdd}
          onChange={(e) => setQuickAdd(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleQuickAdd() }}
          placeholder="Add a task and press Enter…"
          className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">
          {filter === 'completed' ? 'No completed tasks yet.' : 'No tasks here. Add one above!'}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((task) => (
            <TaskRow key={task.id} task={task}
              courseName={courses.find((c) => c.id === task.courseId)?.name}
              courseColor={courses.find((c) => c.id === task.courseId)?.color}
              onComplete={() => completeTask(task.id)}
              onDelete={() => deleteTask(task.id)}
              onCyclePriority={() => {
                const order: TaskPriority[] = ['P1', 'P2', 'P3', 'P4']
                const next = order[(order.indexOf(task.priority) + 1) % 4]!
                void updateTask(task.id, { priority: next })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, courseName, courseColor, onComplete, onDelete, onCyclePriority }: {
  task: Task; courseName?: string; courseColor?: string
  onComplete: () => void; onDelete: () => void; onCyclePriority: () => void
}) {
  const done = task.status === 'done'
  const overdue = task.dueAt && isPast(task.dueAt) && !isToday(task.dueAt) && !done
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface transition-colors">
      <Checkbox checked={done} onCheckedChange={() => onComplete()} />
      <button onClick={onCyclePriority} title={`Priority ${task.priority}`}>
        <Flag size={13} className={PRIORITY_COLOR[task.priority]} fill="currentColor" />
      </button>
      <span className={cn('flex-1 text-sm truncate', done ? 'line-through text-text-muted' : 'text-text-primary')}>
        {task.title}
      </span>
      {courseName && (
        <span className="flex items-center gap-1 text-xs text-text-muted">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: courseColor }} />
          {courseName}
        </span>
      )}
      {task.dueAt && (
        <span className={cn('flex items-center gap-1 text-xs', overdue ? 'text-danger' : 'text-text-muted')}>
          <Calendar size={11} /> {format(task.dueAt, 'MMM d')}
        </span>
      )}
      <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all">
        <Trash2 size={13} />
      </button>
    </div>
  )
}

void Circle; void CheckCircle2
