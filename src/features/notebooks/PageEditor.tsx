import { useEffect, useRef, useState, useCallback } from 'react'
import type { JSONContent } from '@tiptap/core'
import {
  Star, MoreHorizontal, History, Trash2, Copy, Download, Lock, Unlock, Smile,
} from 'lucide-react'
import { RichEditor } from '@/components/editor/RichEditor'
import { useNotebookStore } from '@/store/notebookStore'
import { useAppStore } from '@/store/appStore'
import { useAIStore } from '@/store/aiStore'
import { useSettingsStore } from '@/store/settingsStore'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  Dialog, DialogContent, DialogHeader, DialogTitle, Button,
} from '@/components/ui'
import { cn, relativeDate, extractTextFromTiptap } from '@/lib/utils'
import type { Page, PageVersion } from '@/types'

const EMOJI_OPTIONS = ['📄', '📝', '📚', '🧠', '🔬', '🧮', '⚗️', '🌍', '💡', '📊', '🎯', '⭐', '🔖', '📖', '✏️', '🧪', '🎨', '💻', '📐', '🗂️']

interface PageEditorProps {
  page: Page
}

export function PageEditor({ page }: PageEditorProps) {
  const updatePage = useNotebookStore((s) => s.updatePage)
  const savePageContent = useNotebookStore((s) => s.savePageContent)
  const deletePage = useNotebookStore((s) => s.deletePage)
  const duplicatePage = useNotebookStore((s) => s.duplicatePage)
  const toggleFavorite = useNotebookStore((s) => s.toggleFavorite)
  const versions = useNotebookStore((s) => s.versions)
  const loadVersions = useNotebookStore((s) => s.loadVersions)
  const restoreVersion = useNotebookStore((s) => s.restoreVersion)
  const setAIPanelOpen = useAppStore((s) => s.setAIPanelOpen)
  const sendMessage = useAIStore((s) => s.sendMessage)
  const toast = useAppStore((s) => s.addToast)
  const autosaveInterval = useSettingsStore((s) => s.settings.editor.autosaveInterval)

  const [title, setTitle] = useState(page.title)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showEmoji, setShowEmoji] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const saveTimer = useRef<ReturnType<typeof setTimeout>>()
  const versionTimer = useRef<ReturnType<typeof setTimeout>>()
  const pendingContent = useRef<{ json: JSONContent; text: string; words: number } | null>(null)

  // Reset title when switching pages
  useEffect(() => { setTitle(page.title) }, [page.id, page.title])

  // Flush pending save when unmounting or switching page
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (versionTimer.current) clearTimeout(versionTimer.current)
      if (pendingContent.current) {
        const { json, text, words } = pendingContent.current
        void savePageContent(page.id, json, text, words, true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.id])

  const handleChange = useCallback((json: JSONContent, text: string, words: number) => {
    pendingContent.current = { json, text, words }
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      await savePageContent(page.id, json, text, words, false)
      pendingContent.current = null
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, Math.max(1000, autosaveInterval * 1000))

    // Save a version snapshot less frequently (every 30s of editing)
    if (!versionTimer.current) {
      versionTimer.current = setTimeout(async () => {
        if (pendingContent.current) {
          await savePageContent(page.id, pendingContent.current.json, pendingContent.current.text, pendingContent.current.words, true)
        }
        versionTimer.current = undefined
      }, 30000)
    }
  }, [page.id, savePageContent, autosaveInterval])

  const handleTitleBlur = useCallback(() => {
    if (title !== page.title) void updatePage(page.id, { title: title || 'Untitled' })
  }, [title, page.id, page.title, updatePage])

  const handleAIAction = useCallback((selectedText: string) => {
    setAIPanelOpen(true)
    const ctx = selectedText || extractTextFromTiptap(page.content).slice(0, 4000)
    if (ctx.trim()) {
      void sendMessage(`Help me with this from my notes:\n\n${ctx}`)
    } else {
      toast({ type: 'info', title: 'Select some text first', description: 'Highlight text, then click the AI button.' })
    }
  }, [setAIPanelOpen, sendMessage, page.content, toast])

  const handleExportMarkdown = useCallback(() => {
    const text = extractTextFromTiptap(page.content)
    const md = `# ${page.title}\n\n${text}`
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${page.title || 'page'}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast({ type: 'success', title: 'Exported as Markdown' })
  }, [page, toast])

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-8 pt-8 pb-2 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <button
              onClick={() => setShowEmoji(!showEmoji)}
              className="text-4xl hover:bg-surface rounded-lg p-1 transition-colors"
            >
              {page.icon ?? '📄'}
            </button>
            {showEmoji && (
              <div className="absolute top-full left-0 mt-1 z-20 grid grid-cols-5 gap-1 p-2 rounded-lg border border-border-default bg-surface-elevated shadow-xl">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { void updatePage(page.id, { icon: emoji }); setShowEmoji(false) }}
                    className="text-xl hover:bg-surface rounded p-1 transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <button
            onClick={() => toggleFavorite(page.id)}
            className={cn('w-8 h-8 flex items-center justify-center rounded-md transition-colors',
              page.isFavorite ? 'text-warning' : 'text-text-muted hover:text-warning hover:bg-surface')}
            title={page.isFavorite ? 'Unfavorite' : 'Add to favorites'}
          >
            <Star size={16} fill={page.isFavorite ? 'currentColor' : 'none'} />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface transition-colors">
                <MoreHorizontal size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={async () => { await loadVersions(page.id); setShowHistory(true) }}>
                <History size={14} /> Version history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void updatePage(page.id, { isLocked: !page.isLocked })}>
                {page.isLocked ? <><Unlock size={14} /> Unlock page</> : <><Lock size={14} /> Lock page</>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void duplicatePage(page.id)}>
                <Copy size={14} /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportMarkdown}>
                <Download size={14} /> Export as Markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => { if (confirm('Delete this page?')) void deletePage(page.id) }}>
                <Trash2 size={14} /> Delete page
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="Untitled"
          disabled={page.isLocked}
          className="w-full bg-transparent text-3xl font-bold text-text-primary placeholder:text-text-muted outline-none"
        />
        {page.tags.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {page.tags.map((tag) => (
              <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-surface text-text-secondary">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden px-8">
        <RichEditor
          key={page.id}
          content={page.content as JSONContent | null}
          onChange={handleChange}
          onAIAction={handleAIAction}
          editable={!page.isLocked}
          autosaveStatus={saveStatus}
        />
      </div>

      {/* Version history dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-1">
            {versions.length === 0 ? (
              <p className="text-sm text-text-muted py-8 text-center">No saved versions yet. Versions are saved automatically as you edit.</p>
            ) : (
              versions.map((v: PageVersion) => (
                <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-surface transition-colors">
                  <div>
                    <p className="text-sm text-text-primary">{v.savedAt.toLocaleString()}</p>
                    <p className="text-xs text-text-muted">{relativeDate(v.savedAt)}</p>
                  </div>
                  <Button
                    size="sm" variant="outline"
                    onClick={async () => { await restoreVersion(page.id, v); setShowHistory(false); toast({ type: 'success', title: 'Version restored' }) }}
                  >
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
