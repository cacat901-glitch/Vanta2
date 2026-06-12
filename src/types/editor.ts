// ─── Editor Types ─────────────────────────────────────────────────────

export type SlashCommandCategory =
  | 'text'
  | 'headings'
  | 'lists'
  | 'media'
  | 'code'
  | 'math'
  | 'tables'
  | 'advanced'
  | 'ai'

export interface SlashCommand {
  id: string
  label: string
  description: string
  icon: string // lucide icon name
  category: SlashCommandCategory
  keywords: string[]
  action: (editor: unknown) => void
}

export interface EditorStatus {
  wordCount: number
  charCount: number
  readingTimeMinutes: number
  isSaving: boolean
  lastSaved: Date | null
  isLocked: boolean
}

export interface SearchResult {
  pageId: string
  pageTitle: string
  sectionId: string
  notebookId: string
  excerpt: string
  score: number
  highlights: Array<{ start: number; end: number }>
}
