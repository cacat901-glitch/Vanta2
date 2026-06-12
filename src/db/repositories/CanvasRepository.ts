import { BaseRepository } from './base'
import type { CanvasDocument, CanvasBackgroundType } from '@/types'

interface CanvasRow {
  id: string
  title: string
  data: string
  background_type: string
  background_color: string | null
  course_id: string | null
  created_at: string
  updated_at: string
}

export class CanvasRepository extends BaseRepository {
  async getAll(): Promise<CanvasDocument[]> {
    const rows = await this.storage.query<CanvasRow>('SELECT * FROM canvas_documents ORDER BY updated_at DESC')
    return rows.map(this._row.bind(this))
  }

  async getById(id: string): Promise<CanvasDocument | null> {
    const row = await this.storage.queryOne<CanvasRow>('SELECT * FROM canvas_documents WHERE id = ?', [id])
    return row ? this._row(row) : null
  }

  async create(title = 'Untitled Canvas', backgroundType: CanvasBackgroundType = 'dot-small'): Promise<CanvasDocument> {
    const now = this.now()
    const doc: CanvasDocument = {
      id: this.newId(), title, data: null, backgroundType,
      backgroundColor: null, courseId: null, layers: [],
      createdAt: new Date(), updatedAt: new Date(),
    }
    await this.storage.execute(
      `INSERT INTO canvas_documents (id, title, data, background_type, background_color, course_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [doc.id, doc.title, JSON.stringify({}), backgroundType, null, null, now, now],
    )
    return doc
  }

  async save(id: string, data: unknown, backgroundType?: CanvasBackgroundType): Promise<void> {
    const fields = ['data = ?', 'updated_at = ?']
    const values: unknown[] = [JSON.stringify(data), this.now()]
    if (backgroundType) { fields.push('background_type = ?'); values.push(backgroundType) }
    values.push(id)
    await this.storage.execute(`UPDATE canvas_documents SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async rename(id: string, title: string): Promise<void> {
    await this.storage.execute('UPDATE canvas_documents SET title = ?, updated_at = ? WHERE id = ?', [title, this.now(), id])
  }

  async delete(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM canvas_documents WHERE id = ?', [id])
  }

  private _row(r: CanvasRow): CanvasDocument {
    return {
      id: r.id, title: r.title,
      data: this.deserialize(r.data, null),
      backgroundType: r.background_type as CanvasBackgroundType,
      backgroundColor: r.background_color,
      courseId: r.course_id,
      layers: [],
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
    }
  }
}
