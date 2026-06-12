import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { useAppStore } from '@/store/appStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useCourseStore } from '@/store/courseStore'
import { useNotebookStore } from '@/store/notebookStore'
import { useFlashcardStore } from '@/store/flashcardStore'
import { usePlannerStore } from '@/store/plannerStore'
import { useAIStore } from '@/store/aiStore'
import { initDB } from '@/db'
import { InitScreen } from '@/components/common/InitScreen'

// Lazy-loaded feature pages
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { NotebooksPage } from '@/features/notebooks/NotebooksPage'
import { FlashcardsPage } from '@/features/flashcards/FlashcardsPage'
import { PlannerPage } from '@/features/planner/PlannerPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { CoursesPage } from '@/features/courses/CoursesPage'
import { ProgressPage } from '@/features/progress/ProgressPage'
import { CanvasPage } from '@/features/canvas/CanvasPage'
import { PDFsPage } from '@/features/pdf/PDFsPage'
import { MediaPage } from '@/features/media/MediaPage'

export default function App() {
  const { isInitialized, isInitializing, initError, setInitialized } = useAppStore()
  const loadSettings = useSettingsStore((s) => s.load)
  const loadCourses = useCourseStore((s) => s.load)
  const initNotebooks = useNotebookStore((s) => s.initialize)
  const loadDecks = useFlashcardStore((s) => s.loadDecks)
  const loadTasks = usePlannerStore((s) => s.loadTasks)
  const syncProvider = useAIStore((s) => s.syncProvider)

  useEffect(() => {
    async function boot() {
      if (isInitialized || isInitializing) return

      useAppStore.setState({ isInitializing: true })

      try {
        // Init DB (runs migrations)
        await initDB()

        // Load all stores in parallel
        await Promise.all([
          loadSettings(),
          loadCourses(),
          initNotebooks(),
          loadDecks(),
          loadTasks(),
        ])

        syncProvider()
        setInitialized(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to initialize StudyOS'
        console.error('Boot error:', err)
        setInitialized(false, message)
      }
    }
    void boot()
  }, [isInitialized, isInitializing, loadSettings, loadCourses, initNotebooks, loadDecks, loadTasks, syncProvider, setInitialized])

  if (!isInitialized) {
    return <InitScreen error={initError} isLoading={isInitializing || (!isInitialized && !initError)} />
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/notebooks" element={<NotebooksPage />} />
        <Route path="/notebooks/:pageId" element={<NotebooksPage />} />
        <Route path="/canvas" element={<CanvasPage />} />
        <Route path="/canvas/:canvasId" element={<CanvasPage />} />
        <Route path="/flashcards" element={<FlashcardsPage />} />
        <Route path="/flashcards/:deckId" element={<FlashcardsPage />} />
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/pdf" element={<PDFsPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CoursesPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  )
}
