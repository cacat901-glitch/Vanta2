import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, Pen, Brain, Calendar, Settings,
  ChevronRight, ChevronDown, Star,
  FlameIcon, Trophy, BarChart3, BookCopy, GraduationCap,
  Plus, Flame, FileText, Film, Mic, Network, Sparkles, FlaskConical, Speech, Clock, AudioLines, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotebookStore } from '@/store/notebookStore'
import { useCourseStore } from '@/store/courseStore'
import { useFlashcardStore } from '@/store/flashcardStore'
import { truncate } from '@/lib/utils'
import type { Course } from '@/types'

interface SidebarProps {
  open: boolean
  className?: string
}

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: BookOpen, label: 'Notebooks', path: '/notebooks' },
  { icon: Pen, label: 'Canvas', path: '/canvas' },
  { icon: Brain, label: 'Flashcards', path: '/flashcards' },
  { icon: Calendar, label: 'Planner', path: '/planner' },
  { icon: FileText, label: 'PDFs', path: '/pdf' },
  { icon: Film, label: 'Media', path: '/media' },
  { icon: Mic, label: 'Lectures', path: '/lectures' },
  { icon: GraduationCap, label: 'AI Tutor', path: '/tutor' },
  { icon: Speech, label: 'Oral Exam', path: '/oral-exam' },
  { icon: Network, label: 'Knowledge Graph', path: '/graph' },
  { icon: Sparkles, label: 'Second Brain', path: '/second-brain' },
  { icon: FlaskConical, label: 'Research', path: '/research' },
  { icon: Clock, label: 'Timeline', path: '/timeline' },
  { icon: AudioLines, label: 'Voice', path: '/voice' },
  { icon: BarChart3, label: 'Progress', path: '/progress' },
]

