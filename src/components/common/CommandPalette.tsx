import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, BookOpen, Brain, Calendar,
  Settings, BarChart3, Pen, ArrowRight, Clock,
  Plus, Zap, Bot, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotebookStore } from '@/store/notebookStore'
import { useCourseStore } from '@/store/courseStore'
import { useAIStore } from '@/store/aiStore'

interface CommandPaletteProps {
  onClose: () => void
}

interface CommandItem {
  id: string
  type: 'navigation' | 'action' | 'page' | 'course' | 'ai'
  label: string
  description?: string
  icon: LucideIcon
  shortcut?: string
  action: () => void
  color?: string
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const notebooks = useNotebookStore((s) => s.notebooks)
  const searchResults = useNotebookStore((s) => s.searchResults)
  const searchPages = useNotebookStore((s) => s.searchPages)
  const courses = useCourseStore((s) => s.courses)
  const sendMessage = useAIStore((s) => s.sendMessage)
  const isAIConfigured = useAIStore((s) => s.isConfigured)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.length > 1) {
      void searchPages(query)
    }
  }, [query, searchPages])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const nav = (path: string) => { navigate(path); onClose() }

  // Build command list
  const commands: CommandItem[] = []

  if (!query) {
    commands.push(
      { id: 'go-dashboard', type: 'navigation', label: 'Go to Dashboard', icon: LayoutDashboard, shortcut: '', action: () => nav('/dashboard') },
      { id: 'go-notebooks', type: 'navigation', label: 'Go to Notebooks', icon: BookOpen, action: () => nav('/notebooks') },
      { id: 'go-canvas', type: 'navigation', label: 'Go to Canvas', icon: Pen, action: () => nav('/canvas') },
      { id: 'go-flashcards', type: 'navigation', label: 'Go to Flashcards', icon: Brain, action: () => nav('/flashcards') },
      { id: 'go-planner', type: 'navigation', label: 'Go to Planner', icon: Calendar, action: () => nav('/planner') },
      { id: 'go-progress', type: 'navigation', label: 'Go to Progress', icon: BarChart3, action: () => nav('/progress') },
      { id: 'go-settings', type: 'navigation', label: 'Go to Settings', icon: Settings, action: () => nav('/settings') },
    )

    commands.push(
      { id: 'new-page', type: 'action', label: 'New Page', description: 'Create a new notebook page', icon: Plus, shortcut: '⌘N', action: () => { nav('/notebooks'); onClose() } },
      { id: 'new-canvas', type: 'action', label: 'New Canvas', description: 'Open a new infinite canvas', icon: Pen, action: () => nav('/canvas') },
    )

    if (isAIConfigured) {
      commands.push(
        { id: 'ai-summarize', type: 'ai', label: 'AI: Summarize clipboard', icon: Bot, action: () => { void sendMessage('Summarize this:'); nav('/dashboard') } },
        { id: 'ai-explain', type: 'ai', label: 'AI: Explain a concept', icon: Bot, action: () => { void sendMessage('Explain:'); onClose() } },
      )
    }
  } else {
    for (const result of searchResults.slice(0, 5)) {
      commands.push({
        id: `page-${result.pageId}`,
        type: 'page',
        label: result.title,
        description: result.excerpt,
        icon: BookOpen,
        action: () => nav(`/notebooks/${result.pageId}`),
      })
    }

    for (const course of courses.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3)) {
      commands.push({
        id: `course-${course.id}`,
        type: 'course',
        label: course.name,
        description: 'Course',
        icon: BookOpen,
        color: course.color,
        action: () => nav(`/courses/${course.id}`),
      })
    }

    for (const nb of notebooks.filter((n) => n.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3)) {
      commands.push({
        id: `nb-${nb.id}`,
        type: 'navigation',
        label: nb.name,
        description: 'Notebook',
        icon: BookOpen,
        action: () => nav('/notebooks'),
      })
    }

    if (query.startsWith('>') && isAIConfigured) {
      const aiQuery = query.slice(1).trim()
      if (aiQuery) {
        commands.push({
          id: 'ai-direct',
          type: 'ai',
          label: `Ask AI: "${aiQuery}"`,
          icon: Bot,
          action: () => {
            void sendMessage(aiQuery)
            onClose()
          },
        })
      }
    }

    if (commands.length === 0) {
      commands.push({
        id: 'no-results',
        type: 'action',
        label: `Search for "${query}"`,
        description: 'No results found',
        icon: Search,
        action: onClose,
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, commands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      commands[selectedIndex]?.action()
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const typeLabels: Record<CommandItem['type'], string> = {
    navigation: 'Navigate',
    action: 'Action',
    page: 'Page',
    course: 'Course',
    ai: 'AI',
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl">
        <div className="bg-surface-elevated border border-border-default rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle">
            <Search size={16} className="text-text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, navigate, run AI commands (type > for AI)…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-text-muted hover:text-text-secondary text-xs">
                Clear
              </button>
            )}
            <kbd className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded border border-border-subtle">Esc</kbd>
          </div>

          <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
            {commands.map((cmd, idx) => (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); onClose() }}
                className={cn(
                  'flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors',
                  idx === selectedIndex
                    ? 'bg-accent-primary/15 text-text-primary'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary',
                )}
              >
                <div className={cn(
                  'w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0',
                  cmd.type === 'ai' ? 'bg-accent-primary/20 text-accent-primary' : 'bg-surface text-text-muted',
                )}>
                  {cmd.color ? (
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cmd.color }} />
                  ) : (
                    <cmd.icon size={14} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{cmd.label}</span>
                  {cmd.description && (
                    <p className="text-xs text-text-muted truncate mt-0.5">{cmd.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-text-muted">{typeLabels[cmd.type]}</span>
                  {cmd.shortcut && (
                    <kbd className="text-xs text-text-muted bg-surface px-1.5 py-0.5 rounded">{cmd.shortcut}</kbd>
                  )}
                  {idx === selectedIndex && <ArrowRight size={12} className="text-text-muted" />}
                </div>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 px-4 py-2 border-t border-border-subtle text-xs text-text-muted">
            <span className="flex items-center gap-1"><kbd className="bg-surface border border-border-subtle px-1 rounded">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="bg-surface border border-border-subtle px-1 rounded">↵</kbd> Open</span>
            <span className="flex items-center gap-1"><Zap size={10} /><span>Type &gt; for AI</span></span>
            <span className="flex items-center gap-1"><Clock size={10} /> Recent</span>
          </div>
        </div>
      </div>
    </>
  )
}
