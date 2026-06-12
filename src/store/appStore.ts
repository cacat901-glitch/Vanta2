import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type ActiveView =
  | 'dashboard'
  | 'notebooks'
  | 'canvas'
  | 'lectures'
  | 'flashcards'
  | 'calendar'
  | 'tasks'
  | 'assignments'
  | 'pdf'
  | 'youtube'
  | 'documents'
  | 'research'
  | 'knowledge-graph'
  | 'second-brain'
  | 'progress'
  | 'settings'
  | 'course'
  | 'learning-timeline'
  | 'exam-prep'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}

export interface OpenTab {
  id: string
  type: 'page' | 'canvas' | 'pdf' | 'youtube'
  title: string
  icon?: string
  courseColor?: string
}

interface AppState {
  // ─── Layout ───────────────────────────────────────────────────────────
  sidebarOpen: boolean
  aiPanelOpen: boolean
  focusMode: boolean
  sidebarWidth: number

  // ─── Navigation ───────────────────────────────────────────────────────
  activeView: ActiveView
  activeCourseId: string | null
  activePageId: string | null
  activeCanvasId: string | null
  activeDocumentId: string | null

  // ─── Tabs ─────────────────────────────────────────────────────────────
  openTabs: OpenTab[]
  activeTabId: string | null

  // ─── Modals / Overlays ────────────────────────────────────────────────
  commandPaletteOpen: boolean
  searchOpen: boolean

  // ─── Toasts ──────────────────────────────────────────────────────────
  toasts: Toast[]

  // ─── App init ─────────────────────────────────────────────────────────
  isInitialized: boolean
  isInitializing: boolean
  initError: string | null

  // ─── Actions ──────────────────────────────────────────────────────────
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setAIPanelOpen: (open: boolean) => void
  toggleAIPanel: () => void
  setFocusMode: (on: boolean) => void
  toggleFocusMode: () => void

  setActiveView: (view: ActiveView, params?: { courseId?: string; pageId?: string; canvasId?: string; documentId?: string }) => void
  setActivePage: (pageId: string | null) => void

  openTab: (tab: OpenTab) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void

  setCommandPaletteOpen: (open: boolean) => void
  setSearchOpen: (open: boolean) => void

  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void

  setInitialized: (ok: boolean, error?: string) => void
}

export const useAppStore = create<AppState>()(
  immer((set) => ({
    // ─── Initial state ────────────────────────────────────────────────
    sidebarOpen: true,
    aiPanelOpen: false,
    focusMode: false,
    sidebarWidth: 240,

    activeView: 'dashboard',
    activeCourseId: null,
    activePageId: null,
    activeCanvasId: null,
    activeDocumentId: null,

    openTabs: [],
    activeTabId: null,

    commandPaletteOpen: false,
    searchOpen: false,

    toasts: [],

    isInitialized: false,
    isInitializing: false,
    initError: null,

    // ─── Layout actions ────────────────────────────────────────────────
    setSidebarOpen: (open) => set((s) => { s.sidebarOpen = open }),
    toggleSidebar: () => set((s) => { s.sidebarOpen = !s.sidebarOpen }),
    setAIPanelOpen: (open) => set((s) => { s.aiPanelOpen = open }),
    toggleAIPanel: () => set((s) => { s.aiPanelOpen = !s.aiPanelOpen }),
    setFocusMode: (on) => set((s) => { s.focusMode = on }),
    toggleFocusMode: () => set((s) => { s.focusMode = !s.focusMode }),

    // ─── Navigation actions ────────────────────────────────────────────
    setActiveView: (view, params) =>
      set((s) => {
        s.activeView = view
        if (params?.courseId !== undefined) s.activeCourseId = params.courseId
        if (params?.pageId !== undefined) s.activePageId = params.pageId
        if (params?.canvasId !== undefined) s.activeCanvasId = params.canvasId
        if (params?.documentId !== undefined) s.activeDocumentId = params.documentId
      }),

    setActivePage: (pageId) => set((s) => { s.activePageId = pageId }),

    // ─── Tab actions ───────────────────────────────────────────────────
    openTab: (tab) =>
      set((s) => {
        const exists = s.openTabs.find((t) => t.id === tab.id)
        if (!exists) {
          s.openTabs.push(tab)
        }
        s.activeTabId = tab.id
      }),

    closeTab: (id) =>
      set((s) => {
        const idx = s.openTabs.findIndex((t) => t.id === id)
        s.openTabs = s.openTabs.filter((t) => t.id !== id)
        if (s.activeTabId === id) {
          // Activate adjacent tab
          const newIdx = Math.min(idx, s.openTabs.length - 1)
          s.activeTabId = s.openTabs[newIdx]?.id ?? null
        }
      }),

    setActiveTab: (id) => set((s) => { s.activeTabId = id }),

    // ─── Overlay actions ───────────────────────────────────────────────
    setCommandPaletteOpen: (open) => set((s) => { s.commandPaletteOpen = open }),
    setSearchOpen: (open) => set((s) => { s.searchOpen = open }),

    // ─── Toast actions ─────────────────────────────────────────────────
    addToast: (toast) =>
      set((s) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        s.toasts.push({ ...toast, id })
        // Keep max 3 toasts visible
        if (s.toasts.length > 3) {
          s.toasts = s.toasts.slice(-3)
        }
      }),

    removeToast: (id) =>
      set((s) => {
        s.toasts = s.toasts.filter((t) => t.id !== id)
      }),

    // ─── Init actions ──────────────────────────────────────────────────
    setInitialized: (ok, error) =>
      set((s) => {
        s.isInitialized = ok
        s.isInitializing = false
        s.initError = error ?? null
      }),
  })),
)

// ─── Convenience hooks ────────────────────────────────────────────────

export function useToast() {
  const addToast = useAppStore((s) => s.addToast)
  const removeToast = useAppStore((s) => s.removeToast)

  return {
    toast: (opts: Omit<Toast, 'id'>) => {
      addToast(opts)
    },
    success: (title: string, description?: string) =>
      addToast({ type: 'success', title, description }),
    error: (title: string, description?: string) =>
      addToast({ type: 'error', title, description }),
    warning: (title: string, description?: string) =>
      addToast({ type: 'warning', title, description }),
    info: (title: string, description?: string) =>
      addToast({ type: 'info', title, description }),
    dismiss: removeToast,
  }
}
