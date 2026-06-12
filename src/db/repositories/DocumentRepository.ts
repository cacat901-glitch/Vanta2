import { BaseRepository } from './base'
import type { StudyDocument, DocumentType, Annotation, AnnotationType, AnnotationColor, AnnotationPosition } from '@/types/media'

interface DocRow {
  id: string; title: string; file_path: string; file_type: string
  content_text: string | null; page_count: number | null; course_id: string | null
  tags: string; imported_at: string; metadata: string
}

interface AnnotationRow {
  id: string; document_id: string; page: number; type: string
  position: string; content: string | null; color: string | null
  created_at: string; updated_at: string
}

export class DocumentRepository extends BaseRepository {
  async getAll(): Promise<StudyDocument[]> {
    const rows = await this.storage.query<DocRow>('SELECT * FROM documents ORDER BY imported_at DESC')
    return Promise.all(rows.map((r) => this._row(r)))
  }

  async getById(id: string): Promise<StudyDocument | null> {
    const row = await this.storage.queryOne<DocRow>('SELECT * FROM documents WHERE id = ?', [id])
    return row ? this._row(row) : null
  }

  async create(data: { title: string; filePath: string; fileType: DocumentType; contentText?: string; pageCount?: number; courseId?: string }): Promise<StudyDocument> {
    const now = this.now()
    const doc: StudyDocument = {
      id: this.newId(), title: data.title, filePath: data.filePath, fileType: data.fileType,
      contentText: data.contentText ?? null, pageCount: data.pageCount ?? null,
      courseId: data.courseId ?? null, tags: [], importedAt: new Date(), metadata: {}, annotations: [],
    }
    await this.storage.execute(
      `INSERT INTO documents (id, title, file_path, file_type, content_text, page_count, course_id, tags, imported_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [doc.id, doc.title, doc.filePath, doc.fileType, doc.contentText, doc.pageCount, doc.courseId, JSON.stringify([]), now, JSON.stringify({})],
    )
    return doc
  }

  async delete(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM documents WHERE id = ?', [id])
  }

  // ─── Annotations ───────────────────────────────────────────────────
  async getAnnotations(documentId: string): Promise<Annotation[]> {
    const rows = await this.storage.query<AnnotationRow>('SELECT * FROM annotations WHERE document_id = ? ORDER BY page ASC', [documentId])
    return rows.map(this._annotationRow.bind(this))
  }

  async addAnnotation(a: Omit<Annotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Annotation> {
    const now = this.now()
    const ann: Annotation = { ...a, id: this.newId(), createdAt: new Date(), updatedAt: new Date() }
    await this.storage.execute(
      `INSERT INTO annotations (id, document_id, page, type, position, content, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ann.id, ann.documentId, ann.page, ann.type, JSON.stringify(ann.position), ann.content, ann.color, now, now],
    )
    return ann
  }

  async deleteAnnotation(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM annotations WHERE id = ?', [id])
  }

  private async _row(r: DocRow): Promise<StudyDocument> {
    const annotations = await this.getAnnotations(r.id)
    return {
      id: r.id, title: r.title, filePath: r.file_path, fileType: r.file_type as DocumentType,
      contentText: r.content_text, pageCount: r.page_count, courseId: r.course_id,
      tags: this.deserialize<string[]>(r.tags, []), importedAt: new Date(r.imported_at),
      metadata: this.deserialize<Record<string, unknown>>(r.metadata, {}), annotations,
    }
  }

  private _annotationRow(r: AnnotationRow): Annotation {
    return {
      id: r.id, documentId: r.document_id, page: r.page,
      type: r.type as AnnotationType, position: this.deserialize<AnnotationPosition>(r.position, { page: r.page, x: 0, y: 0 }),
      content: r.content, color: r.color as AnnotationColor | null,
      createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
    }
  }
}
