import { useNavigate, useLocation } from 'react-router-dom'
import { Search, Bot, Bell, Settings, PanelLeftClose, PanelLeft, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'
import { useAIStore } from '@/store/aiStore'
import { usePlannerStore } from '@/store/plannerStore'
import { formatDuration } from '@/lib/utils'

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/notebooks': 'Notebooks',
  '/canvas': 'Canvas',
  '/flashcards': 'Flashcards',
  '/planner': 'Planner',
  '/courses': 'Courses',
  '/progress': 'Progress',
  '/settings': 'Settings',
}

interface TopBarProps {
  className?: string
}

export function TopBar({ className }: TopBarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const aiPanelOpen = useAppStore((s) => s.aiPanelOpen)
  const toggleAIPanel = useAppStore((s) => s.toggleAIPanel)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const isAIConfigured = useAIStore((s) => s.isConfigured)
  const pomodoro = usePlannerStore((s) => s.pomodoro)

  // Build breadcrumb from current route
  const pathKey = Object.keys(ROUTE_LABELS).find((k) => location.pathname.startsWith(k)) ?? '/dashboard'
  const currentLabel = ROUTE_LABELS[pathKey] ?? 'StudyOS'

  return (
    <header
      className={cn(
        'h-12 flex items-center gap-2 px-3 border-b border-border-subtle bg-app-bg/95 backdrop-blur-sm z-10',
        className,
      )}
    >
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors flex-shrink-0"
        title={sidebarOpen ? 'Collapse sidebar (⌘⇧L)' : 'Expand sidebar (⌘⇧L)'}
      >
        {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-text-primary">{currentLabel}</span>
      </div>

      {/* Pomodoro timer (if running) */}
      {pomodoro.phase !== 'idle' && (
        <PomodoroChip />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Global search */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-2 px-3 h-8 rounded-lg bg-surface border border-border-subtle text-text-muted hover:text-text-secondary hover:border-border-default text-sm transition-colors"
        title="Search everything (⌘K)"
      >
        <Search size={14} />
        <span className="hidden sm:inline text-xs">Search everything</span>
        <kbd className="hidden sm:inline text-xs bg-surface-elevated px-1.5 py-0.5 rounded border border-border-subtle ml-1">⌘K</kbd>
      </button>

      {/* AI Panel toggle */}
      <button
        onClick={toggleAIPanel}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded-md transition-colors relative',
          aiPanelOpen
            ? 'bg-accent-primary/20 text-accent-primary'
            : 'text-text-muted hover:text-text-primary hover:bg-surface',
        )}
        title="Toggle AI Assistant (⌘/)"
      >
        <Bot size={16} />
        {!isAIConfigured && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-warning rounded-full" />
        )}
      </button>

      {/* Notifications */}
      <button
        className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors relative"
        title="Notifications"
      >
        <Bell size={16} />
      </button>

      {/* Settings shortcut */}
      <button
        onClick={() => navigate('/settings')}
        className={cn(
          'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
          location.pathname === '/settings'
            ? 'text-accent-primary'
            : 'text-text-muted hover:text-text-primary hover:bg-surface',
        )}
        title="Settings"
      >
        <Settings size={16} />
      </button>
    </header>
  )
}

function PomodoroChip() {
  const pomodoro = usePlannerStore((s) => s.pomodoro)
  const pausePomodoro = usePlannerStore((s) => s.pausePomodoro)
  const resumePomodoro = usePlannerStore((s) => s.resumePomodoro)
  const stopPomodoro = usePlannerStore((s) => s.stopPomodoro)

  const phaseColors = {
    work: 'text-accent-primary bg-accent-primary/10 border-accent-primary/30',
    'short-break': 'text-accent-secondary bg-accent-secondary/10 border-accent-secondary/30',
    'long-break': 'text-accent-secondary bg-accent-secondary/10 border-accent-secondary/30',
    idle: '',
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-2.5 h-7 rounded-lg border text-xs font-medium font-mono',
        phaseColors[pomodoro.phase],
      )}
    >
      <Zap size={12} />
      <span>{formatDuration(pomodoro.timeRemaining)}</span>
      <span className="text-xs opacity-60">
        {pomodoro.phase === 'work' ? 'Focus' : 'Break'}
      </span>
      <div className="flex gap-0.5 ml-1">
        <button
          onClick={pomodoro.isRunning ? pausePomodoro : resumePomodoro}
          className="hover:opacity-80 transition-opacity"
          title={pomodoro.isRunning ? 'Pause' : 'Resume'}
        >
          {pomodoro.isRunning ? '⏸' : '▶️'}
        </button>
        <button
          onClick={stopPomodoro}
          className="hover:opacity-80 transition-opacity"
          title="Stop"
        >
          ⏹
        </button>
      </div>
    </div>
  )
}
