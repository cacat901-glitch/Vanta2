/**
 * studyContext — the bridge between the knowledge base and every AI feature.
 *
 * Instead of each feature (oral exam, quiz, flashcards, tutor, chat) building
 * context from whatever text happens to be on screen, they all call these
 * helpers to pull REAL indexed content by source. This is what makes the AI
 * features share one brain.
 */
import { getDB } from '@/db'
import { retrieve } from '@/services/rag'
import type { KnowledgeObjectType } from '@/types/knowledge'

export interface KnowledgeSource {
  id: string
  type: KnowledgeObjectType
  title: string
  courseId: string | null
  hasContent: boolean
}

/** All indexed sources, newest first, for source pickers. */
export async function listKnowledgeSources(): Promise<KnowledgeSource[]> {
  const db = await getDB()
  const objects = await db.knowledge.getAll()
  return objects.map((o) => ({
    id: o.id,
    type: o.type,
    title: o.title || 'Untitled',
    courseId: o.courseId,
    hasContent: (o.content ?? '').trim().length > 20,
  }))
}

/** Full extracted text for a single source. */
export async function getSourceText(id: string): Promise<string> {
  const db = await getDB()
  const obj = await db.knowledge.getById(id)
  return obj?.content ?? ''
}

/** Concatenated text for everything linked to a course. */
export async function getCourseText(courseId: string, maxChars = 14000): Promise<string> {
  const db = await getDB()
  const objects = await db.knowledge.getAll()
  const parts = objects
    .filter((o) => o.courseId === courseId && (o.content ?? '').trim())
    .map((o) => `### ${o.title}\n${o.content}`)
  return clamp(parts.join('\n\n'), maxChars)
}

/** Build a single context string from one or more source ids. */
export async function buildContext(ids: string[], maxChars = 14000): Promise<string> {
  const db = await getDB()
  const parts: string[] = []
  for (const id of ids) {
    const obj = await db.knowledge.getById(id)
    if (obj && (obj.content ?? '').trim()) {
      parts.push(`### ${obj.title}\n${obj.content}`)
    }
  }
  return clamp(parts.join('\n\n'), maxChars)
}

/**
 * Semantic/keyword retrieval across the WHOLE knowledge base for a query.
 * Returns both the context string and the cited source ids.
 */
export async function retrieveContext(
  query: string,
  topK = 6,
): Promise<{ context: string; sourceIds: string[] }> {
  const chunks = await retrieve(query, topK)
  const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
  const sourceIds = [...new Set(chunks.map((c) => c.objectId))]
  return { context, sourceIds }
}

function clamp(text: string, maxChars: number): string {
  return text.length > maxChars ? text.slice(0, maxChars) + '\n…[truncated]' : text
}

/** Human label for a knowledge object type. */
export function sourceTypeLabel(type: KnowledgeObjectType): string {
  const map: Partial<Record<KnowledgeObjectType, string>> = {
    page: 'Note', pdf: 'PDF', lecture: 'Lecture', video: 'Video',
    web_clip: 'Web clip', document: 'Document',
  }
  return map[type] ?? type
}
