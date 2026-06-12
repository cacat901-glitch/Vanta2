import { useState, useEffect } from 'react'
import { Calendar as CalIcon, CheckSquare, FileText, GraduationCap, Timer } from 'lucide-react'
import { usePlannerStore } from '@/store/plannerStore'
import { useCourseStore } from '@/store/courseStore'
import { CalendarView } from './CalendarView'
import { TasksView } from './TasksView'
import { AssignmentsView } from './AssignmentsView'
import { PomodoroView } from './PomodoroView'
import { cn } from '@/lib/utils'

type PlannerTab = 'calendar' | 'tasks' | 'assignments' | 'pomodoro'

const TABS: { id: PlannerTab; label: string; icon: typeof CalIcon }[] = [
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: CalIcon },
  { id: 'assignments', label: 'Assignments & Exams', icon: GraduationCap },
  { id: 'pomodoro', label: 'Pomodoro', icon: Timer },
]

export function PlannerPage() {
  const [tab, setTab] = useState<PlannerTab>('tasks')
  const loadTasks = usePlannerStore((s) => s.loadTasks)
  const loadAssignments = usePlannerStore((s) => s.loadAssignments)
  const loadExams = usePlannerStore((s) => s.loadExams)
  const loadCourses = useCourseStore((s) => s.load)

  useEffect(() => {
    void loadTasks(); void loadAssignments(); void loadExams(); void loadCourses()
  }, [loadTasks, loadAssignments, loadExams, loadCourses])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border-subtle">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t.id ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-secondary hover:bg-surface hover:text-text-primary')}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'tasks' && <TasksView />}
        {tab === 'calendar' && <CalendarView />}
        {tab === 'assignments' && <AssignmentsView />}
        {tab === 'pomodoro' && <PomodoroView />}
      </div>
    </div>
  )
}

// Re-export icon for sub-views
export { FileText }
