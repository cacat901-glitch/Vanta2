import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Workspace, Notebook, Section, Page, PageVersion } from '@/types'
import { getDB } from '@/db'

interface NotebookState {
  workspaces: Workspace[]
  notebooks: Notebook[]
  sections: Record<string, Section[]>   // notebookId -> sections
  pages: Record<string, Page[]>         // sectionId -> pages
  currentWorkspaceId: string | null
  currentPageId: string | null
  expandedNotebooks: Set<string>
  expandedSections: Set<string>
  isLoading: boolean

  // Init
  initialize: () => Promise<void>

  // Workspace
  createWorkspace: (name: string) => Promise<Workspace>

  // Notebooks
  createNotebook: (name: string, icon?: string, color?: string) => Promise<Notebook>
  deleteNotebook: (id: string) => Promise<void>
  updateNotebook: (id: string, updates: Partial<Pick<Notebook, 'name' | 'icon' | 'color'>>) => Promise<void>
  toggleNotebook: (id: string) => void

  // Sections
  loadSections: (notebookId: string) => Promise<Section[]>
  createSection: (notebookId: string, name: string) => Promise<Section>
  deleteSection: (id: string) => Promise<void>
  toggleSection: (id: string) => void

  // Pages
  loadPages: (sectionId: string) => Promise<Page[]>
  createPage: (sectionId: string, title?: string) => Promise<Page>
  updatePage: (id: string, updates: Partial<Page>) => Promise<void>
  savePageContent: (id: string, content: unknown, text: string, wordCount: number, saveVersion?: boolean) => Promise<void>
  deletePage: (id: string) => Promise<void>
  duplicatePage: (id: string) => Promise<Page | null>
  setCurrentPage: (id: string | null) => void
  getCurrentPage: () => Page | null

  // Version history
  versions: PageVersion[]
  loadVersions: (pageId: string) => Promise<void>
  restoreVersion: (pageId: string, version: PageVersion) => Promise<void>

  // Favorites
  favoritePages: Page[]
  loadFavorites: () => Promise<void>
  toggleFavorite: (pageId: string) => Promise<void>

  // Search
  searchResults: Array<{ pageId: string; title: string; excerpt: string; rank: number }>
  searchPages: (query: string) => Promise<void>
  clearSearch: () => void
}

