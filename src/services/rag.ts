import { aiService } from '@/services/ai'
import { getDB } from '@/db'

/** Split text into overlapping chunks (~word based). */
export function chunkText(text: string, chunkSize = 200, overlap = 40): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '))
    if (i + chunkSize >= words.length) break
  }
  return chunks
}

/** Cosine similarity between two vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/** Index a knowledge object: chunk + embed + store. Requires AI embeddings. */
export async function indexObject(objectId: string, text: string): Promise<boolean> {
  if (!aiService.isConfigured) return false
  const chunks = chunkText(text)
  if (chunks.length === 0) return false
  try {
    const embeddings = await aiService.embed(chunks)
    const db = await getDB()
    await db.knowledge.saveChunks(objectId, chunks.map((content, i) => ({
      content, embedding: embeddings[i] ?? [], metadata: {},
    })))
    await db.knowledge.setIndexed(objectId, true)
    return true
  } catch {
    return false
  }
}

export interface RetrievedChunk { content: string; objectId: string; score: number }

/** Retrieve top-K chunks relevant to a query. Hybrid: vector + keyword fallback. */
export async function retrieve(query: string, topK = 6): Promise<RetrievedChunk[]> {
  const db = await getDB()
  const allChunks = await db.knowledge.getAllChunks()
  if (allChunks.length === 0) return []

  // Try vector search if embeddings available
  if (aiService.isConfigured) {
    try {
      const [queryEmbedding] = await aiService.embed([query])
      if (queryEmbedding && queryEmbedding.length > 0) {
        const scored = allChunks
          .filter((c) => c.embedding && c.embedding.length > 0)
          .map((c) => ({ content: c.content, objectId: c.objectId, score: cosineSimilarity(queryEmbedding, c.embedding!) }))
          .sort((a, b) => b.score - a.score)
        if (scored.length > 0) return scored.slice(0, topK)
      }
    } catch { /* fall through to keyword */ }
  }

  // Keyword fallback (BM25-lite)
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2)
  return allChunks
    .map((c) => {
      const lc = c.content.toLowerCase()
      const score = terms.reduce((s, t) => s + (lc.includes(t) ? 1 : 0), 0)
      return { content: c.content, objectId: c.objectId, score }
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** Full RAG answer: retrieve context + generate cited answer (streamed). */
export async function ragAnswer(query: string): Promise<{ stream: ReadableStream<{ text: string; done: boolean }>; sources: RetrievedChunk[] }> {
  const sources = await retrieve(query)
  const context = sources.map((s, i) => `[${i + 1}] ${s.content}`).join('\n\n')
  const stream = await aiService.askWithContext(query, context || 'No notes found in your knowledge base.')
  return { stream, sources }
}
