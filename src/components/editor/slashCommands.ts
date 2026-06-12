import type { Editor } from '@tiptap/react'
import type { CalloutType } from './extensions/Callout'

export interface SlashCommandDef {
  id: string
  title: string
  description: string
  icon: string // lucide icon name
  group: string
  keywords: string[]
  run: (editor: Editor) => void
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  {
    id: 'text', title: 'Text', description: 'Plain paragraph', icon: 'Type', group: 'Basic',
    keywords: ['text', 'paragraph', 'p'],
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    id: 'h1', title: 'Heading 1', description: 'Large section heading', icon: 'Heading1', group: 'Basic',
    keywords: ['h1', 'heading', 'title'],
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2', title: 'Heading 2', description: 'Medium heading', icon: 'Heading2', group: 'Basic',
    keywords: ['h2', 'heading', 'subtitle'],
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3', title: 'Heading 3', description: 'Small heading', icon: 'Heading3', group: 'Basic',
    keywords: ['h3', 'heading'],
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet', title: 'Bullet List', description: 'Unordered list', icon: 'List', group: 'Lists',
    keywords: ['bullet', 'list', 'ul', 'unordered'],
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'ordered', title: 'Numbered List', description: 'Ordered list', icon: 'ListOrdered', group: 'Lists',
    keywords: ['numbered', 'ordered', 'ol', 'list'],
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'task', title: 'To-do List', description: 'Checkbox list', icon: 'ListChecks', group: 'Lists',
    keywords: ['todo', 'task', 'checkbox', 'check'],
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'quote', title: 'Quote', description: 'Block quote', icon: 'Quote', group: 'Basic',
    keywords: ['quote', 'blockquote', 'citation'],
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'code', title: 'Code Block', description: 'Syntax-highlighted code', icon: 'Code', group: 'Basic',
    keywords: ['code', 'codeblock', 'snippet'],
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'divider', title: 'Divider', description: 'Horizontal rule', icon: 'Minus', group: 'Basic',
    keywords: ['divider', 'hr', 'separator', 'line'],
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    id: 'table', title: 'Table', description: 'Insert a 3×3 table', icon: 'Table', group: 'Advanced',
    keywords: ['table', 'grid'],
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: 'math-block', title: 'Math Block', description: 'Block LaTeX equation', icon: 'Sigma', group: 'Advanced',
    keywords: ['math', 'equation', 'latex', 'formula'],
    run: (e) => {
      const latex = window.prompt('Enter LaTeX:', 'E = mc^2') ?? ''
      e.chain().focus().setMathBlock(latex).run()
    },
  },
  {
    id: 'math-inline', title: 'Inline Math', description: 'Inline LaTeX', icon: 'Pi', group: 'Advanced',
    keywords: ['math', 'inline', 'latex'],
    run: (e) => {
      const latex = window.prompt('Enter inline LaTeX:', 'x^2') ?? ''
      e.chain().focus().setMathInline(latex).run()
    },
  },
  {
    id: 'callout-info', title: 'Info Callout', description: 'Blue info box', icon: 'Info', group: 'Callouts',
    keywords: ['callout', 'info', 'note'],
    run: (e) => e.chain().focus().setCallout('info' as CalloutType).run(),
  },
  {
    id: 'callout-tip', title: 'Tip Callout', description: 'Green tip box', icon: 'Lightbulb', group: 'Callouts',
    keywords: ['callout', 'tip', 'hint'],
    run: (e) => e.chain().focus().setCallout('tip' as CalloutType).run(),
  },
  {
    id: 'callout-warning', title: 'Warning Callout', description: 'Yellow warning box', icon: 'AlertTriangle', group: 'Callouts',
    keywords: ['callout', 'warning', 'caution'],
    run: (e) => e.chain().focus().setCallout('warning' as CalloutType).run(),
  },
  {
    id: 'callout-danger', title: 'Danger Callout', description: 'Red danger box', icon: 'AlertOctagon', group: 'Callouts',
    keywords: ['callout', 'danger', 'error'],
    run: (e) => e.chain().focus().setCallout('danger' as CalloutType).run(),
  },
  {
    id: 'image', title: 'Image', description: 'Embed image by URL', icon: 'Image', group: 'Media',
    keywords: ['image', 'picture', 'photo'],
    run: (e) => {
      const url = window.prompt('Image URL:')
      if (url) e.chain().focus().setImage({ src: url }).run()
    },
  },
  {
    id: 'youtube', title: 'YouTube', description: 'Embed a YouTube video', icon: 'Youtube', group: 'Media',
    keywords: ['youtube', 'video', 'embed'],
    run: (e) => {
      const url = window.prompt('YouTube URL:')
      if (url) e.commands.setYoutubeVideo({ src: url })
    },
  },
]

export function filterSlashCommands(query: string): SlashCommandDef[] {
  if (!query) return SLASH_COMMANDS
  const q = query.toLowerCase()
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(q) ||
      cmd.keywords.some((k) => k.includes(q)),
  )
}
