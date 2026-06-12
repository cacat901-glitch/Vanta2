import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BookOpen, Plus, Star, ChevronRight, ChevronDown,
  File, Folder, Trash2, Pencil, Check, X, FolderOpen,
  MoreHorizontal, BookMarked,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotebookStore } from '@/store/notebookStore'
import { PageEditor } from './PageEditor'
import type { Notebook, Section, Page, Workspace } from '@/types'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui'

// ─── colour presets for subjects ─────────────────────────────────────
const SUBJECT_COLORS = [
  '#7C6FFF', '#3ECFB2', '#FFBB38', '#FF5263',
  '#4DA6FF', '#4CAF50', '#E91E8C', '#FF9040',
  '#00BCD4', '#8BC34A',
]

const SUBJECT_EMOJIS = ['📚', '🔬', '🧮', '🌍', '🎨', '💻', '⚗️', '📐', '🏛️', '🎵', '🧠', '📝']

// ─── inline rename helper ─────────────────────────────────────────────
function InlineEdit({
  value, onSave, onCancel, className,
}: { value: string; onSave: (v: string) => void; onCancel: () => void; className?: string }) {
  const [text, setText] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus(); ref.current?.select() }, [])
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <input
        ref={ref}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSave(text.trim() || value)
          if (e.key === 'Escape') onCancel()
        }}
        className="flex-1 bg-surface border border-accent-primary/50 rounded px-1.5 py-0.5 text-sm text-text-primary outline-none min-w-0"
      />
      <button onClick={() => onSave(text.trim() || value)} className="text-success hover:text-success/80"><Check size={13} /></button>
      <button onClick={onCancel} className="text-text-muted hover:text-text-primary"><X size={13} /></button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────