export function Sidebar({ open, className }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [notebooksExpanded, setNotebooksExpanded] = useState(true)
  const [coursesExpanded, setCoursesExpanded] = useState(true)
  const [favoritesExpanded, setFavoritesExpanded] = useState(true)

  const notebooks = useNotebookStore((s) => s.notebooks)
  const favoritePages = useNotebookStore((s) => s.favoritePages)
  const courses = useCourseStore((s) => s.courses)
  const dueCount = useFlashcardStore((s) => s.dueCountAll)
  const createNotebook = useNotebookStore((s) => s.createNotebook)
  const createCourse = useCourseStore((s) => s.create)

  const isActive = (path: string) => location.pathname.startsWith(path)

  if (!open) {
    return (
      <div className={cn('flex flex-col items-center py-3 gap-1 bg-sidebar-bg border-r border-border-subtle', 'w-12', className)}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            title={item.label}
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-100',
              isActive(item.path)
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface',
            )}
          >
            <item.icon size={18} />
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => navigate('/settings')}
          title="Settings"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-text-muted hover:text-text-secondary hover:bg-surface transition-colors"
        >
          <Settings size={18} />
        </button>
      </div>
    )
  }

  return (
    <aside className={cn('flex flex-col bg-sidebar-bg border-r border-border-subtle overflow-hidden', 'w-60', className)}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-12 border-b border-border-subtle flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-accent-primary flex items-center justify-center flex-shrink-0">
          <GraduationCap size={16} className="text-white" />
        </div>
        <span className="font-semibold text-base text-text-primary tracking-tight">StudyOS</span>
        {dueCount > 0 && (
          <span className="ml-auto text-xs bg-accent-primary/20 text-accent-primary px-1.5 py-0.5 rounded-full font-medium">
            {dueCount}
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 no-scrollbar">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem
            key={item.path}
            icon={item.icon}
            label={item.label}
            active={isActive(item.path)}
            onClick={() => navigate(item.path)}
            badge={item.path === '/flashcards' && dueCount > 0 ? dueCount : undefined}
          />
        ))}

        <div className="mx-3 my-2 border-t border-border-subtle" />

        {favoritePages.length > 0 && (
          <SidebarSection
            icon={Star}
            label="Favorites"
            expanded={favoritesExpanded}
            onToggle={() => setFavoritesExpanded(!favoritesExpanded)}
          >
            {favoritePages.slice(0, 8).map((page) => (
              <SidebarLeaf
                key={page.id}
                icon={page.icon ?? '📄'}
                label={truncate(page.title, 28)}
                onClick={() => navigate(`/notebooks/${page.id}`)}
                active={location.pathname === `/notebooks/${page.id}`}
              />
            ))}
          </SidebarSection>
        )}

        <SidebarSection
          icon={BookCopy}
          label="Courses"
          expanded={coursesExpanded}
          onToggle={() => setCoursesExpanded(!coursesExpanded)}
          onAdd={async () => {
            await createCourse({
              name: 'New Course', icon: '📚', color: '#7C6FFF',
              semester: null, professor: null, courseCode: null,
              schedule: [], room: null, zoomLink: null,
              syllabusDocumentId: null, isActive: true,
            })
          }}
        >
          {courses.map((course) => (
            <CourseItem
              key={course.id}
              course={course}
              active={location.pathname === `/courses/${course.id}`}
              onClick={() => navigate(`/courses/${course.id}`)}
            />
          ))}
          {courses.length === 0 && (
            <p className="px-6 py-1.5 text-xs text-text-muted">No courses yet</p>
          )}
        </SidebarSection>

        <SidebarSection
          icon={BookOpen}
          label="Notebooks"
          expanded={notebooksExpanded}
          onToggle={() => setNotebooksExpanded(!notebooksExpanded)}
          onAdd={async () => { await createNotebook('New Notebook') }}
        >
          {notebooks.map((nb) => (
            <NotebookItem
              key={nb.id}
              notebookId={nb.id}
              label={nb.name}
              icon={nb.icon}
              color={nb.color}
              active={false}
              onClick={() => navigate('/notebooks')}
            />
          ))}
          {notebooks.length === 0 && (
            <p className="px-6 py-1.5 text-xs text-text-muted">No notebooks yet</p>
          )}
        </SidebarSection>
      </nav>

      <div className="flex-shrink-0 border-t border-border-subtle">
        <SidebarNavItem
          icon={Settings}
          label="Settings"
          active={isActive('/settings')}
          onClick={() => navigate('/settings')}
        />
        <StreakBadge />
      </div>
    </aside>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarNavItem({
  icon: Icon, label, active, onClick, badge,
}: {
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 w-full px-3 py-1.5 text-sm rounded-none transition-colors duration-100 group',
        active
          ? 'bg-accent-primary/12 text-accent-primary font-medium border-r-2 border-accent-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface/60',
      )}
    >
      <Icon size={16} className={cn('flex-shrink-0', active ? 'text-accent-primary' : 'text-text-muted group-hover:text-text-secondary')} />
      <span className="truncate">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto text-xs bg-accent-primary text-white px-1.5 py-0.5 rounded-full font-medium min-w-5 text-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function SidebarSection({
  icon: Icon, label, expanded, onToggle, onAdd, children,
}: {
  icon: LucideIcon
  label: string
  expanded: boolean
  onToggle: () => void
  onAdd?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1 px-2 py-0.5 group">
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 flex-1 py-0.5 text-xs font-medium text-text-muted uppercase tracking-wider hover:text-text-secondary transition-colors"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          <Icon size={12} />
          <span>{label}</span>
        </button>
        {onAdd && (
          <button
            onClick={onAdd}
            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface rounded transition-all"
            title={`New ${label.slice(0, -1)}`}
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      {expanded && <div className="mt-0.5">{children}</div>}
    </div>
  )
}

function SidebarLeaf({ icon, label, active, onClick }: {
  icon: string; label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-5 py-1 text-sm transition-colors duration-100',
        active ? 'text-accent-primary bg-accent-primary/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface/60',
      )}
    >
      <span className="text-sm">{icon}</span>
      <span className="truncate text-xs">{label}</span>
    </button>
  )
}

function CourseItem({ course, active, onClick }: { course: Course; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 w-full px-4 py-1.5 text-sm transition-colors duration-100',
        active ? 'text-text-primary bg-surface/80' : 'text-text-secondary hover:text-text-primary hover:bg-surface/60',
      )}
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: course.color }} />
      <span className="text-sm mr-1">{course.icon}</span>
      <span className="truncate text-xs">{course.name}</span>
    </button>
  )
}

function NotebookItem({
  label, icon, color, active, onClick,
}: {
  notebookId: string; label: string; icon: string | null; color: string | null; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 w-full px-5 py-1 text-sm transition-colors duration-100',
        active ? 'text-text-primary bg-surface/80' : 'text-text-secondary hover:text-text-primary hover:bg-surface/60',
      )}
    >
      <span className="text-sm">{icon ?? '📓'}</span>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color ?? '#7C6FFF' }} />
      <span className="truncate text-xs">{label}</span>
    </button>
  )
}

function StreakBadge() {
  const streak = 0
  if (streak === 0) return null
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-warning">
      <Flame size={14} className="text-orange-400 animate-streak-flame" />
      <span className="font-medium">{streak} day streak</span>
      <FlameIcon size={14} className="text-orange-400 opacity-50" />
      <Trophy size={12} className="ml-auto text-text-muted" />
    </div>
  )
}