export const useNotebookStore = create<NotebookState>()(
  immer((set, get) => ({
    workspaces: [],
    notebooks: [],
    sections: {},
    pages: {},
    currentWorkspaceId: null,
    currentPageId: null,
    expandedNotebooks: new Set(),
    expandedSections: new Set(),
    isLoading: false,
    favoritePages: [],
    searchResults: [],
    versions: [],

    initialize: async () => {
      set((s) => { s.isLoading = true })
      const db = await getDB()

      // Ensure default workspace exists
      const workspace = await db.pages.ensureDefaultWorkspace()
      const notebooks = await db.pages.getNotebooksByWorkspace(workspace.id)

      set((s) => {
        s.workspaces = [workspace]
        s.notebooks = notebooks
        s.currentWorkspaceId = workspace.id
        s.isLoading = false
      })

      await get().loadFavorites()
    },

    createWorkspace: async (name) => {
      const db = await getDB()
      const ws = await db.pages.createWorkspace(name)
      set((s) => { s.workspaces.push(ws) })
      return ws
    },

    createNotebook: async (name, icon, color) => {
      const db = await getDB()
      const wsId = get().currentWorkspaceId
      if (!wsId) throw new Error('No workspace selected')
      const nb = await db.pages.createNotebook(wsId, name, icon, color)
      set((s) => {
        s.notebooks.push(nb)
        s.expandedNotebooks.add(nb.id)
      })
      return nb
    },

    deleteNotebook: async (id) => {
      const db = await getDB()
      await db.pages.deleteNotebook(id)
      set((s) => {
        s.notebooks = s.notebooks.filter((n) => n.id !== id)
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- intentional cleanup
        delete s.sections[id]
      })
    },

    updateNotebook: async (id, updates) => {
      const db = await getDB()
      await db.pages.updateNotebook(id, updates)
      set((s) => {
        const nb = s.notebooks.find((n) => n.id === id)
        if (nb) Object.assign(nb, updates)
      })
    },

    toggleNotebook: (id) =>
      set((s) => {
        if (s.expandedNotebooks.has(id)) {
          s.expandedNotebooks.delete(id)
        } else {
          s.expandedNotebooks.add(id)
        }
      }),

    loadSections: async (notebookId) => {
      const db = await getDB()
      const sections = await db.pages.getSectionsByNotebook(notebookId)
      set((s) => { s.sections[notebookId] = sections })
      return sections
    },

    createSection: async (notebookId, name) => {
      const db = await getDB()
      const section = await db.pages.createSection(notebookId, name)
      set((s) => {
        if (!s.sections[notebookId]) s.sections[notebookId] = []
        s.sections[notebookId]!.push(section)
        s.expandedSections.add(section.id)
      })
      return section
    },

    deleteSection: async (id) => {
      const db = await getDB()
      await db.pages.deleteSection(id)
      set((s) => {
        for (const nbId of Object.keys(s.sections)) {
          s.sections[nbId] = s.sections[nbId]!.filter((sec) => sec.id !== id)
        }
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- intentional cleanup
        delete s.pages[id]
      })
    },

    toggleSection: (id) =>
      set((s) => {
        if (s.expandedSections.has(id)) {
          s.expandedSections.delete(id)
        } else {
          s.expandedSections.add(id)
        }
      }),

    loadPages: async (sectionId) => {
      const db = await getDB()
      const pages = await db.pages.getPagesBySection(sectionId)
      set((s) => { s.pages[sectionId] = pages })
      return pages
    },

    createPage: async (sectionId, title) => {
      const db = await getDB()
      const page = await db.pages.createPage(sectionId, title)
      set((s) => {
        if (!s.pages[sectionId]) s.pages[sectionId] = []
        s.pages[sectionId]!.push(page)
        s.currentPageId = page.id
      })
      return page
    },

    updatePage: async (id, updates) => {
      const db = await getDB()
      await db.pages.updatePage(id, updates)
      set((s) => {
        for (const sectionId of Object.keys(s.pages)) {
          const pageList = s.pages[sectionId]!
          const page = pageList.find((p) => p.id === id)
          if (page) {
            Object.assign(page, updates)
            // Sync favorites
            if (updates.isFavorite !== undefined) {
              if (updates.isFavorite) {
                if (!s.favoritePages.find((fp) => fp.id === id)) {
                  s.favoritePages.push({ ...page, ...updates })
                }
              } else {
                s.favoritePages = s.favoritePages.filter((fp) => fp.id !== id)
              }
            }
            break
          }
        }
      })
    },

    deletePage: async (id) => {
      const db = await getDB()
      await db.pages.deletePage(id)
      set((s) => {
        for (const sectionId of Object.keys(s.pages)) {
          s.pages[sectionId] = s.pages[sectionId]!.filter((p) => p.id !== id)
        }
        s.favoritePages = s.favoritePages.filter((p) => p.id !== id)
        if (s.currentPageId === id) s.currentPageId = null
      })
    },

    savePageContent: async (id, content, text, wordCount, saveVersion = false) => {
      const db = await getDB()
      // Persist content + word count
      await db.pages.updatePage(id, { content, wordCount })
      // Update full-text search index
      let title = 'Untitled'
      let tags: string[] = []
      for (const pageList of Object.values(get().pages)) {
        const page = pageList.find((p) => p.id === id)
        if (page) { title = page.title; tags = page.tags; break }
      }
      await db.pages.indexPageInFTS(id, title, text, tags)
      // Optionally snapshot a version (last 100 kept by repo)
      if (saveVersion) {
        await db.pages.saveVersion(id, content)
      }
      // Update in-memory state
      set((s) => {
        for (const sectionId of Object.keys(s.pages)) {
          const page = s.pages[sectionId]!.find((p) => p.id === id)
          if (page) { page.content = content; page.wordCount = wordCount; page.updatedAt = new Date(); break }
        }
      })
    },

    duplicatePage: async (id) => {
      const db = await getDB()
      const newPage = await db.pages.duplicatePage(id)
      if (!newPage) return null
      set((s) => {
        if (!s.pages[newPage.sectionId]) s.pages[newPage.sectionId] = []
        s.pages[newPage.sectionId]!.push(newPage)
      })
      return newPage
    },

    setCurrentPage: (id) => set((s) => { s.currentPageId = id }),

    getCurrentPage: () => {
      const { currentPageId, pages } = get()
      if (!currentPageId) return null
      for (const pageList of Object.values(pages)) {
        const found = pageList.find((p) => p.id === currentPageId)
        if (found) return found
      }
      return null
    },

    loadFavorites: async () => {
      const db = await getDB()
      const favs = await db.pages.getFavoritePages()
      set((s) => { s.favoritePages = favs })
    },

    toggleFavorite: async (pageId) => {
      const state = get()
      // Find the page
      for (const pageList of Object.values(state.pages)) {
        const page = pageList.find((p) => p.id === pageId)
        if (page) {
          await state.updatePage(pageId, { isFavorite: !page.isFavorite })
          return
        }
      }
    },

    searchPages: async (query) => {
      if (!query.trim()) {
        set((s) => { s.searchResults = [] })
        return
      }
      const db = await getDB()
      const results = await db.pages.searchPages(query)
      set((s) => { s.searchResults = results })
    },

    clearSearch: () => set((s) => { s.searchResults = [] }),

    loadVersions: async (pageId) => {
      const db = await getDB()
      const versions = await db.pages.getVersions(pageId)
      set((s) => { s.versions = versions })
    },

    restoreVersion: async (pageId, version) => {
      await get().savePageContent(pageId, version.content, '', 0, true)
      set((s) => {
        for (const sectionId of Object.keys(s.pages)) {
          const page = s.pages[sectionId]!.find((p) => p.id === pageId)
          if (page) { page.content = version.content; break }
        }
      })
    },
  })),
)
