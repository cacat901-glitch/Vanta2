/**
 * KnowledgeEngine — the single ingestion pipeline for ALL study material.
 *
 * Every source (notebook page, PDF, lecture transcript, YouTube transcript,
 * web clip, canvas) funnels through ingest(). The engine:
 *   1. upserts a unified knowledge_object  (so it's searchable + on the graph)
 *   2. adds/updates a graph node
 *   3. chunks the text
 *   4. stores chunks IMMEDIATELY (keyword-searchable right away)
 *   5. best-effort generates embeddings in the background (semantic search)
 *
 * Design guarantees:
 *   - Never throws to the caller (imports never hang or crash on AI failure).
 *   - Works with NO AI configured (keyword retrieval over stored chunks).
 *   - Sequential queue so multiple imports don't hammer the embeddings API.
 */
import { getDB } from '@/db'
import { aiService } from '@/services/ai'
import { chunkText } from '@/services/rag'
import type { KnowledgeObjectType } from '@/types/knowledge'

export interface IngestInput {
  /** Stable id, e.g. `page:<id>`, `pdf:<id>`, `lecture:<id>`, `media:<id>`. */
  id: string
  type: KnowledgeObjectType
  title: string
  content: string
  courseId?: string | null
  tags?: string[]
}

// ─── sequential queue ─────────────────────────────────────────────────────────
const _queue: IngestInput[] = []
let _processing = false

/** Queue an object for indexing. Returns immediately; never throws. */
export function ingest(input: IngestInput): void {
  // De-dupe: if the same id is already queued, replace it with the newer content.
  const existingIdx = _queue.findIndex((q) => q.id === input.id)
  if (existingIdx >= 0) _queue[existingIdx] = input
  else _queue.push(input)
  void _drain()
}

/** Await a single ingest (used when the caller wants to know indexing finished). */
export async function ingestNow(input: IngestInput): Promise<void> {
  await _process(input)
}

async function _drain(): Promise<void> {
  if (_processing) return
  _processing = true
  try {
    while (_queue.length > 0) {
      const next = _queue.shift()!
      await _process(next)
    }
  } finally {
    _processing = false
  }
}

async function _process(input: IngestInput): Promise<void> {
  try {
    const db = await getDB()
    const content = (input.content ?? '').trim()

    // 1. upsert the unified knowledge object
    await db.knowledge.upsert({
      id: input.id,
      type: input.type,
      title: input.title || 'Untitled',
      content,
      courseId: input.courseId ?? null,
      tags: input.tags ?? [],
    })

    // 2. graph node
    await db.knowledge.upsertNode({
      objectId: input.id,
      label: input.title || 'Untitled',
      nodeType: input.type,
      properties: {},
    })

    // Too short to chunk — still searchable via the object's content_text.
    if (content.length < 40) {
      await db.knowledge.setIndexed(input.id, true)
      return
    }

    // 3. chunk
    const chunks = chunkText(content)
    if (chunks.length === 0) {
      await db.knowledge.setIndexed(input.id, true)
      return
    }

    // 4. best-effort embeddings (only when an embeddings-capable provider exists
    //    and the chunk count is reasonable — otherwise keyword search is used)
    let embeddings: number[][] = []
    if (aiService.isConfigured && chunks.length <= 80) {
      try {
        embeddings = await aiService.embed(chunks)
      } catch {
        embeddings = []
      }
    }

    // 5. store chunks (empty embedding => keyword-only, still fully searchable)
    await db.knowledge.saveChunks(
      input.id,
      chunks.map((c, i) => ({ content: c, embedding: embeddings[i] ?? [], metadata: {} })),
    )
    await db.knowledge.setIndexed(input.id, true)
  } catch (err) {
    // Never propagate — indexing is best-effort.
    console.error('[KnowledgeEngine] ingest failed for', input.id, err)
  }
}

/** Remove an object (and its chunks) from the knowledge base. */
export async function removeFromKnowledge(id: string): Promise<void> {
  try {
    const db = await getDB()
    await db.knowledge.delete(id)
  } catch (err) {
    console.error('[KnowledgeEngine] remove failed for', id, err)
  }
}

/** Convenience id builders so every module uses the same id scheme. */
export const knowledgeId = {
  page: (id: string) => `page:${id}`,
  pdf: (id: string) => `pdf:${id}`,
  lecture: (id: string) => `lecture:${id}`,
  media: (id: string) => `media:${id}`,
  canvas: (id: string) => `canvas:${id}`,
}
