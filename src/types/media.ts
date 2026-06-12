// ─── Media Types ──────────────────────────────────────────────────────

export type MediaType = 'youtube' | 'image' | 'audio' | 'video' | 'web-clip'

/** Transcript line for media items (YouTube, audio recordings).
 *  Named MediaTranscriptLine to avoid collision with knowledge.TranscriptLine */
export interface MediaTranscriptLine {
  text: string
  startSeconds: number
  endSeconds?: number
}

export interface MediaItem {
  id: string
  type: MediaType
  url: string
  title: string | null
  thumbnail: string | null
  duration: number | null // seconds
  channelName: string | null
  courseId: string | null
  transcript: MediaTranscriptLine[] | null
  filePath: string | null // for local files
  tags: string[]
  addedAt: Date
  metadata: Record<string, unknown>
}

export interface MediaTimestamp {
  id: string
  mediaId: string
  timeSeconds: number
  notePageId: string | null
  label: string | null
  createdAt: Date
}

// ─── Documents/PDFs ───────────────────────────────────────────────────

export type DocumentType = 'pdf' | 'docx' | 'pptx' | 'epub' | 'html' | 'markdown' | 'text' | 'csv' | 'rtf'

export type AnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'sticky-note'
  | 'ink'
  | 'shape'
  | 'bookmark'
  | 'stamp'

export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange'

export interface AnnotationPosition {
  page: number
  x: number
  y: number
  width?: number
  height?: number
  textStart?: number
  textEnd?: number
  points?: Array<{ x: number; y: number }>
}

export interface Annotation {
  id: string
  documentId: string
  page: number
  type: AnnotationType
  position: AnnotationPosition
  content: string | null
  color: AnnotationColor | null
  createdAt: Date
  updatedAt: Date
}

export interface StudyDocument {
  id: string
  title: string
  filePath: string
  fileType: DocumentType
  contentText: string | null
  pageCount: number | null
  courseId: string | null
  tags: string[]
  importedAt: Date
  metadata: Record<string, unknown>
  annotations: Annotation[]
}
