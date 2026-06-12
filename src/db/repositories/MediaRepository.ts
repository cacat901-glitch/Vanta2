import { BaseRepository } from './base'
import type { MediaItem, MediaType, MediaTranscriptLine } from '@/types/media'

interface MediaRow {
  id: string; type: string; url: string; title: string | null
  thumbnail: string | null; duration: number | null; channel_name: string | null
  course_id: string | null; transcript: string | null; file_path: string | null
  tags: string; added_at: string; metadata: string
}

export class MediaRepository extends BaseRepository {
  async getAll(type?: MediaType): Promise<MediaItem[]> {
    const rows = type
      ? await this.storage.query<MediaRow>('SELECT * FROM media_items WHERE type = ? ORDER BY added_at DESC', [type])
      : await this.storage.query<MediaRow>('SELECT * FROM media_items ORDER BY added_at DESC')
    return rows.map(this._row.bind(this))
  }

  async getById(id: string): Promise<MediaItem | null> {
    const row = await this.storage.queryOne<MediaRow>('SELECT * FROM media_items WHERE id = ?', [id])
    return row ? this._row(row) : null
  }

  async create(data: Omit<MediaItem, 'id' | 'addedAt'>): Promise<MediaItem> {
    const item: MediaItem = { ...data, id: this.newId(), addedAt: new Date() }
    await this.storage.execute(
      `INSERT INTO media_items (id, type, url, title, thumbnail, duration, channel_name, course_id, transcript, file_path, tags, added_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.type, item.url, item.title, item.thumbnail, item.duration, item.channelName, item.courseId,
       item.transcript ? JSON.stringify(item.transcript) : null, item.filePath, JSON.stringify(item.tags),
       item.addedAt.toISOString(), JSON.stringify(item.metadata)],
    )
    return item
  }

  async updateTranscript(id: string, transcript: MediaTranscriptLine[]): Promise<void> {
    await this.storage.execute('UPDATE media_items SET transcript = ? WHERE id = ?', [JSON.stringify(transcript), id])
  }

  async delete(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM media_items WHERE id = ?', [id])
  }

  private _row(r: MediaRow): MediaItem {
    return {
      id: r.id, type: r.type as MediaType, url: r.url, title: r.title,
      thumbnail: r.thumbnail, duration: r.duration, channelName: r.channel_name,
      courseId: r.course_id, transcript: this.deserialize(r.transcript, null),
      filePath: r.file_path, tags: this.deserialize<string[]>(r.tags, []),
      addedAt: new Date(r.added_at), metadata: this.deserialize<Record<string, unknown>>(r.metadata, {}),
    }
  }
}
