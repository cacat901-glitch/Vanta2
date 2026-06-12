import { BaseRepository } from './base'
import type { Task, CalendarEvent, Assignment, Exam, PomodoroSession } from '@/types'

interface TaskRow {
  id: string; title: string; description: string | null; due_at: string | null
  priority: string; course_id: string | null; estimated_minutes: number | null
  actual_minutes: number | null; status: string; recurrence: string
  parent_task_id: string | null; tags: string; created_at: string; completed_at: string | null
}

interface EventRow {
  id: string; title: string; type: string; course_id: string | null
  start_at: string; end_at: string; recurrence: string; recurrence_rule: string | null
  notes: string | null; color: string | null; location: string | null; created_at: string
}

interface AssignmentRow {
  id: string; title: string; course_id: string; due_at: string; weight: number | null
  status: string; grade: number | null; max_grade: number; notes: string | null; created_at: string
}

interface ExamRow {
  id: string; title: string; course_id: string; exam_at: string; topics: string
  difficulty: string; format: string; location: string | null; readiness_score: number | null
  grade: number | null; max_grade: number; notes: string | null; created_at: string
}

export class TaskRepository extends BaseRepository {
  // ─── Tasks ────────────────────────────────────────────────────────────

  async getAllTasks(): Promise<Task[]> {
    const rows = await this.storage.query<TaskRow>('SELECT * FROM tasks ORDER BY due_at ASC, priority ASC')
    return rows.map(this._rowToTask.bind(this))
  }

  async getTodayTasks(): Promise<Task[]> {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end = new Date(); end.setHours(23, 59, 59, 999)
    const rows = await this.storage.query<TaskRow>(
      `SELECT * FROM tasks WHERE status != 'done' AND (due_at >= ? AND due_at <= ?) ORDER BY priority ASC`,
      [start.toISOString(), end.toISOString()]
    )
    return rows.map(this._rowToTask.bind(this))
  }

  async getOverdueTasks(): Promise<Task[]> {
    const now = new Date().toISOString()
    const rows = await this.storage.query<TaskRow>(
      `SELECT * FROM tasks WHERE status NOT IN ('done', 'cancelled') AND due_at < ? ORDER BY due_at ASC`,
      [now]
    )
    return rows.map(this._rowToTask.bind(this))
  }

  async createTask(data: Partial<Task> & { title: string }): Promise<Task> {
    const now = this.now()
    const task: Task = {
      id: this.newId(), title: data.title, description: data.description ?? null,
      dueAt: data.dueAt ?? null, priority: data.priority ?? 'P3',
      courseId: data.courseId ?? null, estimatedMinutes: data.estimatedMinutes ?? null,
      actualMinutes: null, status: 'todo', recurrence: 'none',
      parentTaskId: data.parentTaskId ?? null, subtasks: [],
      tags: data.tags ?? [], createdAt: new Date(), completedAt: null,
    }
    await this.storage.execute(
      `INSERT INTO tasks (id, title, description, due_at, priority, course_id, estimated_minutes,
        status, recurrence, parent_task_id, tags, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [task.id, task.title, task.description, this.fromDate(task.dueAt),
       task.priority, task.courseId, task.estimatedMinutes,
       task.status, task.recurrence, task.parentTaskId, JSON.stringify(task.tags), now]
    )
    return task
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    const fields: string[] = []
    const values: unknown[] = []
    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title) }
    if (updates.status !== undefined) {
      fields.push('status = ?'); values.push(updates.status)
      if (updates.status === 'done') {
        fields.push('completed_at = ?'); values.push(this.now())
      }
    }
    if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority) }
    if (updates.dueAt !== undefined) { fields.push('due_at = ?'); values.push(this.fromDate(updates.dueAt)) }
    if (fields.length === 0) return
    values.push(id)
    await this.storage.execute(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async deleteTask(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM tasks WHERE id = ?', [id])
  }

  // ─── Calendar Events ─────────────────────────────────────────────────

  async getEventsInRange(from: Date, to: Date): Promise<CalendarEvent[]> {
    const rows = await this.storage.query<EventRow>(
      'SELECT * FROM calendar_events WHERE start_at >= ? AND start_at <= ? ORDER BY start_at ASC',
      [from.toISOString(), to.toISOString()]
    )
    return rows.map(this._rowToEvent.bind(this))
  }

  async createEvent(data: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> {
    const event: CalendarEvent = { ...data, id: this.newId() }
    await this.storage.execute(
      `INSERT INTO calendar_events (id, title, type, course_id, start_at, end_at, recurrence,
        recurrence_rule, notes, color, location, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.id, event.title, event.type, event.courseId,
       event.startAt.toISOString(), event.endAt.toISOString(),
       event.recurrence, event.recurrenceRule, event.notes, event.color, event.location,
       this.now()]
    )
    return event
  }

  async deleteEvent(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM calendar_events WHERE id = ?', [id])
  }

  // ─── Assignments ──────────────────────────────────────────────────────

  async getAssignmentsByCourse(courseId: string): Promise<Assignment[]> {
    const rows = await this.storage.query<AssignmentRow>(
      'SELECT * FROM assignments WHERE course_id = ? ORDER BY due_at ASC',
      [courseId]
    )
    return rows.map(this._rowToAssignment.bind(this))
  }

  async getAllAssignments(): Promise<Assignment[]> {
    const rows = await this.storage.query<AssignmentRow>(
      'SELECT * FROM assignments ORDER BY due_at ASC'
    )
    return rows.map(this._rowToAssignment.bind(this))
  }

