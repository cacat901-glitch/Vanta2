// ─── Knowledge Object System ──────────────────────────────────────────

export type KnowledgeObjectType =
  | 'note'
  | 'page'
  | 'pdf'
  | 'flashcard'
  | 'lecture'
  | 'video'
  | 'image'
  | 'task'
  | 'exam'
  | 'course'
  | 'mindmap'
  | 'canvas'
  | 'conversation'
  | 'document'
  | 'web_clip'

export interface KnowledgeChunk {
  id: string
  objectId: string
  chunkIndex: number
  content: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- embedding stored as JSON array
  embedding: number[] | null
  metadata: Record<string, unknown>
}

export interface KnowledgeObject {
  id: string
  type: KnowledgeObjectType
  title: string
  content: string // raw extracted text for search/AI
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- rich content is type-specific (TipTap JSON, canvas JSON, etc.)
  contentRich: unknown
  tags: string[]
  courseId: string | null
  createdAt: Date
  updatedAt: Date
  metadata: Record<string, unknown>

  // AI-generated fields
  aiSummary: string | null
  aiKeywords: string[]
  aiDescription: string | null

  // Graph fields
  links: string[]
  backlinks: string[]
  relatedIds: string[]

  // RAG fields
  chunks: KnowledgeChunk[]
  isIndexed: boolean
}

// ─── Notebooks ───────────────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  createdAt: Date
}

export interface Notebook {
  id: string
  workspaceId: string
  name: string
  icon: string | null
  color: string | null
  createdAt: Date
}

export interface Section {
  id: string
  notebookId: string
  name: string
  orderIndex: number
}

export interface Page {
  id: string
  sectionId: string
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TipTap JSON document structure
  content: unknown
  icon: string | null
  cover: string | null
  tags: string[]
  wordCount: number
  versionCount: number
  isFavorite: boolean
  isLocked: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PageVersion {
  id: string
  pageId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TipTap JSON snapshot
  content: unknown
  savedAt: Date
}

// ─── Canvas ──────────────────────────────────────────────────────────

export type CanvasBackgroundType =
  | 'blank-white'
  | 'blank-dark'
  | 'blank-custom'
  | 'ruled-narrow'
  | 'ruled-wide'
  | 'ruled-college'
  | 'graph-small'
  | 'graph-large'
  | 'dot-small'
  | 'dot-large'
  | 'isometric'

export interface CanvasLayer {
  id: string
  canvasId: string
  name: string
  orderIndex: number
  visible: boolean
  locked: boolean
  opacity: number
}

export interface CanvasDocument {
  id: string
  title: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Fabric.js JSON serialization
  data: unknown
  backgroundType: CanvasBackgroundType
  backgroundColor: string | null
  courseId: string | null
  layers: CanvasLayer[]
  createdAt: Date
  updatedAt: Date
}

// ─── Graph ───────────────────────────────────────────────────────────

export type GraphEdgeType =
  | 'explicit_link'
  | 'mention'
  | 'course_membership'
  | 'ai_semantic'
  | 'prerequisite'
  | 'temporal'

export interface GraphNode {
  id: string
  objectId: string
  label: string
  nodeType: KnowledgeObjectType
  properties: Record<string, unknown>
}

export interface GraphEdge {
  id: string
  sourceId: string
  targetId: string
  edgeType: GraphEdgeType
  weight: number
  metadata: Record<string, unknown>
}

// ─── Lectures ────────────────────────────────────────────────────────

export type LectureStatus = 'recording' | 'processing' | 'ready' | 'error'

export interface LectureChapter {
  id: string
  lectureId: string
  title: string
  startTime: number // seconds
  endTime: number | null
}

export interface TranscriptLine {
  text: string
  startTime: number
  endTime: number
  speaker?: string
}

export interface Lecture {
  id: string
  title: string
  courseId: string | null
  audioPath: string | null
  transcript: TranscriptLine[]
  summary: string | null
  notesPageId: string | null
  duration: number | null // seconds
  recordedAt: Date
  processedAt: Date | null
  status: LectureStatus
  tags: string[]
  chapters: LectureChapter[]
}