export function NotebooksPage() {
  const { pageId } = useParams()
  const navigate = useNavigate()

  const {
    workspaces, notebooks, sections, pages,
    currentPageId, favoritePages,
    initialize,
    createWorkspace, updateNotebook, setCurrentWorkspaceId,
    createNotebook, deleteNotebook,
    loadSections, createSection, updateSection, deleteSection,
    loadPages, createPage, deletePage,
    setCurrentPage, toggleFavorite,
  } = useNotebookStore()

  // Which subject is open
  const [activeSubjectId, setActiveSubjectIdLocal] = useState<string | null>(null)

  const setActiveSubjectId = (id: string) => {
    setActiveSubjectIdLocal(id)
    setCurrentWorkspaceId(id)
  }
  // Expanded notebooks within the active subject
  const [expandedNbs, setExpandedNbs] = useState<Set<string>>(new Set())
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [loadedSections, setLoadedSections] = useState<Set<string>>(new Set())
  const [loadedPages, setLoadedPages] = useState<Set<string>>(new Set())

  // "New subject" dialog
  const [creatingSubject, setCreatingSubject] = useState(false)
  const [newSubjectName, setNewSubjectName] = useState('')
  const [newSubjectColor, setNewSubjectColor] = useState(SUBJECT_COLORS[0]!)
  const [newSubjectEmoji, setNewSubjectEmoji] = useState(SUBJECT_EMOJIS[0]!)

  // Inline renames
  const [renamingNbId, setRenamingNbId] = useState<string | null>(null)
  const [renamingSecId, setRenamingSecId] = useState<string | null>(null)

  useEffect(() => { void initialize() }, [initialize])

  // Open the first subject automatically once loaded
  useEffect(() => {
    if (workspaces.length > 0 && !activeSubjectId) {
      setActiveSubjectId(workspaces[0]!.id)
    }
  }, [workspaces, activeSubjectId])

  // If a pageId is in the URL, navigate to it
  useEffect(() => { if (pageId) setCurrentPage(pageId) }, [pageId, setCurrentPage])

  // Notebooks that belong to the active subject
  const subjectNotebooks = notebooks.filter(nb => nb.workspaceId === activeSubjectId)

  // ─── Actions ──────────────────────────────────────────────────────

  const handleCreateSubject = async () => {
    const name = newSubjectName.trim()
    if (!name) return
    const ws = await createWorkspace(name)
    // Store emoji+color as part of workspace name (compact encoding: "emoji||color||name")
    // Actually: we'll store it properly by updating the workspace name to include metadata
    // Simple approach: prefix the name with "emoji color" separated by special chars
    // We'll encode it as JSON in the name field — but that's messy.
    // Better: create a workspace and immediately set the active subject
    // We'll store emoji and color in localStorage keyed by workspace ID
    saveSubjectMeta(ws.id, { emoji: newSubjectEmoji, color: newSubjectColor })
    setActiveSubjectId(ws.id)
    setCreatingSubject(false)
    setNewSubjectName('')
    setNewSubjectColor(SUBJECT_COLORS[0]!)
    setNewSubjectEmoji(SUBJECT_EMOJIS[0]!)
  }

  const handleDeleteSubject = async (ws: Workspace) => {
    if (!confirm(`Delete subject "${ws.name}" and ALL its notebooks? This cannot be undone.`)) return
    // Delete all notebooks in this workspace
    for (const nb of notebooks.filter(n => n.workspaceId === ws.id)) {
      await deleteNotebook(nb.id)
    }
    // Remove from store (workspace deletion not in store — just reload)
    if (activeSubjectId === ws.id) {
      const others = workspaces.filter(w => w.id !== ws.id)
      setActiveSubjectId(others[0]?.id ?? null)
    }
    window.location.reload() // simplest way to refresh workspace list after delete
  }

  const handleCreateNotebook = async () => {
    if (!activeSubjectId) return
    const nb = await createNotebook('New Notebook', '📓', undefined)
    setExpandedNbs(s => new Set([...s, nb.id]))
    setRenamingNbId(nb.id)
  }

  const handleToggleNotebook = async (nbId: string) => {
    const next = new Set(expandedNbs)
    if (next.has(nbId)) { next.delete(nbId) } else {
      next.add(nbId)
      if (!loadedSections.has(nbId)) {
        await loadSections(nbId)
        setLoadedSections(s => new Set([...s, nbId]))
      }
    }
    setExpandedNbs(next)
  }

  const handleCreateSection = async (nbId: string) => {
    const sec = await createSection(nbId, 'New Section')
    setExpandedSections(s => new Set([...s, sec.id]))
    setRenamingSecId(sec.id)
    if (!expandedNbs.has(nbId)) setExpandedNbs(s => new Set([...s, nbId]))
  }

  const handleToggleSection = async (sectionId: string) => {
    const next = new Set(expandedSections)
    if (next.has(sectionId)) { next.delete(sectionId) } else {
      next.add(sectionId)
      if (!loadedPages.has(sectionId)) {
        await loadPages(sectionId)
        setLoadedPages(s => new Set([...s, sectionId]))
      }
    }
    setExpandedSections(next)
  }

  const handleCreatePage = async (sectionId: string) => {
    const page = await createPage(sectionId, 'Untitled')
    // Make sure section is expanded and pages are loaded
    if (!expandedSections.has(sectionId)) {
      setExpandedSections(s => new Set([...s, sectionId]))
      setLoadedPages(s => new Set([...s, sectionId]))
    }
    navigate(`/notebooks/${page.id}`)
  }

  const currentPage = currentPageId
    ? Object.values(pages).flat().find(p => p.id === currentPageId)
    : null

  // ─── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Column 1: Subjects (workspaces) ── */}
      <div className="w-44 flex-shrink-0 border-r border-border-subtle bg-sidebar-bg flex flex-col">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Subjects</span>
          <button
            onClick={() => setCreatingSubject(true)}
            className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
            title="New Subject"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1.5 no-scrollbar">
          {workspaces.map(ws => {
            const meta = getSubjectMeta(ws.id)
            const isActive = ws.id === activeSubjectId
            return (
              <button
                key={ws.id}
                onClick={() => setActiveSubjectId(ws.id)}
                className={cn(
                  'group w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left',
                  isActive
                    ? 'bg-surface text-text-primary font-medium border-r-2 border-accent-primary'
                    : 'text-text-secondary hover:bg-surface/60 hover:text-text-primary',
                )}
              >
                <span className="text-base flex-shrink-0">{meta.emoji}</span>
                <span className="truncate flex-1">{ws.name}</span>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: meta.color }}
                  onClick={e => { e.stopPropagation(); void handleDeleteSubject(ws) }}
                  title="Delete subject"
                />
              </button>
            )
          })}

          {workspaces.length === 0 && (
            <p className="text-xs text-text-muted px-3 py-4 text-center">
              No subjects yet.<br />Create one to organise your notebooks.
            </p>
          )}
        </div>

        {/* New subject form */}
        {creatingSubject && (
          <div className="border-t border-border-subtle p-2 space-y-2">
            <input
              autoFocus
              value={newSubjectName}
              onChange={e => setNewSubjectName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleCreateSubject(); if (e.key === 'Escape') setCreatingSubject(false) }}
              placeholder="Subject name…"
              className="w-full bg-surface border border-border-default rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-primary/60"
            />
            {/* Emoji picker */}
            <div className="flex flex-wrap gap-1">
              {SUBJECT_EMOJIS.map(em => (
                <button
                  key={em}
                  onClick={() => setNewSubjectEmoji(em)}
                  className={cn('text-sm p-0.5 rounded', newSubjectEmoji === em && 'bg-accent-primary/20')}
                >{em}</button>
              ))}
            </div>
            {/* Color picker */}
            <div className="flex gap-1 flex-wrap">
              {SUBJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewSubjectColor(c)}
                  className={cn('w-4 h-4 rounded-full border-2', newSubjectColor === c ? 'border-white' : 'border-transparent')}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex gap-1">
              <button
                onClick={handleCreateSubject}
                disabled={!newSubjectName.trim()}
                className="flex-1 py-1 rounded bg-accent-primary text-white text-xs hover:bg-accent-hover disabled:opacity-40 transition-colors"
              >Create</button>
              <button
                onClick={() => setCreatingSubject(false)}
                className="flex-1 py-1 rounded bg-surface text-xs text-text-muted hover:text-text-primary transition-colors"
              >Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Column 2: Notebooks + Pages tree ── */}
      <div className="w-56 flex-shrink-0 border-r border-border-subtle bg-sidebar-bg flex flex-col">
        {activeSubjectId ? (
          <>
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider truncate">
                {workspaces.find(w => w.id === activeSubjectId)?.name ?? 'Notebooks'}
              </span>
              <button
                onClick={handleCreateNotebook}
                className="w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface transition-colors"
                title="New Notebook"
              >
                <Plus size={13} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-1.5 no-scrollbar">
              {/* Favorites */}
              {favoritePages.length > 0 && (
                <div className="mb-1">
                  <p className="flex items-center gap-1 text-2xs text-text-muted px-3 py-1 uppercase tracking-wider">
                    <Star size={10} /> Favorites
                  </p>
                  {favoritePages.map(page => (
                    <PageLeaf
                      key={page.id}
                      page={page}
                      active={currentPageId === page.id}
                      onClick={() => navigate(`/notebooks/${page.id}`)}
                    />
                  ))}
                </div>
              )}

              {subjectNotebooks.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <BookMarked size={24} className="text-text-muted mx-auto mb-2" />
                  <p className="text-xs text-text-muted">No notebooks yet.</p>
                  <button
                    onClick={handleCreateNotebook}
                    className="mt-2 text-xs text-accent-primary hover:underline"
                  >+ New Notebook</button>
                </div>
              ) : (
                subjectNotebooks.map(nb => (
                  <NotebookItem
                    key={nb.id}
                    notebook={nb}
                    sections={sections[nb.id] ?? []}
                    pages={pages}
                    expanded={expandedNbs.has(nb.id)}
                    expandedSections={expandedSections}
                    currentPageId={currentPageId}
                    isRenaming={renamingNbId === nb.id}
                    renamingSecId={renamingSecId}
                    onToggle={() => handleToggleNotebook(nb.id)}
                    onRename={v => { void updateNotebook(nb.id, { name: v }); setRenamingNbId(null) }}
                    onCancelRename={() => setRenamingNbId(null)}
                    onStartRename={() => setRenamingNbId(nb.id)}
                    onDelete={() => { if (confirm(`Delete notebook "${nb.name}"?`)) void deleteNotebook(nb.id) }}
                    onCreateSection={() => handleCreateSection(nb.id)}
                    onToggleSection={handleToggleSection}
                    onRenameSection={(secId, name) => {
                      void updateSection(secId, name)
                      setRenamingSecId(null)
                    }}
                    onStartRenameSection={id => setRenamingSecId(id)}
                    onCancelRenameSection={() => setRenamingSecId(null)}
                    onDeleteSection={id => { if (confirm('Delete this section and all its pages?')) void deleteSection(id) }}
                    onCreatePage={handleCreatePage}
                    onNavigatePage={id => navigate(`/notebooks/${id}`)}
                    onDeletePage={id => { if (confirm('Delete this page?')) void deletePage(id) }}
                    onToggleFavoritePage={toggleFavorite}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-4 text-center">
            <div>
              <BookOpen size={28} className="text-text-muted mx-auto mb-2" />
              <p className="text-xs text-text-muted">Select or create a subject</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Column 3: Page editor ── */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {currentPage ? (
          <PageEditor key={currentPage.id} page={currentPage} />
        ) : (
          <EmptyEditor
            hasSubject={!!activeSubjectId}
            hasNotebooks={subjectNotebooks.length > 0}
            onCreateNotebook={handleCreateNotebook}
          />
        )}
      </div>
    </div>
  )
}

// ─── Notebook tree item ───────────────────────────────────────────────
function NotebookItem({
  notebook, sections, pages, expanded, expandedSections, currentPageId,
  isRenaming, renamingSecId,
  onToggle, onRename, onCancelRename, onStartRename, onDelete,
  onCreateSection, onToggleSection,
  onRenameSection, onStartRenameSection, onCancelRenameSection, onDeleteSection,
  onCreatePage, onNavigatePage, onDeletePage, onToggleFavoritePage,
}: {
  notebook: Notebook
  sections: Section[]
  pages: Record<string, Page[]>
  expanded: boolean
  expandedSections: Set<string>
  currentPageId: string | null
  isRenaming: boolean
  renamingSecId: string | null
  onToggle: () => void
  onRename: (v: string) => void
  onCancelRename: () => void
  onStartRename: () => void
  onDelete: () => void
  onCreateSection: () => void
  onToggleSection: (id: string) => void
  onRenameSection: (id: string, name: string) => void
  onStartRenameSection: (id: string) => void
  onCancelRenameSection: () => void
  onDeleteSection: (id: string) => void
  onCreatePage: (sectionId: string) => void
  onNavigatePage: (pageId: string) => void
  onDeletePage: (pageId: string) => void
  onToggleFavoritePage: (pageId: string) => void
}) {
  return (
    <div>
      {/* Notebook row */}
      <div className="group flex items-center gap-1 px-2 py-1.5 hover:bg-surface/60 rounded-md mx-1">
        <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          {expanded ? <ChevronDown size={12} className="text-text-muted flex-shrink-0" /> : <ChevronRight size={12} className="text-text-muted flex-shrink-0" />}
          <span className="text-sm flex-shrink-0">{notebook.icon ?? '📓'}</span>
          {isRenaming ? (
            <InlineEdit value={notebook.name} onSave={onRename} onCancel={onCancelRename} className="flex-1" />
          ) : (
            <span className="text-sm text-text-primary truncate flex-1">{notebook.name}</span>
          )}
        </button>
        {!isRenaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-text-muted hover:text-text-primary hover:bg-surface transition-all">
                <MoreHorizontal size={12} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onStartRename}><Pencil size={13} /> Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={onCreateSection}><Folder size={13} /> New Section</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={onDelete}><Trash2 size={13} /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Sections */}
      {expanded && (
        <div className="ml-5">
          {sections.length === 0 && (
            <button
              onClick={onCreateSection}
              className="flex items-center gap-1 w-full px-2 py-1 text-xs text-text-muted hover:text-accent-primary transition-colors"
            >
              <Plus size={10} /> Add section
            </button>
          )}
          {sections.map(sec => (
            <SectionItem
              key={sec.id}
              section={sec}
              pages={pages[sec.id] ?? []}
              expanded={expandedSections.has(sec.id)}
              currentPageId={currentPageId}
              isRenaming={renamingSecId === sec.id}
              onToggle={() => onToggleSection(sec.id)}
              onRename={name => onRenameSection(sec.id, name)}
              onStartRename={() => onStartRenameSection(sec.id)}
              onCancelRename={onCancelRenameSection}
              onDelete={() => onDeleteSection(sec.id)}
              onCreatePage={() => onCreatePage(sec.id)}
              onNavigatePage={onNavigatePage}
              onDeletePage={onDeletePage}
              onToggleFavorite={onToggleFavoritePage}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Section item ─────────────────────────────────────────────────────
function SectionItem({
  section, pages, expanded, currentPageId,
  isRenaming, onToggle, onRename, onStartRename, onCancelRename, onDelete,
  onCreatePage, onNavigatePage, onDeletePage, onToggleFavorite,
}: {
  section: Section
  pages: Page[]
  expanded: boolean
  currentPageId: string | null
  isRenaming: boolean
  onToggle: () => void
  onRename: (name: string) => void
  onStartRename: () => void
  onCancelRename: () => void
  onDelete: () => void
  onCreatePage: () => void
  onNavigatePage: (id: string) => void
  onDeletePage: (id: string) => void
  onToggleFavorite: (id: string) => void
}) {
  return (
    <div>
      <div className="group flex items-center gap-1 px-1 py-1 hover:bg-surface/60 rounded mx-1">
        <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
          {expanded
            ? <FolderOpen size={12} className="text-text-muted flex-shrink-0" />
            : <Folder size={12} className="text-text-muted flex-shrink-0" />}
          {isRenaming ? (
            <InlineEdit value={section.name} onSave={onRename} onCancel={onCancelRename} className="flex-1" />
          ) : (
            <span className="text-xs text-text-secondary truncate flex-1">{section.name}</span>
          )}
        </button>
        {!isRenaming && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded text-text-muted hover:text-text-primary transition-all">
                <MoreHorizontal size={11} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onStartRename}><Pencil size={12} /> Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={onCreatePage}><File size={12} /> New Page</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={onDelete}><Trash2 size={12} /> Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {expanded && (
        <div className="ml-4">
          {pages.map(page => (
            <PageLeaf
              key={page.id}
              page={page}
              active={currentPageId === page.id}
              onClick={() => onNavigatePage(page.id)}
              onDelete={() => onDeletePage(page.id)}
              onToggleFavorite={() => onToggleFavorite(page.id)}
            />
          ))}
          <button
            onClick={onCreatePage}
            className="flex items-center gap-1 w-full px-2 py-1 text-2xs text-text-muted hover:text-accent-primary transition-colors"
          >
            <Plus size={9} /> New page
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Page leaf ────────────────────────────────────────────────────────
function PageLeaf({
  page, active, onClick, onDelete, onToggleFavorite,
}: {
  page: Page; active: boolean; onClick: () => void
  onDelete?: () => void; onToggleFavorite?: () => void
}) {
  return (
    <div className={cn('group flex items-center gap-1 px-2 py-1 rounded mx-1 cursor-pointer transition-colors',
      active ? 'bg-accent-primary/12 text-accent-primary' : 'text-text-muted hover:bg-surface/60 hover:text-text-secondary')}>
      <button onClick={onClick} className="flex items-center gap-1.5 flex-1 min-w-0 text-left">
        <span className="text-xs">{page.icon ?? '📄'}</span>
        <span className={cn('text-xs truncate flex-1', active && 'text-accent-primary')}>
          {page.title || 'Untitled'}
        </span>
      </button>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onToggleFavorite && (
          <button onClick={onToggleFavorite} className="hover:text-warning" title="Favourite">
            <Star size={10} fill={page.isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="hover:text-danger" title="Delete page">
            <Trash2 size={10} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Empty editor state ───────────────────────────────────────────────
function EmptyEditor({
  hasSubject, hasNotebooks, onCreateNotebook,
}: { hasSubject: boolean; hasNotebooks: boolean; onCreateNotebook: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center">
        <BookOpen size={28} className="text-text-muted" />
      </div>
      <div>
        {!hasSubject ? (
          <>
            <h2 className="text-lg font-semibold text-text-primary">Create a Subject first</h2>
            <p className="text-sm text-text-muted mt-1">
              Subjects organise your notebooks — e.g. Mathematics, Chemistry, History.
            </p>
          </>
        ) : !hasNotebooks ? (
          <>
            <h2 className="text-lg font-semibold text-text-primary">No notebooks in this subject</h2>
            <p className="text-sm text-text-muted mt-1">
              Create a notebook, add sections, then start writing pages.
            </p>
            <button
              onClick={onCreateNotebook}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm hover:bg-accent-hover transition-colors mx-auto"
            >
              <Plus size={14} /> New Notebook
            </button>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-text-primary">Select a page</h2>
            <p className="text-sm text-text-muted mt-1">
              Expand a notebook, open a section, and click a page — or create a new one.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// ─── localStorage helpers for subject emoji/color ────────────────────
function saveSubjectMeta(id: string, meta: { emoji: string; color: string }) {
  try { localStorage.setItem(`studyos:subject:${id}`, JSON.stringify(meta)) } catch { /* ignore */ }
}

function getSubjectMeta(id: string): { emoji: string; color: string } {
  try {
    const raw = localStorage.getItem(`studyos:subject:${id}`)
    if (raw) return JSON.parse(raw) as { emoji: string; color: string }
  } catch { /* ignore */ }
  return { emoji: '📚', color: '#7C6FFF' }
}