  async createAssignment(data: Omit<Assignment, 'id' | 'createdAt'>): Promise<Assignment> {
    const assignment: Assignment = { ...data, id: this.newId(), createdAt: new Date() }
    await this.storage.execute(
      `INSERT INTO assignments (id, title, course_id, due_at, weight, status, grade, max_grade, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assignment.id, assignment.title, assignment.courseId, assignment.dueAt.toISOString(),
       assignment.weight, assignment.status, assignment.grade, assignment.maxGrade,
       assignment.notes, assignment.createdAt.toISOString()]
    )
    return assignment
  }

  // ─── Exams ────────────────────────────────────────────────────────────

  async getExamsByCourse(courseId: string): Promise<Exam[]> {
    const rows = await this.storage.query<ExamRow>(
      'SELECT * FROM exams WHERE course_id = ? ORDER BY exam_at ASC',
      [courseId]
    )
    return rows.map(this._rowToExam.bind(this))
  }

  async getUpcomingExams(days = 30): Promise<Exam[]> {
    const from = new Date().toISOString()
    const to = new Date(Date.now() + days * 86400000).toISOString()
    const rows = await this.storage.query<ExamRow>(
      'SELECT * FROM exams WHERE exam_at >= ? AND exam_at <= ? ORDER BY exam_at ASC',
      [from, to]
    )
    return rows.map(this._rowToExam.bind(this))
  }

  async createExam(data: Omit<Exam, 'id' | 'createdAt'>): Promise<Exam> {
    const exam: Exam = { ...data, id: this.newId(), createdAt: new Date() }
    await this.storage.execute(
      `INSERT INTO exams (id, title, course_id, exam_at, topics, difficulty, format, location,
        readiness_score, grade, max_grade, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [exam.id, exam.title, exam.courseId, exam.examAt.toISOString(),
       JSON.stringify(exam.topics), exam.difficulty, exam.format, exam.location,
       exam.readinessScore, exam.grade, exam.maxGrade, exam.notes, exam.createdAt.toISOString()]
    )
    return exam
  }

  // ─── Pomodoro ─────────────────────────────────────────────────────────

  async logPomodoro(session: Omit<PomodoroSession, 'id'>): Promise<PomodoroSession> {
    const ps: PomodoroSession = { ...session, id: this.newId() }
    await this.storage.execute(
      `INSERT INTO pomodoro_sessions (id, course_id, task_id, duration_minutes, completed, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ps.id, ps.courseId, ps.taskId, ps.durationMinutes, ps.completed ? 1 : 0,
       ps.startedAt.toISOString(), ps.endedAt?.toISOString() ?? null]
    )
    return ps
  }

  async getTodayPomodoros(): Promise<PomodoroSession[]> {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const rows = await this.storage.query<{
      id: string; course_id: string | null; task_id: string | null
      duration_minutes: number; completed: number; started_at: string; ended_at: string | null
    }>(
      'SELECT * FROM pomodoro_sessions WHERE started_at >= ? AND completed = 1',
      [today.toISOString()]
    )
    return rows.map(r => ({
      id: r.id, courseId: r.course_id, taskId: r.task_id,
      durationMinutes: r.duration_minutes, completed: this.toBool(r.completed),
      startedAt: new Date(r.started_at), endedAt: r.ended_at ? new Date(r.ended_at) : null,
    }))
  }

  // ─── Row mappers ────────────────────────────────────────────────────

  private _rowToTask(r: TaskRow): Task {
    return {
      id: r.id, title: r.title, description: r.description,
      dueAt: r.due_at ? new Date(r.due_at) : null,
      priority: r.priority as Task['priority'], courseId: r.course_id,
      estimatedMinutes: r.estimated_minutes, actualMinutes: r.actual_minutes,
      status: r.status as Task['status'], recurrence: r.recurrence as Task['recurrence'],
      parentTaskId: r.parent_task_id, subtasks: [],
      tags: this.deserialize<string[]>(r.tags, []),
      createdAt: new Date(r.created_at),
      completedAt: r.completed_at ? new Date(r.completed_at) : null,
    }
  }

  private _rowToEvent(r: EventRow): CalendarEvent {
    return {
      id: r.id, title: r.title, type: r.type as CalendarEvent['type'],
      courseId: r.course_id, startAt: new Date(r.start_at), endAt: new Date(r.end_at),
      recurrence: r.recurrence as CalendarEvent['recurrence'], recurrenceRule: r.recurrence_rule,
      notes: r.notes, color: r.color, location: r.location,
    }
  }

  private _rowToAssignment(r: AssignmentRow): Assignment {
    return {
      id: r.id, title: r.title, courseId: r.course_id, dueAt: new Date(r.due_at),
      weight: r.weight, status: r.status as Assignment['status'], grade: r.grade,
      maxGrade: r.max_grade, notes: r.notes, createdAt: new Date(r.created_at),
    }
  }

  private _rowToExam(r: ExamRow): Exam {
    return {
      id: r.id, title: r.title, courseId: r.course_id, examAt: new Date(r.exam_at),
      topics: this.deserialize<string[]>(r.topics, []),
      difficulty: r.difficulty as Exam['difficulty'], format: r.format as Exam['format'],
      location: r.location, readinessScore: r.readiness_score,
      grade: r.grade, maxGrade: r.max_grade, notes: r.notes, createdAt: new Date(r.created_at),
    }
  }
}
