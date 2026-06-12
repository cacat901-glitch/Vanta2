import { BaseRepository } from './base'
import type { Course } from '@/types'

interface CourseRow {
  id: string; name: string; icon: string; color: string
  semester: string | null; professor: string | null; course_code: string | null
  schedule: string; room: string | null; zoom_link: string | null
  syllabus_document_id: string | null; is_active: number; order_index: number; created_at: string
}

export class CourseRepository extends BaseRepository {
  async getAll(): Promise<Course[]> {
    const rows = await this.storage.query<CourseRow>(
      'SELECT * FROM courses ORDER BY order_index ASC, name ASC'
    )
    return rows.map(this._rowToCourse.bind(this))
  }

  async getActive(): Promise<Course[]> {
    const rows = await this.storage.query<CourseRow>(
      'SELECT * FROM courses WHERE is_active = 1 ORDER BY order_index ASC'
    )
    return rows.map(this._rowToCourse.bind(this))
  }

  async getById(id: string): Promise<Course | null> {
    const row = await this.storage.queryOne<CourseRow>('SELECT * FROM courses WHERE id = ?', [id])
    return row ? this._rowToCourse(row) : null
  }

  async create(data: Omit<Course, 'id' | 'createdAt'>): Promise<Course> {
    const course: Course = { ...data, id: this.newId(), createdAt: new Date() }
    await this.storage.execute(
      `INSERT INTO courses (id, name, icon, color, semester, professor, course_code, schedule, room,
        zoom_link, syllabus_document_id, is_active, order_index, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        course.id, course.name, course.icon, course.color,
        course.semester, course.professor, course.courseCode,
        JSON.stringify(course.schedule), course.room, course.zoomLink,
        course.syllabusDocumentId, course.isActive ? 1 : 0, 0,
        course.createdAt.toISOString(),
      ]
    )
    return course
  }

  async update(id: string, updates: Partial<Omit<Course, 'id' | 'createdAt'>>): Promise<void> {
    const fields: string[] = []
    const values: unknown[] = []
    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
    if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
    if (updates.color !== undefined) { fields.push('color = ?'); values.push(updates.color) }
    if (updates.isActive !== undefined) { fields.push('is_active = ?'); values.push(updates.isActive ? 1 : 0) }
    if (updates.schedule !== undefined) { fields.push('schedule = ?'); values.push(JSON.stringify(updates.schedule)) }
    if (fields.length === 0) return
    values.push(id)
    await this.storage.execute(`UPDATE courses SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async delete(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM courses WHERE id = ?', [id])
  }

  private _rowToCourse(r: CourseRow): Course {
    return {
      id: r.id, name: r.name, icon: r.icon,
      color: r.color as Course['color'],
      semester: r.semester, professor: r.professor, courseCode: r.course_code,
      schedule: this.deserialize(r.schedule, []),
      room: r.room, zoomLink: r.zoom_link,
      syllabusDocumentId: r.syllabus_document_id,
      isActive: this.toBool(r.is_active),
      createdAt: new Date(r.created_at),
    }
  }
}
