import { BaseRepository } from './base'
import type { Lecture, LectureStatus, TranscriptLine, LectureChapter } from '@/types/knowledge'

interface LectureRow {
  id: string; title: string; course_id: string | null; audio_path: string | null
  transcript: string; summary: string | null; notes_page_id: string | null
  duration: number | null; recorded_at: string; processed_at: string | null
  status: string; tags: string
}

export class LectureRepository extends BaseRepository {
  async getAll(): Promise<Lecture[]> {
    const rows = await this.storage.query<LectureRow>('SELECT * FROM lectures ORDER BY recorded_at DESC')
    return rows.map(this._row.bind(this))
  }

  async getById(id: string): Promise<Lecture | null> {
    const row = await this.storage.queryOne<LectureRow>('SELECT * FROM lectures WHERE id = ?', [id])
    return row ? this._row(row) : null
  }

  async create(data: { title: string; courseId?: string; audioPath?: string; duration?: number }): Promise<Lecture> {
    const now = this.now()
    const lecture: Lecture = {
      id: this.newId(), title: data.title, courseId: data.courseId ?? null,
      audioPath: data.audioPath ?? null, transcript: [], summary: null, notesPageId: null,
      duration: data.duration ?? null, recordedAt: new Date(), processedAt: null,
      status: 'processing', tags: [], chapters: [],
    }
    await this.storage.execute(
      `INSERT INTO lectures (id, title, course_id, audio_path, transcript, summary, notes_page_id, duration, recorded_at, processed_at, status, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [lecture.id, lecture.title, lecture.courseId, lecture.audioPath, JSON.stringify([]), null, null,
       lecture.duration, now, null, lecture.status, JSON.stringify([])],
    )
    return lecture
  }

  async update(id: string, updates: Partial<Lecture>): Promise<void> {
    const fields: string[] = []
    const values: unknown[] = []
    if (updates.transcript !== undefined) { fields.push('transcript = ?'); values.push(JSON.stringify(updates.transcript)) }
    if (updates.summary !== undefined) { fields.push('summary = ?'); values.push(updates.summary) }
    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status) }
    if (updates.notesPageId !== undefined) { fields.push('notes_page_id = ?'); values.push(updates.notesPageId) }
    if (updates.processedAt !== undefined) { fields.push('processed_at = ?'); values.push(updates.processedAt?.toISOString() ?? null) }
    if (updates.duration !== undefined) { fields.push('duration = ?'); values.push(updates.duration) }
    if (fields.length === 0) return
    values.push(id)
    await this.storage.execute(`UPDATE lectures SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async delete(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM lectures WHERE id = ?', [id])
  }

  private _row(r: LectureRow): Lecture {
    return {
      id: r.id, title: r.title, courseId: r.course_id, audioPath: r.audio_path,
      transcript: this.deserialize<TranscriptLine[]>(r.transcript, []),
      summary: r.summary, notesPageId: r.notes_page_id, duration: r.duration,
      recordedAt: new Date(r.recorded_at), processedAt: r.processed_at ? new Date(r.processed_at) : null,
      status: r.status as LectureStatus, tags: this.deserialize<string[]>(r.tags, []),
      chapters: [] as LectureChapter[],
    }
  }
}
