import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  BookCopy, Plus, BookOpen, Brain, FileText, CheckSquare,
  GraduationCap, Loader2, Pencil, Trash2, Check, X,
  BarChart3, Clock, Target, TrendingUp, Mic, Film,
  ChevronRight, ExternalLink, Layers,
} from 'lucide-react'
import { useCourseStore } from '@/store/courseStore'
import { useFlashcardStore } from '@/store/flashcardStore'
import { usePlannerStore } from '@/store/plannerStore'
import { useDocumentStore } from '@/store/documentStore'
import { useMediaStore } from '@/store/mediaStore'
import { useLectureStore } from '@/store/lectureStore'
import { getDB } from '@/db'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui'
import { cn, relativeDate } from '@/lib/utils'
import { differenceInDays, format } from 'date-fns'
import type { Course } from '@/types'
import type { CourseColor } from '@/types/course'

// ─── colour / emoji options ───────────────────────────────────────────
const COURSE_COLORS: CourseColor[] = [
  '#7C6FFF', '#3ECFB2', '#FFBB38', '#FF5263',
  '#4DA6FF', '#4CAF50', '#E91E8C', '#FF9040',
  '#00BCD4', '#8BC34A',
]
const COURSE_EMOJIS = ['📚', '🔬', '🧮', '🌍', '🎨', '💻', '⚗️', '📐', '🏛️', '🎵', '🧠', '📝', '🌱', '⚖️', '🎭']

// ─── aggregated stats for one course ─────────────────────────────────
interface CourseAgg {
  notebookCount: number
  pageCount: number
  pdfCount: number
  deckCount: number
  totalCards: number
  dueCards: number
  tasksDone: number
  tasksTotal: number
  assignmentCount: number
  examCount: number
  lectureCount: number
  videoCount: number
  studyHoursThisWeek: number
  retentionRate: number | null
  upcomingExam: { title: string; daysLeft: number } | null
  currentGrade: number | null
}

// ─── Main CoursesPage ─────────────────────────────────────────────────
export function CoursesPage() {
  const { courseId } = useParams()
  const navigate = useNavigate()
  const courses = useCourseStore(s => s.courses)
  const loadCourses = useCourseStore(s => s.load)
  const createCourse = useCourseStore(s => s.create)
  const deleteCourse = useCourseStore(s => s.delete)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => { void loadCourses() }, [loadCourses])

  const selectedCourse = courseId ? courses.find(c => c.id === courseId) : null

  if (selectedCourse) {
    return <CourseDetailPage course={selectedCourse} onBack={() => navigate('/courses')} />
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Courses</h1>
          <p className="text-sm text-text-muted mt-0.5">All your study materials organised by course</p>
        </div>
        <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
          <Plus size={14} /> New Course
        </Button>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center">
            <BookCopy size={28} className="text-text-muted" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">No courses yet</h2>
            <p className="text-text-muted text-sm mt-1">
              Create a course to link all your notebooks, PDFs, flashcards, and assignments together
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}><Plus size={14} /> Create first course</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map(course => (
            <CourseCard
              key={course.id}
              course={course}
              onClick={() => navigate(`/courses/${course.id}`)}
              onDelete={() => {
                if (confirm(`Delete course "${course.name}"? This only removes the course — your notebooks and files stay.`))
                  void deleteCourse(course.id)
              }}
            />
          ))}
        </div>
      )}

      <CreateCourseDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={course => { void loadCourses(); navigate(`/courses/${course.id}`) }}
      />
    </div>
  )
}

