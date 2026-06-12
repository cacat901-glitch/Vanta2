import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, Loader2, Play, Award, Send, FileText, BookOpen, GraduationCap, Layers, AlertCircle } from 'lucide-react'
import { aiService, streamToString } from '@/services/ai'
import { useAppStore } from '@/store/appStore'
import { useCourseStore } from '@/store/courseStore'
import { listKnowledgeSources, getSourceText, getCourseText, sourceTypeLabel, type KnowledgeSource } from '@/services/studyContext'
import { speak, stopSpeaking, listen, isSTTAvailable, type STTSession } from '@/lib/speech'
import { AISetupPrompt } from '@/components/ai/AISetupPrompt'
import { Button, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'

interface QA { question: string; answer: string; score?: number; feedback?: string }

export function OralExamPage() {
  const toast = useAppStore((s) => s.addToast)
  const courses = useCourseStore((s) => s.courses)
  const loadCourses = useCourseStore((s) => s.load)

  // ─── source selection (REQUIRED — no source, no exam) ──────────────────
  const [sources, setSources] = useState<KnowledgeSource[]>([])
  const [sourceKind, setSourceKind] = useState<'material' | 'course'>('material')
  const [selectedSourceId, setSelectedSourceId] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState('')

  const [phase, setPhase] = useState<'setup' | 'loading' | 'exam' | 'report'>('setup')
  const [questions, setQuestions] = useState<string[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [qas, setQas] = useState<QA[]>([])
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [report, setReport] = useState('')
  const [error, setError] = useState('')
  const sttRef = useRef<STTSession | null>(null)
  const sourceTextRef = useRef('')

  useEffect(() => {
    void loadCourses()
    void listKnowledgeSources().then((s) => setSources(s.filter((x) => x.hasContent)))
  }, [loadCourses])

  const isConfigured = aiService.isConfigured

  // ─── start: load source content, then generate grounded questions ──────
  const startExam = async () => {
    setError('')
    let text = ''
    let label = ''
    if (sourceKind === 'material') {
      if (!selectedSourceId) { setError('Pick a study material to be examined on.'); return }
      text = await getSourceText(selectedSourceId)
      label = sources.find((s) => s.id === selectedSourceId)?.title ?? 'material'
    } else {
      if (!selectedCourseId) { setError('Pick a course to be examined on.'); return }
      text = await getCourseText(selectedCourseId)
      label = courses.find((c) => c.id === selectedCourseId)?.name ?? 'course'
    }

    if (text.trim().length < 40) {
      setError('That source has no indexed content yet. Open it / add a transcript first so the exam has material to draw from.')
      return
    }

    sourceTextRef.current = text
    setPhase('loading')
    setQas([]); setQIndex(0)

    try {
      const raw = await aiService.complete(
        `You are an oral examiner. Based ONLY on the following study material titled "${label}", write 5 exam questions that test genuine understanding of its key concepts (not trivia). Return ONLY a JSON array of question strings, nothing else.\n\nMATERIAL:\n${text.slice(0, 12000)}`,
      )
      const qs = parseQuestions(raw)
      if (qs.length === 0) {
        setError('The AI did not return any questions. Try again, or pick a richer source.')
        setPhase('setup')
        return
      }
      setQuestions(qs)
      setPhase('exam')
      speak(qs[0]!)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions.')
      setPhase('setup')
    }
  }

  const currentQ = questions[qIndex] ?? ''

  const submitAnswer = async () => {
    if (!answer.trim() || busy) return
    stopSpeaking()
    setBusy(true)
    try {
      const grade = await aiService.complete(
        `Examiner grading an oral answer, using ONLY this source material as ground truth:\n${sourceTextRef.current.slice(0, 8000)}\n\nQuestion: "${currentQ}"\nStudent's answer: "${answer}"\n\nGrade the answer out of 10 for correctness and completeness, and give one sentence of specific feedback. Respond EXACTLY as: SCORE: <0-10> | <feedback>`,
      )
      const scoreMatch = grade.match(/score:\s*(\d+)/i)
      const score = scoreMatch ? Math.min(10, Number(scoreMatch[1])) : 5
      const feedback = grade.replace(/score:\s*\d+\s*\|?\s*/i, '').trim() || 'Answer recorded.'
      const newQas = [...qas, { question: currentQ, answer, score, feedback }]
      setQas(newQas)
      setAnswer('')

      const next = qIndex + 1
      if (next >= questions.length) {
        await finishExam(newQas)
      } else {
        setQIndex(next)
        speak(questions[next]!)
      }
    } catch (err) {
      toast({ type: 'error', title: 'Could not grade answer', description: err instanceof Error ? err.message : '' })
    } finally {
      setBusy(false)
    }
  }

  const finishExam = async (finalQas: QA[]) => {
    setBusy(true)
    try {
      const transcript = finalQas.map((q, i) => `Q${i + 1}: ${q.question}\nAnswer: ${q.answer}\nScore: ${q.score}/10`).join('\n\n')
      const rep = await streamToString(await aiService.chatWithSystem(
        'You are an examiner writing a concise, honest oral exam report.',
        `Write a short oral exam report based on this transcript. Give: overall grade out of 100, key strengths, specific weaknesses, and exactly what to review next.\n\n${transcript}`,
      ))
      setReport(rep)
    } catch {
      setReport('Exam complete. (Could not generate a written report.)')
    } finally {
      setPhase('report')
      setBusy(false)
    }
  }

  const toggleListen = () => {
    if (listening) { sttRef.current?.stop(); setListening(false); return }
    if (!isSTTAvailable()) { toast({ type: 'warning', title: 'Voice input not supported here', description: 'Type your answer instead.' }); return }
    sttRef.current = listen(
      (final) => { setAnswer((a) => (a ? a + ' ' : '') + final); setListening(false) },
      (interim) => setAnswer(interim),
    )
    setListening(true)
  }

  if (!isConfigured) {
    return <div className="flex h-full items-center justify-center"><div className="w-80"><AISetupPrompt /></div></div>
  }

  const avgScore = qas.length ? Math.round((qas.reduce((s, q) => s + (q.score ?? 0), 0) / qas.length) * 10) : 0

  // ─── SETUP ──────────────────────────────────────────────────────────────
  if (phase === 'setup') {
    const grouped = groupSources(sources)
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-primary/15 flex items-center justify-center"><Mic size={28} className="text-accent-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Oral Exam</h1>
            <p className="text-text-muted text-sm mt-1">Pick what you want to be examined on. The examiner asks questions grounded in that material and grades your spoken or typed answers.</p>
          </div>
        </div>

        {/* Source kind toggle */}
        <div className="flex gap-2 mb-4">
          <button onClick={() => setSourceKind('material')}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm border transition-colors',
              sourceKind === 'material' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-subtle text-text-secondary hover:bg-surface')}>
            <Layers size={15} /> A specific material
          </button>
          <button onClick={() => setSourceKind('course')}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm border transition-colors',
              sourceKind === 'course' ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-subtle text-text-secondary hover:bg-surface')}>
            <GraduationCap size={15} /> A whole course
          </button>
        </div>

        {sourceKind === 'material' ? (
          sources.length === 0 ? (
            <EmptySources />
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Choose a source</p>
              <div className="max-h-80 overflow-y-auto space-y-1 rounded-lg border border-border-subtle p-1">
                {Object.entries(grouped).map(([type, items]) => (
                  <div key={type}>
                    <p className="text-2xs text-text-muted uppercase tracking-wider px-2 py-1">{type}</p>
                    {items.map((s) => (
                      <button key={s.id} onClick={() => setSelectedSourceId(s.id)}
                        className={cn('flex items-center gap-2 w-full px-2 py-2 rounded-md text-left text-sm transition-colors',
                          selectedSourceId === s.id ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-secondary hover:bg-surface')}>
                        <SourceIcon type={s.type} />
                        <span className="truncate flex-1">{s.title}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Choose a course</p>
            {courses.length === 0 ? (
              <p className="text-sm text-text-muted py-4">No courses yet. Create one and link materials to it.</p>
            ) : courses.map((c) => (
              <button key={c.id} onClick={() => setSelectedCourseId(c.id)}
                className={cn('flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm border transition-colors',
                  selectedCourseId === c.id ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' : 'border-border-subtle text-text-secondary hover:bg-surface')}>
                <span>{c.icon}</span> {c.name}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger">
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        <Button className="w-full mt-5" onClick={startExam}
          disabled={sourceKind === 'material' ? !selectedSourceId : !selectedCourseId}>
          <Play size={15} /> Start Oral Exam
        </Button>
      </div>
    )
  }

  // ─── LOADING ────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Loader2 className="animate-spin text-accent-primary" size={28} />
        <p className="text-sm text-text-muted">Reading your material and preparing questions…</p>
      </div>
    )
  }

  // ─── EXAM ───────────────────────────────────────────────────────────────
  if (phase === 'exam') {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Question {qIndex + 1} of {questions.length}</span>
          <button onClick={() => speak(currentQ)} className="text-accent-primary hover:text-accent-hover" title="Repeat question"><Volume2 size={18} /></button>
        </div>
        <div className="rounded-xl border border-border-default bg-surface p-5">
          <p className="text-lg text-text-primary">{currentQ}</p>
        </div>
        <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} placeholder="Speak or type your answer…" />
        <div className="flex gap-2">
          <Button variant={listening ? 'destructive' : 'outline'} onClick={toggleListen}>
            {listening ? <><MicOff size={15} /> Stop</> : <><Mic size={15} /> Speak</>}
          </Button>
          <Button className="flex-1" onClick={submitAnswer} disabled={busy || !answer.trim()}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Submit Answer
          </Button>
        </div>
        {qas.length > 0 && (
          <div className="space-y-1.5 pt-2">
            {qas.map((qa, i) => (
              <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-surface/50">
                <span className={cn('font-medium', (qa.score ?? 0) >= 6 ? 'text-success' : 'text-warning')}>{qa.score}/10</span>
                <span className="text-text-muted truncate flex-1">{qa.question}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── REPORT ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center"><Award size={30} className="text-success" /></div>
        <h2 className="text-2xl font-bold text-text-primary">{avgScore}%</h2>
        <p className="text-text-muted text-sm">Overall oral exam score</p>
      </div>
      <div className="rounded-xl border border-border-subtle bg-surface p-4">
        <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{report}</p>
      </div>
      <Button className="w-full" onClick={() => { setPhase('setup'); setReport(''); setQuestions([]); setQas([]) }}>New Exam</Button>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────
function parseQuestions(raw: string): string[] {
  // Try JSON array first
  const match = raw.match(/\[[\s\S]*\]/)
  if (match) {
    try {
      const arr = JSON.parse(match[0]) as unknown[]
      const qs = arr.map((x) => String(x).trim()).filter(Boolean)
      if (qs.length) return qs.slice(0, 8)
    } catch { /* fall through */ }
  }
  // Fallback: line-based, strip numbering
  return raw.split('\n')
    .map((l) => l.replace(/^\s*[-*\d.)]+\s*/, '').trim())
    .filter((l) => l.length > 8 && l.includes('?'))
    .slice(0, 8)
}

function groupSources(sources: KnowledgeSource[]): Record<string, KnowledgeSource[]> {
  return sources.reduce<Record<string, KnowledgeSource[]>>((acc, s) => {
    const label = sourceTypeLabel(s.type)
    ;(acc[label] ??= []).push(s)
    return acc
  }, {})
}

function SourceIcon({ type }: { type: KnowledgeSource['type'] }) {
  if (type === 'pdf') return <FileText size={14} className="text-danger flex-shrink-0" />
  if (type === 'page') return <BookOpen size={14} className="text-accent-primary flex-shrink-0" />
  return <Layers size={14} className="text-text-muted flex-shrink-0" />
}

function EmptySources() {
  return (
    <div className="text-center py-10 px-4 rounded-lg border border-dashed border-border-default">
      <Layers size={28} className="text-text-muted mx-auto mb-2" />
      <p className="text-sm font-medium text-text-primary">No study material yet</p>
      <p className="text-xs text-text-muted mt-1">
        Import a PDF, add a lecture transcript, save a YouTube transcript, or write a notebook page.
        Once it's indexed it will appear here as an exam source.
      </p>
    </div>
  )
}
