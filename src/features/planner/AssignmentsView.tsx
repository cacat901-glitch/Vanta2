import { useState, useMemo } from 'react'
import { Plus, GraduationCap, FileText, Calculator, Sparkles, Loader2 } from 'lucide-react'
import { differenceInDays, format } from 'date-fns'
import { usePlannerStore } from '@/store/plannerStore'
import { useCourseStore } from '@/store/courseStore'
import { useAppStore } from '@/store/appStore'
import { aiService, streamToString } from '@/services/ai'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui'
import { cn } from '@/lib/utils'

export function AssignmentsView() {
  const assignments = usePlannerStore((s) => s.assignments)
  const exams = usePlannerStore((s) => s.exams)
  const createAssignment = usePlannerStore((s) => s.createAssignment)
  const createExam = usePlannerStore((s) => s.createExam)
  const createTask = usePlannerStore((s) => s.createTask)
  const courses = useCourseStore((s) => s.courses)
  const toast = useAppStore((s) => s.addToast)

  const [dialog, setDialog] = useState<'assignment' | 'exam' | null>(null)
  const [planning, setPlanning] = useState<string | null>(null)

  // Grade calculator: current weighted grade
  const currentGrade = useMemo(() => {
    const graded = assignments.filter((a) => a.grade != null && a.weight != null)
    if (graded.length === 0) return null
    const totalWeight = graded.reduce((s, a) => s + (a.weight ?? 0), 0)
    const weightedSum = graded.reduce((s, a) => s + ((a.grade ?? 0) / a.maxGrade) * (a.weight ?? 0), 0)
    return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : null
  }, [assignments])

  const generateStudyPlan = async (examId: string) => {
    const exam = exams.find((e) => e.id === examId)
    if (!exam) return
    if (!aiService.isConfigured) {
      toast({ type: 'warning', title: 'Set up AI first' }); return
    }
    setPlanning(examId)
    try {
      const days = differenceInDays(exam.examAt, new Date())
      const stream = await aiService.chatWithSystem(
        'You are a study planner. Create concise day-by-day study plans.',
        `I have an exam "${exam.title}" in ${days} days. Topics: ${exam.topics.join(', ') || 'general'}. Create a day-by-day study plan. For each day give a short task. Return one line per day like "Day 1: ...".`,
      )
      const plan = await streamToString(stream)
      // Create tasks from the plan
      const lines = plan.split('\n').filter((l) => /day\s*\d+/i.test(l)).slice(0, days || 7)
      for (let i = 0; i < lines.length; i++) {
        const due = new Date(); due.setDate(due.getDate() + i)
        await createTask({ title: lines[i]!.replace(/^day\s*\d+:?\s*/i, '').trim(), dueAt: due, priority: 'P2', courseId: exam.courseId })
      }
      toast({ type: 'success', title: `Study plan created`, description: `${lines.length} tasks added to your task list.` })
    } catch (err) {
      toast({ type: 'error', title: 'Failed to generate plan', description: err instanceof Error ? err.message : '' })
    } finally {
      setPlanning(null)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Grade calculator */}
      {currentGrade != null && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-primary/10 border border-accent-primary/20">
          <Calculator size={20} className="text-accent-primary" />
          <div>
            <p className="text-sm text-text-muted">Current weighted grade</p>
            <p className="text-2xl font-bold text-accent-primary">{currentGrade}%</p>
          </div>
        </div>
      )}

      {/* Assignments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary"><FileText size={18} /> Assignments</h2>
          <Button size="sm" variant="outline" onClick={() => setDialog('assignment')}><Plus size={14} /> Add</Button>
        </div>
        {assignments.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No assignments tracked yet.</p>
        ) : (
          <div className="space-y-1.5">
            {assignments.map((a) => {
              const days = differenceInDays(a.dueAt, new Date())
              return (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface border border-border-subtle">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{a.title}</p>
                    <p className="text-xs text-text-muted">{courses.find((c) => c.id === a.courseId)?.name ?? 'No course'} · {a.weight ? `${a.weight}% of grade` : ''}</p>
                  </div>
                  {a.grade != null ? (
                    <span className="text-sm font-medium text-success">{a.grade}/{a.maxGrade}</span>
                  ) : (
                    <span className={cn('text-xs', days < 2 ? 'text-danger' : 'text-text-muted')}>
                      {days < 0 ? 'overdue' : days === 0 ? 'today' : `${days}d`}
                    </span>
                  )}
                  <span className={cn('text-xs px-2 py-0.5 rounded-full',
                    a.status === 'graded' ? 'bg-success/20 text-success' : a.status === 'submitted' ? 'bg-info/20 text-info' : 'bg-surface-elevated text-text-muted')}>
                    {a.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Exams */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary"><GraduationCap size={18} /> Exams</h2>
          <Button size="sm" variant="outline" onClick={() => setDialog('exam')}><Plus size={14} /> Add</Button>
        </div>
        {exams.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No exams tracked yet.</p>
        ) : (
          <div className="space-y-1.5">
            {exams.map((e) => {
              const days = differenceInDays(e.examAt, new Date())
              return (
                <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface border border-border-subtle">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{e.title}</p>
                    <p className="text-xs text-text-muted">{format(e.examAt, 'MMM d, yyyy')} · {courses.find((c) => c.id === e.courseId)?.name ?? 'No course'}</p>
                  </div>
                  <span className={cn('text-xs font-medium', days < 7 ? 'text-danger' : 'text-text-muted')}>
                    {days < 0 ? 'past' : days === 0 ? 'today!' : `${days}d`}
                  </span>
                  <Button size="sm" variant="ghost" disabled={planning === e.id} onClick={() => generateStudyPlan(e.id)}>
                    {planning === e.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Plan
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <AddDialog
        kind={dialog} courses={courses} onClose={() => setDialog(null)}
        onAddAssignment={createAssignment} onAddExam={createExam}
      />
    </div>
  )
}


// ─── Add Assignment / Exam dialog ──────────────────────────────────────
import type { Course } from '@/types'
import type { Assignment, Exam } from '@/types/planner'

function AddDialog({ kind, courses, onClose, onAddAssignment, onAddExam }: {
  kind: 'assignment' | 'exam' | null
  courses: Course[]
  onClose: () => void
  onAddAssignment: (data: Omit<Assignment, 'id' | 'createdAt'>) => Promise<Assignment>
  onAddExam: (data: Omit<Exam, 'id' | 'createdAt'>) => Promise<Exam>
}) {
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [date, setDate] = useState('')
  const [weight, setWeight] = useState('')
  const [topics, setTopics] = useState('')

  const reset = () => { setTitle(''); setCourseId(''); setDate(''); setWeight(''); setTopics('') }

  const submit = async () => {
    if (!title.trim() || !date) return
    const when = new Date(date)
    if (kind === 'assignment') {
      await onAddAssignment({ title, courseId: courseId || courses[0]?.id || '', dueAt: when, weight: weight ? Number(weight) : null, status: 'not-started', grade: null, maxGrade: 100, notes: null })
    } else {
      await onAddExam({ title, courseId: courseId || courses[0]?.id || '', examAt: when, topics: topics.split(',').map((t) => t.trim()).filter(Boolean), difficulty: 'medium', format: 'mixed', location: null, readinessScore: null, grade: null, maxGrade: 100, notes: null })
    }
    reset(); onClose()
  }

  return (
    <Dialog open={kind !== null} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{kind === 'exam' ? 'Add Exam' : 'Add Assignment'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'exam' ? 'Midterm Exam' : 'Problem Set 3'} /></div>
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>{kind === 'exam' ? 'Exam date' : 'Due date'}</Label><Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          {kind === 'assignment' ? (
            <div className="space-y-1.5"><Label>Weight (% of grade)</Label><Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="20" /></div>
          ) : (
            <div className="space-y-1.5"><Label>Topics (comma separated)</Label><Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Thermodynamics, Kinetics" /></div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={!title.trim() || !date}>Add</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
