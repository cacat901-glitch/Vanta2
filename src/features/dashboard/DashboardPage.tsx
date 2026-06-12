import { useEffect } from 'react'
import {
  Flame, Brain, CheckSquare, Clock, TrendingUp,
  BookOpen, Target, Award, Zap, ArrowRight, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFlashcardStore } from '@/store/flashcardStore'
import { usePlannerStore } from '@/store/plannerStore'
import { useCourseStore } from '@/store/courseStore'
import { useNavigate } from 'react-router-dom'

export function DashboardPage() {
  const navigate = useNavigate()
  const dueCount = useFlashcardStore((s) => s.dueCountAll)
  const tasks = usePlannerStore((s) => s.tasks)
  const courses = useCourseStore((s) => s.courses)
  const loadTasks = usePlannerStore((s) => s.loadTasks)

  useEffect(() => { void loadTasks() }, [loadTasks])

  const todayTasks = tasks.filter((t) => {
    if (t.status === 'done') return false
    if (!t.dueAt) return false
    return t.dueAt.toDateString() === new Date().toDateString()
  })

  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'done') return false
    if (!t.dueAt) return false
    return t.dueAt < new Date()
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Good morning 👋</h1>
        <p className="text-sm text-text-muted mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Brain} label="Due for review" value={dueCount} color="text-accent-primary" bgColor="bg-accent-primary/10" onClick={() => navigate('/flashcards')} cta="Review now →" />
        <StatCard icon={CheckSquare} label="Tasks today" value={todayTasks.length} color="text-accent-secondary" bgColor="bg-accent-secondary/10" onClick={() => navigate('/planner')} badge={overdueTasks.length > 0 ? `${overdueTasks.length} overdue` : undefined} />
        <StatCard icon={BookOpen} label="Active courses" value={courses.length} color="text-info" bgColor="bg-info/10" onClick={() => navigate('/courses')} />
        <StatCard icon={Flame} label="Day streak" value={0} color="text-warning" bgColor="bg-warning/10" onClick={() => navigate('/progress')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <SectionCard title="Today's Tasks" icon={CheckSquare} onSeeAll={() => navigate('/planner')}>
            {todayTasks.length === 0 ? (
              <EmptyState icon={CheckSquare} message="No tasks due today" cta="Add a task" onCta={() => navigate('/planner')} />
            ) : (
              <div className="space-y-2">
                {todayTasks.slice(0, 5).map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-surface/50 hover:bg-surface transition-colors">
                    <div className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      task.priority === 'P1' ? 'bg-danger' :
                      task.priority === 'P2' ? 'bg-warning' :
                      task.priority === 'P3' ? 'bg-info' : 'bg-text-muted',
                    )} />
                    <span className="text-sm text-text-primary truncate flex-1">{task.title}</span>
                    {task.dueAt && (
                      <span className="text-xs text-text-muted flex-shrink-0">
                        {task.dueAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {dueCount > 0 && (
            <div
              className="flex items-center gap-4 p-4 rounded-xl bg-accent-primary/10 border border-accent-primary/20 cursor-pointer hover:bg-accent-primary/15 transition-colors"
              onClick={() => navigate('/flashcards')}
            >
              <div className="w-10 h-10 rounded-xl bg-accent-primary/20 flex items-center justify-center flex-shrink-0">
                <Brain size={20} className="text-accent-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-text-primary">
                  {dueCount} flashcard{dueCount !== 1 ? 's' : ''} ready for review
                </p>
                <p className="text-xs text-text-muted mt-0.5">Review now to maintain your retention</p>
              </div>
              <ArrowRight size={16} className="text-accent-primary flex-shrink-0" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <SectionCard title="Your Courses" icon={BookOpen} onSeeAll={() => navigate('/courses')}>
            {courses.length === 0 ? (
              <EmptyState icon={BookOpen} message="No courses yet" cta="Add a course" onCta={() => navigate('/courses')} />
            ) : (
              <div className="space-y-2">
                {courses.slice(0, 4).map((course) => (
                  <button
                    key={course.id}
                    onClick={() => navigate(`/courses/${course.id}`)}
                    className="flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface transition-colors"
                  >
                    <span className="text-base">{course.icon}</span>
                    <span className="text-sm text-text-primary truncate">{course.name}</span>
                    <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: course.color }} />
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Quick Actions" icon={Zap}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'New Note', icon: BookOpen, path: '/notebooks' },
                { label: 'New Canvas', icon: Target, path: '/canvas' },
                { label: 'Start Study', icon: Clock, path: '/planner' },
                { label: 'View Progress', icon: TrendingUp, path: '/progress' },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surface hover:bg-surface-elevated border border-border-subtle hover:border-border-default transition-colors"
                >
                  <action.icon size={18} className="text-accent-primary" />
                  <span className="text-xs text-text-secondary">{action.label}</span>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Recent Activity" icon={Award}>
        <div className="space-y-2 py-1">
          <div className="flex items-center gap-3 py-2 text-sm text-text-muted">
            <div className="w-2 h-2 rounded-full bg-border-default" />
            <div>
              <p className="text-text-secondary">No activity logged yet</p>
              <p className="text-xs">Start studying to see your activity here</p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, color, bgColor, onClick, cta, badge,
}: {
  icon: LucideIcon
  label: string
  value: number
  color: string
  bgColor: string
  onClick?: () => void
  cta?: string
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-2 p-4 rounded-xl bg-surface border border-border-subtle hover:border-border-default transition-colors text-left group"
    >
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', bgColor)}>
        <Icon size={18} className={color} />
      </div>
      <div>
        <p className="text-2xl font-bold text-text-primary">{value}</p>
        <p className="text-xs text-text-muted">{label}</p>
      </div>
      {badge && <span className="text-xs text-danger font-medium">{badge}</span>}
      {cta && <span className={cn('text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity', color)}>{cta}</span>}
    </button>
  )
}

function SectionCard({
  title, icon: Icon, children, onSeeAll,
}: {
  title: string
  icon: LucideIcon
  children: React.ReactNode
  onSeeAll?: () => void
}) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Icon size={15} className="text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} className="text-xs text-accent-primary hover:underline">See all</button>
        )}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function EmptyState({
  icon: Icon, message, cta, onCta,
}: {
  icon: LucideIcon
  message: string
  cta?: string
  onCta?: () => void
}) {
  return (
    <div className="py-6 flex flex-col items-center gap-2 text-center">
      <Icon size={24} className="text-text-muted" />
      <p className="text-sm text-text-muted">{message}</p>
      {cta && (
        <button onClick={onCta} className="text-xs text-accent-primary hover:underline mt-1">{cta} →</button>
      )}
    </div>
  )
}