// ─── Course card (grid) ───────────────────────────────────────────────
function CourseCard({ course, onClick, onDelete }: { course: Course; onClick: () => void; onDelete: () => void }) {
  return (
    <div className="group relative rounded-xl border border-border-subtle bg-surface hover:border-opacity-80 transition-colors overflow-hidden"
      style={{ borderLeftColor: course.color, borderLeftWidth: '3px' }}>
      <button onClick={onClick} className="w-full text-left p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">{course.icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-text-primary truncate">{course.name}</p>
            <p className="text-xs text-text-muted truncate">
              {[course.semester, course.professor].filter(Boolean).join(' · ') || 'No details'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <ChevronRight size={12} className="text-accent-primary" />
          <span className="text-accent-primary font-medium">View course</span>
        </div>
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
      ><Trash2 size={12} /></button>
    </div>
  )
}

// ─── Course detail (full overview) ───────────────────────────────────
function CourseDetailPage({ course, onBack }: { course: Course; onBack: () => void }) {
  const navigate = useNavigate()
  const updateCourse = useCourseStore(s => s.update)

  // cross-store data
  const decks = useFlashcardStore(s => s.decks)
  const tasks = usePlannerStore(s => s.tasks)
  const assignments = usePlannerStore(s => s.assignments)
  const exams = usePlannerStore(s => s.exams)
  const documents = useDocumentStore(s => s.documents)
  const mediaItems = useMediaStore(s => s.items)
  const lectures = useLectureStore(s => s.lectures)

  const loadDecks = useFlashcardStore(s => s.loadDecks)
  const loadTasks = usePlannerStore(s => s.loadTasks)
  const loadAssignments = usePlannerStore(s => s.loadAssignments)
  const loadExams = usePlannerStore(s => s.loadExams)
  const loadDocuments = useDocumentStore(s => s.load)
  const loadMedia = useMediaStore(s => s.load)
  const loadLectures = useLectureStore(s => s.load)

  const [agg, setAgg] = useState<CourseAgg | null>(null)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(course.name)
  const [editProfessor, setEditProfessor] = useState(course.professor ?? '')
  const [editSemester, setEditSemester] = useState(course.semester ?? '')
  const [editRoom, setEditRoom] = useState(course.room ?? '')
  const [editZoom, setEditZoom] = useState(course.zoomLink ?? '')

  // Load everything on mount
  useEffect(() => {
    void loadDecks()
    void loadTasks()
    void loadAssignments()
    void loadExams()
    void loadDocuments()
    void loadMedia()
    void loadLectures()
  }, [loadDecks, loadTasks, loadAssignments, loadExams, loadDocuments, loadMedia, loadLectures])

  // Compute aggregated stats
  const computeAgg = useCallback(async () => {
    const db = await getDB()

    const kObjects = await db.knowledge.getAll()
    const courseKObjects = kObjects.filter(o => o.courseId === course.id)

    const courseDecks = decks.filter(d => d.courseId === course.id)
    const courseTasks = tasks.filter(t => t.courseId === course.id)
    const courseAssignments = assignments.filter(a => a.courseId === course.id)
    const courseExams = exams.filter(e => e.courseId === course.id)
    const courseDocuments = documents.filter(d => d.courseId === course.id)
    const courseVideos = mediaItems.filter(m => m.courseId === course.id && m.type === 'youtube')
    const courseLectures = lectures.filter(l => l.courseId === course.id)

    // Page count from knowledge objects of type 'page' with this courseId
    const pageCount = courseKObjects.filter(o => o.type === 'page').length

    // Total flashcards
    const totalCards = courseDecks.reduce((s, d) => s + d.cardCount, 0)
    const dueCards = courseDecks.reduce((s, d) => s + d.dueCount, 0)

    // Study hours this week
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0, 0, 0, 0)
    const weekActivity = await db.activity.getActivityByDateRange(weekStart, new Date())
    const courseActivity = weekActivity.filter(a => a.courseId === course.id)
    const studyHoursThisWeek = courseActivity.reduce((s, a) => s + (a.durationSeconds ?? 0), 0) / 3600

    // Retention rate across all decks
    let retentionRate: number | null = null
    if (courseDecks.length > 0) {
      const allReviews: Array<{ rating: number }> = []
      for (const deck of courseDecks) {
        const reviews = await db.flashcards.getRecentReviews(deck.id, 30)
        allReviews.push(...reviews)
      }
      if (allReviews.length > 0) {
        const good = allReviews.filter(r => r.rating >= 3).length
        retentionRate = Math.round((good / allReviews.length) * 100)
      }
    }

    // Upcoming exam
    const upcomingExam = courseExams
      .filter(e => e.examAt > new Date())
      .sort((a, b) => a.examAt.getTime() - b.examAt.getTime())[0]

    // Current grade from assignments
    const gradedAssignments = courseAssignments.filter(a => a.grade != null && a.weight != null)
    let currentGrade: number | null = null
    if (gradedAssignments.length > 0) {
      const totalWeight = gradedAssignments.reduce((s, a) => s + (a.weight ?? 0), 0)
      const weightedSum = gradedAssignments.reduce((s, a) => s + ((a.grade ?? 0) / a.maxGrade) * (a.weight ?? 0), 0)
      if (totalWeight > 0) currentGrade = Math.round((weightedSum / totalWeight) * 100)
    }

    setAgg({
      notebookCount: 0,
      pageCount,
      pdfCount: courseDocuments.length,
      deckCount: courseDecks.length,
      totalCards,
      dueCards,
      tasksDone: courseTasks.filter(t => t.status === 'done').length,
      tasksTotal: courseTasks.length,
      assignmentCount: courseAssignments.length,
      examCount: courseExams.length,
      lectureCount: courseLectures.length,
      videoCount: courseVideos.length,
      studyHoursThisWeek: Math.round(studyHoursThisWeek * 10) / 10,
      retentionRate,
      upcomingExam: upcomingExam ? {
        title: upcomingExam.title,
        daysLeft: differenceInDays(upcomingExam.examAt, new Date()),
      } : null,
      currentGrade,
    })
  }, [course.id, decks, tasks, assignments, exams, documents, mediaItems, lectures])

  useEffect(() => { void computeAgg() }, [computeAgg])

  const handleSaveEdit = async () => {
    await updateCourse(course.id, {
      name: editName.trim() || course.name,
      professor: editProfessor || null,
      semester: editSemester || null,
      room: editRoom || null,
      zoomLink: editZoom || null,
    })
    setEditing(false)
  }

  // ── render ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-start gap-4 p-6 border-b border-border-subtle"
        style={{ borderTopColor: course.color, borderTopWidth: '3px' }}>
        <button onClick={onBack} className="text-text-muted hover:text-text-primary text-xs mt-1">← Back</button>
        <div className="flex-1">
          {editing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="text-lg font-bold" placeholder="Course name" />
                <button onClick={handleSaveEdit} className="text-success"><Check size={18} /></button>
                <button onClick={() => setEditing(false)} className="text-text-muted"><X size={18} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={editProfessor} onChange={e => setEditProfessor(e.target.value)} placeholder="Professor" />
                <Input value={editSemester} onChange={e => setEditSemester(e.target.value)} placeholder="Semester (e.g. Fall 2025)" />
                <Input value={editRoom} onChange={e => setEditRoom(e.target.value)} placeholder="Room / location" />
                <Input value={editZoom} onChange={e => setEditZoom(e.target.value)} placeholder="Zoom link" />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="text-4xl">{course.icon}</span>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-text-primary">{course.name}</h1>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-text-muted">
                  {course.professor && <span>👤 {course.professor}</span>}
                  {course.semester && <span>📅 {course.semester}</span>}
                  {course.room && <span>📍 {course.room}</span>}
                  {course.zoomLink && (
                    <a href={course.zoomLink} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-accent-primary hover:underline">
                      <ExternalLink size={12} /> Join
                    </a>
                  )}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil size={13} /> Edit
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats overview */}
      {agg ? (
        <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard icon={Clock} label="Hours this week" value={`${agg.studyHoursThisWeek}h`} color="text-accent-primary" />
            <MetricCard icon={Brain} label="Retention" value={agg.retentionRate != null ? `${agg.retentionRate}%` : '—'} color="text-success" />
            <MetricCard icon={Target} label="Current grade" value={agg.currentGrade != null ? `${agg.currentGrade}%` : '—'} color="text-warning" />
            <MetricCard icon={TrendingUp} label="Due cards" value={`${agg.dueCards}`} color="text-danger" />
          </div>

          {/* Upcoming exam alert */}
          {agg.upcomingExam && (
            <div className={cn(
              'flex items-center gap-3 p-4 rounded-xl border',
              agg.upcomingExam.daysLeft <= 3
                ? 'bg-danger/10 border-danger/30'
                : agg.upcomingExam.daysLeft <= 7
                  ? 'bg-warning/10 border-warning/30'
                  : 'bg-info/10 border-info/30'
            )}>
              <GraduationCap size={20} className={agg.upcomingExam.daysLeft <= 7 ? 'text-warning' : 'text-info'} />
              <div>
                <p className="text-sm font-semibold text-text-primary">{agg.upcomingExam.title}</p>
                <p className="text-xs text-text-muted">
                  {agg.upcomingExam.daysLeft === 0 ? 'Today!' : `${agg.upcomingExam.daysLeft} days away`}
                </p>
              </div>
              <Button size="sm" variant="outline" className="ml-auto" onClick={() => navigate('/planner')}>
                Study plan
              </Button>
            </div>
          )}

          {/* Content sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Notebooks */}
            <ContentSection
              icon={BookOpen}
              title="Notebooks"
              count={agg.pageCount}
              action={{ label: 'Open', onClick: () => navigate('/notebooks') }}
              color={course.color}
            >
              <p className="text-xs text-text-muted px-2 py-1.5">
                Link individual <strong className="text-text-secondary">pages</strong> to this course using the
                {' '}<strong className="text-text-secondary">Attachments panel</strong> (📎 icon) in the page editor.
                Pages linked here will appear in search and the knowledge graph.
              </p>
              <button onClick={() => navigate('/notebooks')}
                className="flex items-center gap-1.5 text-xs text-accent-primary hover:underline px-2 py-1">
                Open Notebooks →
              </button>
            </ContentSection>

            {/* PDFs */}
            <ContentSection
              icon={FileText}
              title="PDFs & Documents"
              count={agg.pdfCount}
              action={{ label: 'Manage', onClick: () => navigate('/pdf') }}
              color={course.color}
            >
              {documents
                .filter(d => d.courseId === course.id)
                .slice(0, 4)
                .map(doc => (
                  <ContentRow
                    key={doc.id}
                    icon="📄"
                    label={doc.title}
                    sub={`${doc.pageCount ?? '?'} pages`}
                    onClick={() => navigate('/pdf')}
                  />
                ))}
              {agg.pdfCount === 0 && (
                <EmptyRow text="No PDFs linked" action="Import PDF →" onClick={() => navigate('/pdf')} />
              )}
            </ContentSection>

            {/* Flashcard decks */}
            <ContentSection
              icon={Brain}
              title="Flashcard Decks"
              count={agg.deckCount}
              action={{ label: 'Study', onClick: () => navigate('/flashcards') }}
              color={course.color}
            >
              {decks
                .filter(d => d.courseId === course.id)
                .slice(0, 4)
                .map(deck => (
                  <ContentRow
                    key={deck.id}
                    icon="🃏"
                    label={deck.name}
                    sub={`${deck.cardCount} cards · ${deck.dueCount} due`}
                    badge={deck.dueCount > 0 ? `${deck.dueCount} due` : undefined}
                    badgeColor="text-accent-primary"
                    onClick={() => navigate(`/flashcards/${deck.id}`)}
                  />
                ))}
              {agg.deckCount === 0 && (
                <EmptyRow text="No decks yet" action="Create deck →" onClick={() => navigate('/flashcards')} />
              )}
            </ContentSection>

            {/* Tasks */}
            <ContentSection
              icon={CheckSquare}
              title="Tasks"
              count={agg.tasksTotal}
              action={{ label: 'View all', onClick: () => navigate('/planner') }}
              color={course.color}
            >
              {tasks
                .filter(t => t.courseId === course.id && t.status !== 'done')
                .slice(0, 4)
                .map(task => (
                  <ContentRow
                    key={task.id}
                    icon={task.priority === 'P1' ? '🔴' : task.priority === 'P2' ? '🟡' : '🟢'}
                    label={task.title}
                    sub={task.dueAt ? format(task.dueAt, 'MMM d') : 'No due date'}
                    onClick={() => navigate('/planner')}
                  />
                ))}
              {agg.tasksTotal === 0 && (
                <EmptyRow text="No tasks" action="Add task →" onClick={() => navigate('/planner')} />
              )}
            </ContentSection>

            {/* Assignments */}
            <ContentSection
              icon={GraduationCap}
              title="Assignments"
              count={agg.assignmentCount}
              action={{ label: 'Track', onClick: () => navigate('/planner') }}
              color={course.color}
            >
              {assignments
                .filter(a => a.courseId === course.id)
                .slice(0, 4)
                .map(a => {
                  const days = differenceInDays(a.dueAt, new Date())
                  return (
                    <ContentRow
                      key={a.id}
                      icon="📋"
                      label={a.title}
                      sub={a.grade != null ? `Grade: ${a.grade}/${a.maxGrade}` : `Due ${format(a.dueAt, 'MMM d')}`}
                      badge={a.grade != null ? `${Math.round(a.grade / a.maxGrade * 100)}%` : days < 3 ? 'Soon' : undefined}
                      badgeColor={days < 3 ? 'text-danger' : 'text-success'}
                      onClick={() => navigate('/planner')}
                    />
                  )
                })}
              {agg.assignmentCount === 0 && (
                <EmptyRow text="No assignments" action="Add assignment →" onClick={() => navigate('/planner')} />
              )}
            </ContentSection>

            {/* Grade calculator */}
            <GradeCalculator
              assignments={assignments.filter(a => a.courseId === course.id)}
              color={course.color}
            />

            {/* Lectures */}
            <ContentSection
              icon={Mic}
              title="Lectures"
              count={agg.lectureCount}
              action={{ label: 'View', onClick: () => navigate('/lectures') }}
              color={course.color}
            >
              {lectures
                .filter(l => l.courseId === course.id)
                .slice(0, 3)
                .map(l => (
                  <ContentRow
                    key={l.id}
                    icon="🎙️"
                    label={l.title}
                    sub={relativeDate(l.recordedAt)}
                    onClick={() => navigate('/lectures')}
                  />
                ))}
              {agg.lectureCount === 0 && (
                <EmptyRow text="No lectures recorded" action="Record lecture →" onClick={() => navigate('/lectures')} />
              )}
            </ContentSection>

            {/* Videos */}
            <ContentSection
              icon={Film}
              title="Study Videos"
              count={agg.videoCount}
              action={{ label: 'View', onClick: () => navigate('/media') }}
              color={course.color}
            >
              {mediaItems
                .filter(m => m.courseId === course.id && m.type === 'youtube')
                .slice(0, 3)
                .map(v => (
                  <ContentRow
                    key={v.id}
                    icon="▶️"
                    label={v.title ?? 'Video'}
                    sub={v.channelName ?? undefined}
                    onClick={() => navigate('/media')}
                  />
                ))}
              {agg.videoCount === 0 && (
                <EmptyRow text="No study videos linked" action="Add YouTube video →" onClick={() => navigate('/media')} />
              )}
            </ContentSection>

            {/* Quick actions */}
            <div className="rounded-xl border border-border-subtle bg-surface p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Layers size={15} className="text-accent-primary" /> Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '+ Notebook', action: () => navigate('/notebooks'), icon: '📓' },
                  { label: '+ PDF', action: () => navigate('/pdf'), icon: '📄' },
                  { label: '+ Flashcards', action: () => navigate('/flashcards'), icon: '🃏' },
                  { label: '+ Task', action: () => navigate('/planner'), icon: '✅' },
                  { label: '+ Assignment', action: () => navigate('/planner'), icon: '📋' },
                  { label: '+ Exam', action: () => navigate('/planner'), icon: '🎓' },
                ].map(q => (
                  <button key={q.label} onClick={q.action}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-elevated hover:bg-surface border border-border-subtle text-xs text-text-secondary hover:text-text-primary transition-colors text-left">
                    <span>{q.icon}</span> {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-accent-primary" />
        </div>
      )}
    </div>
  )
}

// ─── Grade calculator ─────────────────────────────────────────────────
function GradeCalculator({ assignments, color }: {
  assignments: Array<{ id: string; title: string; grade: number | null; maxGrade: number; weight: number | null; dueAt: Date; status: string }>
  color: string
}) {
  const graded = assignments.filter(a => a.grade != null && a.weight != null)
  const totalWeight = graded.reduce((s, a) => s + (a.weight ?? 0), 0)
  const weightedSum = graded.reduce((s, a) => s + ((a.grade ?? 0) / a.maxGrade) * (a.weight ?? 0), 0)
  const current = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : null
  const remaining = assignments.filter(a => a.grade == null && a.weight != null)
  const remainingWeight = remaining.reduce((s, a) => s + (a.weight ?? 0), 0)

  const [target, setTarget] = useState(85)
  const needed = remainingWeight > 0 && current != null
    ? Math.round(((target - (current * totalWeight / 100)) / remainingWeight) * 100)
    : null

  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4" style={{ borderTopColor: color, borderTopWidth: '2px' }}>
      <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
        <BarChart3 size={15} className="text-accent-primary" /> Grade Calculator
      </h3>
      <div className="space-y-3">
        {current != null ? (
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color }}>{current}%</p>
              <p className="text-xs text-text-muted">Current</p>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-elevated overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(current, 100)}%`, backgroundColor: color }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-muted">{totalWeight}%</p>
              <p className="text-xs text-text-muted">Counted</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-muted">No graded assignments yet.</p>
        )}

        {remainingWeight > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-text-muted">To get</span>
            <input
              type="number" min={0} max={100} value={target}
              onChange={e => setTarget(Number(e.target.value))}
              className="w-14 bg-surface-elevated border border-border-default rounded px-1.5 py-0.5 text-text-primary text-center outline-none"
            />
            <span className="text-text-muted">% overall, you need</span>
            {needed != null && (
              <span className={cn('font-semibold', needed > 100 ? 'text-danger' : 'text-success')}>
                {needed > 100 ? 'not possible' : `${needed}% avg`}
              </span>
            )}
            <span className="text-text-muted">on remaining {remainingWeight}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Reusable sub-components ──────────────────────────────────────────
function MetricCard({ icon: Icon, label, value, color }: { icon: typeof Clock; label: string; value: string; color: string }) {
  return (
    <div className="p-4 rounded-xl bg-surface border border-border-subtle">
      <Icon size={16} className={cn('mb-2', color)} />
      <p className="text-xl font-bold text-text-primary">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}

function ContentSection({ icon: Icon, title, count, action, color, children }: {
  icon: typeof BookOpen; title: string; count: number; color: string
  action: { label: string; onClick: () => void }; children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface overflow-hidden"
      style={{ borderTopColor: color, borderTopWidth: '2px' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">{title}</span>
          <span className="text-xs text-text-muted">({count})</span>
        </div>
        <button onClick={action.onClick} className="text-xs text-accent-primary hover:underline">{action.label}</button>
      </div>
      <div className="p-2">{children}</div>
    </div>
  )
}

function ContentRow({ icon, label, sub, badge, badgeColor, onClick }: {
  icon: string; label: string; sub?: string; badge?: string; badgeColor?: string; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md hover:bg-surface-elevated transition-colors text-left group">
      <span className="text-sm flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate group-hover:text-accent-primary transition-colors">{label}</p>
        {sub && <p className="text-2xs text-text-muted truncate">{sub}</p>}
      </div>
      {badge && <span className={cn('text-2xs font-medium flex-shrink-0', badgeColor)}>{badge}</span>}
    </button>
  )
}

function EmptyRow({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between px-2 py-2">
      <span className="text-xs text-text-muted">{text}</span>
      <button onClick={onClick} className="text-2xs text-accent-primary hover:underline">{action}</button>
    </div>
  )
}

// ─── Create course dialog ─────────────────────────────────────────────
function CreateCourseDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (c: Course) => void
}) {
  const createCourse = useCourseStore(s => s.create)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(COURSE_EMOJIS[0]!)
  const [color, setColor] = useState(COURSE_COLORS[0]!)
  const [professor, setProfessor] = useState('')
  const [semester, setSemester] = useState('')
  const [room, setRoom] = useState('')
  const [zoomLink, setZoomLink] = useState('')
  const [loading, setLoading] = useState(false)

  const reset = () => {
    setName(''); setProfessor(''); setSemester(''); setRoom(''); setZoomLink('')
    setIcon(COURSE_EMOJIS[0]!); setColor(COURSE_COLORS[0]!)
  }

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      const c = await createCourse({
        name: name.trim(), icon, color,
        professor: professor || null, semester: semester || null,
        courseCode: null, schedule: [], room: room || null,
        zoomLink: zoomLink || null, syllabusDocumentId: null, isActive: true,
      })
      reset()
      onCreated(c)
      onOpenChange(false)
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Course</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Emoji picker */}
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-1">
              {COURSE_EMOJIS.map(em => (
                <button key={em} onClick={() => setIcon(em)}
                  className={cn('text-xl p-1.5 rounded-lg border transition-colors',
                    icon === em ? 'border-accent-primary bg-accent-primary/10' : 'border-transparent hover:border-border-default')}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <Label>Colour</Label>
            <div className="flex gap-2">
              {COURSE_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={cn('w-7 h-7 rounded-full border-2 transition-transform hover:scale-110',
                    color === c ? 'border-white scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Course name *</Label>
            <Input
              autoFocus value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }}
              placeholder="e.g. Organic Chemistry, Linear Algebra"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Professor</Label>
              <Input value={professor} onChange={e => setProfessor(e.target.value)} placeholder="Dr. Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Semester</Label>
              <Input value={semester} onChange={e => setSemester(e.target.value)} placeholder="Fall 2025" />
            </div>
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Input value={room} onChange={e => setRoom(e.target.value)} placeholder="Room 201" />
            </div>
            <div className="space-y-1.5">
              <Label>Zoom link</Label>
              <Input value={zoomLink} onChange={e => setZoomLink(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { reset(); onOpenChange(false) }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || loading}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Create Course
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
