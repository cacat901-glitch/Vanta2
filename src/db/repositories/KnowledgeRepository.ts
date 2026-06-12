import { BaseRepository } from './base'
import type { KnowledgeObject, KnowledgeObjectType, KnowledgeChunk, GraphNode, GraphEdge, GraphEdgeType } from '@/types/knowledge'

interface KORow {
  id: string; type: string; title: string; content_text: string; content_rich: string | null
  tags: string; course_id: string | null; created_at: string; updated_at: string
  ai_summary: string | null; ai_keywords: string; ai_description: string | null
  metadata: string; links: string; related_ids: string; is_indexed: number
}

interface ChunkRow {
  id: string; object_id: string; chunk_index: number; content: string; embedding: string | null; metadata: string
}

/** Knowledge Engine + RAG storage + Graph. */
export class KnowledgeRepository extends BaseRepository {
  async getAll(): Promise<KnowledgeObject[]> {
    const rows = await this.storage.query<KORow>('SELECT * FROM knowledge_objects ORDER BY updated_at DESC')
    return rows.map(this._row.bind(this))
  }

  async getById(id: string): Promise<KnowledgeObject | null> {
    const row = await this.storage.queryOne<KORow>('SELECT * FROM knowledge_objects WHERE id = ?', [id])
    return row ? this._row(row) : null
  }

  async upsert(obj: {
    id?: string; type: KnowledgeObjectType; title: string; content: string
    courseId?: string | null; tags?: string[]; aiSummary?: string | null; aiKeywords?: string[]
  }): Promise<KnowledgeObject> {
    const now = this.now()
    const existing = obj.id ? await this.getById(obj.id) : null
    const id = obj.id ?? this.newId()

    if (existing) {
      await this.storage.execute(
        `UPDATE knowledge_objects SET title=?, content_text=?, course_id=?, tags=?, ai_summary=?, ai_keywords=?, updated_at=? WHERE id=?`,
        [obj.title, obj.content, obj.courseId ?? null, JSON.stringify(obj.tags ?? []),
         obj.aiSummary ?? existing.aiSummary, JSON.stringify(obj.aiKeywords ?? existing.aiKeywords), now, id],
      )
    } else {
      await this.storage.execute(
        `INSERT INTO knowledge_objects (id, type, title, content_text, content_rich, tags, course_id, created_at, updated_at, ai_summary, ai_keywords, ai_description, metadata, links, related_ids, is_indexed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, obj.type, obj.title, obj.content, null, JSON.stringify(obj.tags ?? []), obj.courseId ?? null, now, now,
         obj.aiSummary ?? null, JSON.stringify(obj.aiKeywords ?? []), null, JSON.stringify({}), JSON.stringify([]), JSON.stringify([]), 0],
      )
    }
    return (await this.getById(id))!
  }

  async setIndexed(id: string, indexed: boolean): Promise<void> {
    await this.storage.execute('UPDATE knowledge_objects SET is_indexed = ? WHERE id = ?', [indexed ? 1 : 0, id])
  }

  async delete(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM knowledge_objects WHERE id = ?', [id])
    await this.storage.execute('DELETE FROM knowledge_chunks WHERE object_id = ?', [id])
  }

  // ─── RAG chunks ────────────────────────────────────────────────────
  async saveChunks(objectId: string, chunks: Array<{ content: string; embedding: number[]; metadata?: Record<string, unknown> }>): Promise<void> {
    await this.storage.execute('DELETE FROM knowledge_chunks WHERE object_id = ?', [objectId])
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]!
      await this.storage.execute(
        'INSERT INTO knowledge_chunks (id, object_id, chunk_index, content, embedding, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [this.newId(), objectId, i, c.content, JSON.stringify(c.embedding), JSON.stringify(c.metadata ?? {}), this.now()],
      )
    }
  }

  async getAllChunks(): Promise<KnowledgeChunk[]> {
    const rows = await this.storage.query<ChunkRow>('SELECT * FROM knowledge_chunks')
    return rows.map((r) => ({
      id: r.id, objectId: r.object_id, chunkIndex: r.chunk_index, content: r.content,
      embedding: this.deserialize<number[] | null>(r.embedding, null),
      metadata: this.deserialize<Record<string, unknown>>(r.metadata, {}),
    }))
  }

  // ─── Graph ──────────────────────────────────────────────────────────
  async upsertNode(node: Omit<GraphNode, 'id'> & { id?: string }): Promise<void> {
    const existing = await this.storage.queryOne<{ id: string }>('SELECT id FROM graph_nodes WHERE object_id = ?', [node.objectId])
    if (existing) {
      await this.storage.execute('UPDATE graph_nodes SET label = ?, node_type = ?, properties = ? WHERE object_id = ?',
        [node.label, node.nodeType, JSON.stringify(node.properties), node.objectId])
    } else {
      await this.storage.execute('INSERT INTO graph_nodes (id, object_id, label, node_type, properties) VALUES (?, ?, ?, ?, ?)',
        [node.id ?? this.newId(), node.objectId, node.label, node.nodeType, JSON.stringify(node.properties)])
    }
  }

  async addEdge(edge: Omit<GraphEdge, 'id'>): Promise<void> {
    try {
      await this.storage.execute('INSERT INTO graph_edges (id, source_id, target_id, edge_type, weight, metadata) VALUES (?, ?, ?, ?, ?, ?)',
        [this.newId(), edge.sourceId, edge.targetId, edge.edgeType, edge.weight, JSON.stringify(edge.metadata)])
    } catch {
      /* unique constraint — edge exists */
    }
  }

  async getGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const nodeRows = await this.storage.query<{ id: string; object_id: string; label: string; node_type: string; properties: string }>('SELECT * FROM graph_nodes')
    const edgeRows = await this.storage.query<{ id: string; source_id: string; target_id: string; edge_type: string; weight: number; metadata: string }>('SELECT * FROM graph_edges')
    return {
      nodes: nodeRows.map((r) => ({
        id: r.id, objectId: r.object_id, label: r.label,
        nodeType: r.node_type as KnowledgeObjectType, properties: this.deserialize<Record<string, unknown>>(r.properties, {}),
      })),
      edges: edgeRows.map((r) => ({
        id: r.id, sourceId: r.source_id, targetId: r.target_id,
        edgeType: r.edge_type as GraphEdgeType, weight: r.weight, metadata: this.deserialize<Record<string, unknown>>(r.metadata, {}),
      })),
    }
  }

  private _row(r: KORow): KnowledgeObject {
    return {
      id: r.id, type: r.type as KnowledgeObjectType, title: r.title, content: r.content_text,
      contentRich: this.deserialize(r.content_rich, null), tags: this.deserialize<string[]>(r.tags, []),
      courseId: r.course_id, createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
      metadata: this.deserialize<Record<string, unknown>>(r.metadata, {}),
      aiSummary: r.ai_summary, aiKeywords: this.deserialize<string[]>(r.ai_keywords, []), aiDescription: r.ai_description,
      links: this.deserialize<string[]>(r.links, []), backlinks: [], relatedIds: this.deserialize<string[]>(r.related_ids, []),
      chunks: [], isIndexed: this.toBool(r.is_indexed),
    }
  }
}
