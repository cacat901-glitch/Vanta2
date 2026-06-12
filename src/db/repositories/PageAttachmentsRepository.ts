import { BaseRepository } from './base'

export interface PageAttachment {
  id: string
  pageId: string
  documentId: string | null
  courseId: string | null
  attachedAt: Date
}

interface AttachmentRow {
  id: string
  page_id: string
  document_id: string | null
  course_id: string | null
  attached_at: string
}

export class PageAttachmentsRepository extends BaseRepository {
  async getByPage(pageId: string): Promise<PageAttachment[]> {
    const rows = await this.storage.query<AttachmentRow>(
      'SELECT * FROM page_attachments WHERE page_id = ? ORDER BY attached_at ASC',
      [pageId],
    )
    return rows.map(this._row.bind(this))
  }

  async attachDocument(pageId: string, documentId: string): Promise<PageAttachment> {
    // Check if already attached
    const existing = await this.storage.queryOne<AttachmentRow>(
      'SELECT * FROM page_attachments WHERE page_id = ? AND document_id = ?',
      [pageId, documentId],
    )
    if (existing) return this._row(existing)

    const att: PageAttachment = {
      id: this.newId(), pageId, documentId, courseId: null, attachedAt: new Date(),
    }
    await this.storage.execute(
      'INSERT INTO page_attachments (id, page_id, document_id, course_id, attached_at) VALUES (?, ?, ?, ?, ?)',
      [att.id, att.pageId, att.documentId, att.courseId, att.attachedAt.toISOString()],
    )
    return att
  }

  async setPageCourse(pageId: string, courseId: string | null): Promise<void> {
    // Remove any existing course attachment for this page
    await this.storage.execute(
      'DELETE FROM page_attachments WHERE page_id = ? AND document_id IS NULL',
      [pageId],
    )
    if (courseId) {
      await this.storage.execute(
        'INSERT INTO page_attachments (id, page_id, document_id, course_id, attached_at) VALUES (?, ?, ?, ?, ?)',
        [this.newId(), pageId, null, courseId, this.now()],
      )
    }
    // Also update pages.course_id directly
    await this.storage.execute(
      'UPDATE pages SET course_id = ? WHERE id = ?',
      [courseId, pageId],
    )
  }

  async detachDocument(pageId: string, documentId: string): Promise<void> {
    await this.storage.execute(
      'DELETE FROM page_attachments WHERE page_id = ? AND document_id = ?',
      [pageId, documentId],
    )
  }

  async getDocumentIds(pageId: string): Promise<string[]> {
    const rows = await this.storage.query<{ document_id: string }>(
      'SELECT document_id FROM page_attachments WHERE page_id = ? AND document_id IS NOT NULL',
      [pageId],
    )
    return rows.map(r => r.document_id)
  }

  async getCourseId(pageId: string): Promise<string | null> {
    const row = await this.storage.queryOne<{ course_id: string | null }>(
      'SELECT course_id FROM page_attachments WHERE page_id = ? AND course_id IS NOT NULL LIMIT 1',
      [pageId],
    )
    return row?.course_id ?? null
  }

  private _row(r: AttachmentRow): PageAttachment {
    return {
      id: r.id, pageId: r.page_id,
      documentId: r.document_id, courseId: r.course_id,
      attachedAt: new Date(r.attached_at),
    }
  }
}
