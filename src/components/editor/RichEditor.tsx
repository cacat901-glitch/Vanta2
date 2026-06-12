import { useEffect, useRef, useCallback, useState } from 'react'
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link2, Highlighter, Sparkles,
} from 'lucide-react'
import { buildExtensions } from './extensions'
import { EditorToolbar } from './EditorToolbar'
import { SlashMenu } from './SlashMenu'
import { cn, readingTime } from '@/lib/utils'

export interface RichEditorProps {
  content: JSONContent | null
  onChange: (json: JSONContent, text: string, wordCount: number) => void
  onAIAction?: (selectedText: string) => void
  editable?: boolean
  placeholder?: string
  autosaveStatus?: 'saved' | 'saving' | 'idle'
}

export function RichEditor({
  content, onChange, onAIAction, editable = true, placeholder, autosaveStatus = 'idle',
}: RichEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const [stats, setStats] = useState({ words: 0, chars: 0 })

  const editor = useEditor({
    extensions: buildExtensions(placeholder),
    content: content ?? '',
    editable,
    editorProps: {
      attributes: {
        class: 'prose-editor focus:outline-none min-h-[60vh] px-1 py-4',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON()
      const text = ed.getText()
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      setStats({ words, chars: text.length })
      onChangeRef.current(json, text, words)
    },
  }, [editable])

  // Update content when switching pages
  useEffect(() => {
    if (!editor) return
    const current = JSON.stringify(editor.getJSON())
    const next = JSON.stringify(content ?? { type: 'doc', content: [] })
    if (current !== next) {
      editor.commands.setContent(content ?? '', false)
      const text = editor.getText()
      setStats({ words: text.trim() ? text.trim().split(/\s+/).length : 0, chars: text.length })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor])

  const handleAI = useCallback(() => {
    if (!editor || !onAIAction) return
    const { from, to } = editor.state.selection
    const text = editor.state.doc.textBetween(from, to, ' ')
    onAIAction(text)
  }, [editor, onAIAction])

  if (!editor) return null

  return (
    <div className="flex flex-col h-full">
      {editable && <EditorToolbar editor={editor} />}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Bubble menu on text selection */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100 }}
        className="flex items-center gap-0.5 px-1 py-1 rounded-lg border border-border-default bg-surface-elevated shadow-xl"
      >
        <BubbleBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}><Bold size={14} /></BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><Italic size={14} /></BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')}><UnderlineIcon size={14} /></BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}><Strikethrough size={14} /></BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')}><Code size={14} /></BubbleBtn>
        <BubbleBtn onClick={() => editor.chain().focus().toggleHighlight({ color: '#FFBB38' }).run()} active={editor.isActive('highlight')}><Highlighter size={14} /></BubbleBtn>
        <BubbleBtn onClick={() => {
          const url = window.prompt('Link URL:', 'https://')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }} active={editor.isActive('link')}><Link2 size={14} /></BubbleBtn>
        {onAIAction && (
          <>
            <div className="w-px h-4 bg-border-subtle mx-0.5" />
            <button
              onMouseDown={(e) => { e.preventDefault(); handleAI() }}
              className="flex items-center gap-1 px-2 h-7 rounded-md text-accent-primary hover:bg-accent-primary/15 transition-colors text-xs font-medium"
            >
              <Sparkles size={13} /> AI
            </button>
          </>
        )}
      </BubbleMenu>

      {/* Slash command menu */}
      <SlashMenu editor={editor} />

      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-1.5 border-t border-border-subtle text-xs text-text-muted">
        <span>{stats.words} words</span>
        <span>{stats.chars} chars</span>
        <span>{readingTime(stats.words)} min read</span>
        <div className="flex-1" />
        <SaveIndicator status={autosaveStatus} />
      </div>
    </div>
  )
}

function BubbleBtn({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      className={cn(
        'w-7 h-7 flex items-center justify-center rounded-md transition-colors',
        active ? 'bg-accent-primary/20 text-accent-primary' : 'text-text-secondary hover:bg-surface hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )
}

function SaveIndicator({ status }: { status: 'saved' | 'saving' | 'idle' }) {
  if (status === 'saving') {
    return <span className="flex items-center gap-1.5 text-text-muted"><span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" /> Saving…</span>
  }
  if (status === 'saved') {
    return <span className="flex items-center gap-1.5 text-success"><span className="w-1.5 h-1.5 rounded-full bg-success" /> Saved</span>
  }
  return null
}
