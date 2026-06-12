import { useEffect, type ReactNode } from 'react'
import { useAppStore } from '@/store/appStore'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AIPanel } from './AIPanel'
import { CommandPalette } from '../common/CommandPalette'
import { ToastContainer } from '../common/ToastContainer'
import { cn } from '@/lib/utils'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const aiPanelOpen = useAppStore((s) => s.aiPanelOpen)
  const focusMode = useAppStore((s) => s.focusMode)
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const toggleAIPanel = useAppStore((s) => s.toggleAIPanel)
  const toggleFocusMode = useAppStore((s) => s.toggleFocusMode)

  // Global keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey

      // Cmd+K — command palette
      if (mod && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(true)
        return
      }

      // Cmd+/ — toggle AI panel
      if (mod && e.key === '/') {
        e.preventDefault()
        toggleAIPanel()
        return
      }

      // Cmd+Shift+F — focus mode
      if (mod && e.shiftKey && e.key === 'F') {
        e.preventDefault()
        toggleFocusMode()
        return
      }

      // Cmd+Shift+L — toggle sidebar
      if (mod && e.shiftKey && e.key === 'L') {
        e.preventDefault()
        toggleSidebar()
        return
      }

      // Escape — close command palette
      if (e.key === 'Escape' && commandPaletteOpen) {
        e.preventDefault()
        setCommandPaletteOpen(false)
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [commandPaletteOpen, setCommandPaletteOpen, toggleAIPanel, toggleFocusMode, toggleSidebar])

  return (
    <div
      className={cn(
        'flex h-screen w-screen overflow-hidden bg-app-bg text-text-primary',
        focusMode && 'focus-mode-active',
      )}
    >
      {/* Left Sidebar */}
      {!focusMode && (
        <Sidebar
          open={sidebarOpen}
          className="sidebar flex-shrink-0 transition-all duration-200"
        />
      )}

      {/* Main column: topbar + content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Bar */}
        {!focusMode && <TopBar className="topbar flex-shrink-0" />}

        {/* Content area */}
        <main className="flex-1 overflow-hidden relative">
          <div className="h-full overflow-y-auto scroll-smooth">
            {children}
          </div>
        </main>
      </div>

      {/* Right AI Panel */}
      {!focusMode && aiPanelOpen && (
        <AIPanel className="ai-panel flex-shrink-0" />
      )}

      {/* Global overlays */}
      {commandPaletteOpen && (
        <CommandPalette onClose={() => setCommandPaletteOpen(false)} />
      )}
      <ToastContainer />
    </div>
  )
}
