import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BookOpen, Plus, Star, ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotebookStore } from '@/store/notebookStore'
import { PageEditor } from './PageEditor'
import type { Notebook, Section, Page } from '@/types'

export function NotebooksPage() {
  const { pageId } = useParams()
  const navigate = useNavigate()
  const {
    notebooks, sections, pages, currentPageId,
    createNotebook, loadSections, createSection, loadPages, createPage, setCurrentPage,
    favoritePages, toggleFavorite,
  } = useNotebookStore()

  const [expandedNotebooks, setExpandedNotebooks] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [loadedSections, setLoadedSections] = useState<Set<string>>(new Set())
  const [loadedPages, setLoadedPages] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (pageId) setCurrentPage(pageId)
  }, [pageId, setCurrentPage])

  const toggleNotebook = async (nbId: string) => {
    const newSet = new Set(expandedNotebooks)
    if (newSet.has(nbId)) {
      newSet.delete(nbId)
    } else {
      newSet.add(nbId)
      if (!loadedSections.has(nbId)) {
        await loadSections(nbId)
        setLoadedSections((s) => new Set([...s, nbId]))
      }
    }
    setExpandedNotebooks(newSet)
  }

  const toggleSection = async (sectionId: string) => {
    const newSet = new Set(expandedSections)
    if (newSet.has(sectionId)) {
      newSet.delete(sectionId)
    } else {
      newSet.add(sectionId)
      if (!loadedPages.has(sectionId)) {
        await loadPages(sectionId)
        setLoadedPages((s) => new Set([...s, sectionId]))
      }
    }
    setExpandedSections(newSet)
  }

  const handleCreatePage = async (sectionId: string) => {
    const page = await createPage(sectionId)
    navigate(`/notebooks/${page.id}`)
  }

  const currentPage = currentPageId
    ? Object.values(pages).flat().find((p) => p.id === currentPageId)
    : null

  return (
    <div className="flex h-full">
      <div className="w-64 flex-shrink-0 border-r border-border-subtle bg-sidebar-bg overflow-y-auto">
        <div className="p-3 space-y-1">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notebooks</h2>
            <button
              onClick={() => createNotebook('New Notebook')}
              className="w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
              title="New Notebook"
            >
              <Plus size={14} />
            </button>
          </div>

          {favoritePages.length > 0 && (
            <div className="mb-2">
              <p className="flex items-center gap-1 text-xs text-text-muted px-1 mb-1">
                <Star size={11} /> Favorites
              </p>
              {favoritePages.map((page) => (
                <NotebookLeaf
                  key={page.id}
                  label={page.title || 'Untitled'}
                  icon={page.icon ?? '📄'}
                  active={currentPageId === page.id}
                  onClick={() => navigate(`/notebooks/${page.id}`)}
                />
              ))}
            </div>
          )}

          {notebooks.map((nb) => (
            <NotebookTreeItem
              key={nb.id}
              notebook={nb}
              sections={sections[nb.id] ?? []}
              pages={pages}
              expanded={expandedNotebooks.has(nb.id)}
              expandedSections={expandedSections}
              currentPageId={currentPageId}
              onToggle={() => toggleNotebook(nb.id)}
              onToggleSection={toggleSection}
              onCreateSection={() => createSection(nb.id, 'New Section')}
              onCreatePage={handleCreatePage}
              onNavigatePage={(id) => navigate(`/notebooks/${id}`)}
            />
          ))}

          {notebooks.length === 0 && (
            <button
              onClick={() => createNotebook('My First Notebook')}
              className="flex items-center gap-2 w-full px-2 py-2 text-sm text-text-muted hover:text-text-primary border border-dashed border-border-default rounded-lg transition-colors"
            >
              <Plus size={14} />
              Create your first notebook
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {currentPage ? (
          <PageEditor key={currentPage.id} page={currentPage} />
        ) : (
          <NotebooksEmpty onCreate={() => createNotebook('My Notebook')} />
        )}
      </div>
    </div>
  )
}

function NotebookTreeItem({
  notebook, sections, pages, expanded, expandedSections, currentPageId,
  onToggle, onToggleSection, onCreateSection, onCreatePage, onNavigatePage,
}: {
  notebook: Notebook
  sections: Section[]
  pages: Record<string, Page[]>
  expanded: boolean
  expandedSections: Set<string>
  currentPageId: string | null
  onToggle: () => void
  onToggleSection: (id: string) => void
  onCreateSection: () => void
  onCreatePage: (sectionId: string) => void
  onNavigatePage: (pageId: string) => void
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full px-1 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface/60 rounded-md transition-colors group"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="text-base">{notebook.icon ?? '📓'}</span>
        <span className="truncate flex-1 text-left">{notebook.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onCreateSection() }}
          className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-primary transition-all"
          title="New Section"
        >
          <Plus size={11} />
        </button>
      </button>

      {expanded && (
        <div className="ml-4">
          {sections.map((section) => (
            <div key={section.id}>
              <button
                onClick={() => onToggleSection(section.id)}
                className="flex items-center gap-1.5 w-full px-1 py-1 text-xs text-text-muted hover:text-text-secondary hover:bg-surface/60 rounded transition-colors group"
              >
                {expandedSections.has(section.id) ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                <Folder size={11} />
                <span className="truncate flex-1 text-left">{section.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onCreatePage(section.id) }}
                  className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center hover:text-text-primary transition-all"
                >
                  <Plus size={10} />
                </button>
              </button>

              {expandedSections.has(section.id) && (
                <div className="ml-4">
                  {(pages[section.id] ?? []).map((page) => (
                    <button
                      key={page.id}
                      onClick={() => onNavigatePage(page.id)}
                      className={cn(
                        'flex items-center gap-1.5 w-full px-1 py-1 text-xs rounded transition-colors',
                        currentPageId === page.id
                          ? 'text-accent-primary bg-accent-primary/10'
                          : 'text-text-muted hover:text-text-secondary hover:bg-surface/60',
                      )}
                    >
                      <File size={10} />
                      <span className="truncate">{page.title || 'Untitled'}</span>
                      {page.isFavorite && <Star size={9} className="ml-auto text-warning" />}
                    </button>
                  ))}
                  {(pages[section.id] ?? []).length === 0 && (
                    <button
                      onClick={() => onCreatePage(section.id)}
                      className="flex items-center gap-1 w-full px-1 py-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      <Plus size={9} /> New page
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NotebookLeaf({ label, icon, active, onClick }: {
  label: string; icon: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 w-full px-2 py-1 text-xs rounded transition-colors',
        active ? 'text-accent-primary bg-accent-primary/10' : 'text-text-muted hover:text-text-secondary hover:bg-surface/60',
      )}
    >
      <span>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function NotebooksEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center">
        <BookOpen size={28} className="text-text-muted" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">No page selected</h2>
        <p className="text-sm text-text-muted mt-1">Select a page from the sidebar or create a new notebook</p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-hover transition-colors"
      >
        <Plus size={14} /> New Notebook
      </button>
    </div>
  )
}
