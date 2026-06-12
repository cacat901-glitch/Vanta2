import type { Editor } from '@tiptap/react'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code,
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, Highlighter, Link2, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Superscript as SuperIcon, Subscript as SubIcon, Minus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editor: Editor | null
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null

  const Btn = ({ onClick, active, disabled, title, children }: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    title: string
    children: React.ReactNode
  }) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); onClick() }}
      disabled={disabled}
      title={title}
      className={cn(
        'w-7 h-7 flex items-center justify-center rounded-md transition-colors disabled:opacity-30',
        active ? 'bg-accent-primary/20 text-accent-primary' : 'text-text-secondary hover:bg-surface hover:text-text-primary',
      )}
    >
      {children}
    </button>
  )

  const Divider = () => <div className="w-px h-5 bg-border-subtle mx-1" />

  const HIGHLIGHT_COLORS = ['#FFBB38', '#3ECFB2', '#4DA6FF', '#E91E8C', '#FF9040', '#FF5263']

  return (
    <div className="editor-toolbar flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-border-subtle bg-app-bg/95 backdrop-blur-sm sticky top-0 z-10">
      <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (⌘Z)"><Undo size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (⌘⇧Z)"><Redo size={15} /></Btn>
      <Divider />

      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={15} /></Btn>
      <Divider />

      <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (⌘B)"><Bold size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (⌘I)"><Italic size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (⌘U)"><UnderlineIcon size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><Strikethrough size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code"><Code size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superscript"><SuperIcon size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="Subscript"><SubIcon size={15} /></Btn>
      <Divider />

      {/* Highlight color picker */}
      <div className="flex items-center gap-0.5">
        <Highlighter size={14} className="text-text-muted" />
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHighlight({ color }).run() }}
            title={`Highlight ${color}`}
            className="w-4 h-4 rounded-sm border border-border-subtle hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <Divider />

      <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><List size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="To-do list"><ListChecks size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote"><Quote size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus size={15} /></Btn>
      <Divider />

      <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left"><AlignLeft size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center"><AlignCenter size={15} /></Btn>
      <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right"><AlignRight size={15} /></Btn>
      <Divider />

      <Btn
        onClick={() => {
          const prev = editor.getAttributes('link').href as string | undefined
          const url = window.prompt('Link URL:', prev ?? 'https://')
          if (url === null) return
          if (url === '') editor.chain().focus().unsetLink().run()
          else editor.chain().focus().setLink({ href: url }).run()
        }}
        active={editor.isActive('link')}
        title="Link"
      >
        <Link2 size={15} />
      </Btn>
    </div>
  )
}
