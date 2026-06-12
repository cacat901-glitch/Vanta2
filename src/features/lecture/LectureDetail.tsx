import { useEffect, useState } from 'react'
import { ArrowLeft, Sparkles, FileText, Brain, ListChecks, BookOpen, Loader2, Wand2 } from 'lucide-react'
import { useLectureStore } from '@/store/lectureStore'
import { useFlashcardStore } from '@/store/flashcardStore'
import { useAppStore } from '@/store/appStore'
import { aiService, streamToString } from '@/services/ai'
import { ingest, knowledgeId } from '@/services/knowledgeEngine'
import { Button, Textarea } from '@/components/ui'
import type { Lecture, TranscriptLine } from '@/types/knowledge'

interface Outputs { summary?: string; notes?: string; quiz?: string; studyGuide?: string }

export function LectureDetail({ lectureId, onBack }: { lectureId: string; onBack: () => void }) {
  const getById = useLectureStore((s) => s.getById)
  const update = useLectureStore((s) => s.update)
  const toast = useAppStore((s) => s.addToast)
  const [lecture, setLecture] = useState<Lecture | null>(null)
  const [transcript, setTranscript] = useState('')
  const [outputs, setOutputs] = useState<Outputs>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    void getById(lectureId).then((l) => {
      setLecture(l)
      if (l) {
        setTranscript(l.transcript.map((t) => t.text).join('\n'))
        setOutputs({ summary: l.summary ?? undefined })
      }
    })
  }, [lectureId, getById])

  const saveTranscript = async () => {
    const lines: TranscriptLine[] = transcript.split('\n').filter(Boolean).map((text, i) => ({ text, startTime: i * 5, endTime: (i + 1) * 5 }))
    await update(lectureId, { transcript: lines })
    // Index the transcript into the knowledge base so the tutor, quiz/flashcard
    // generators, oral exam, and chat can all use this lecture.
    ingest({
      id: knowledgeId.lecture(lectureId),
      type: 'lecture',
      title: lecture?.title ?? 'Lecture',
      content: transcript,
      courseId: lecture?.courseId ?? null,
    })
    toast({ type: 'success', title: 'Transcript saved' })
  }

  const processAll = async () => {
    if (!transcript.trim()) { toast({ type: 'warning', title: 'Add a transcript first' }); return }
    if (!aiService.isConfigured) { toast({ type: 'warning', title: 'Set up AI in Settings' }); return }
    await saveTranscript()
    setBusy('all')
    try {
      const summary = await streamToString(await aiService.summarize(transcript, 'paragraph'))
      const notes = await aiService.complete(`Turn this lecture transcript into clean, structured study notes with headings and bullet points:\n\n${transcript.slice(0, 10000)}`)
      const quiz = await streamToString(await aiService.generateQuestions(transcript, 10, 'mixed', 'medium'))
      const studyGuide = await aiService.complete(`Create a concise exam study guide from this lecture, organized by topic with key points:\n\n${transcript.slice(0, 10000)}`)
      setOutputs({ summary, notes, quiz, studyGuide })
      await update(lectureId, { summary, status: 'ready', processedAt: new Date() })
      toast({ type: 'success', title: 'Lecture processed', description: 'Summary, notes, quiz, and study guide generated.' })
    } catch (err) {
      toast({ type: 'error', title: 'Processing failed', description: err instanceof Error ? err.message : '' })
    } finally { setBusy(null) }
  }

  const genFlashcards = async () => {
    if (!transcript.trim() || !aiService.isConfigured) { toast({ type: 'warning', title: 'Need transcript + AI' }); return }
    setBusy('flashcards')
    try {
      const raw = await streamToString(await aiService.generateFlashcards(transcript, 15))
      const match = raw.match(/\[[\s\S]*\]/)
      const cards = match ? JSON.parse(match[0]) as Array<{ front: string; back: string }> : []
      const fc = useFlashcardStore.getState()
      const deck = await fc.createDeck(`${lecture?.title ?? 'Lecture'} (Cards)`)
      for (const c of cards) await fc.createCard(deck.id, c.front, c.back, 'basic')
      await fc.loadDecks()
      toast({ type: 'success', title: `Created ${cards.length} flashcards` })
    } finally { setBusy(null) }
  }

  if (!lecture) return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin text-accent-primary" /></div>

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
        <button onClick={onBack} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface"><ArrowLeft size={16} /></button>
        <input defaultValue={lecture.title} onBlur={(e) => void update(lectureId, { ...lecture, title: e.target.value } as Partial<Lecture>)}
          className="bg-transparent text-sm font-medium text-text-primary outline-none px-2 py-1 rounded hover:bg-surface flex-1" />
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Process actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={processAll} disabled={busy !== null}>
              {busy === 'all' ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />} Process Lecture (AI)
            </Button>
            <Button variant="outline" onClick={genFlashcards} disabled={busy !== null}>
              {busy === 'flashcards' ? <Loader2 size={14} className="animate-spin" /> : <Brain size={14} />} Flashcards
            </Button>
          </div>

          {/* Transcript */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">Transcript</label>
              <Button size="sm" variant="ghost" onClick={saveTranscript}>Save</Button>
            </div>
            <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={8}
              placeholder="Paste or type the lecture transcript here. Then click 'Process Lecture' to generate notes, summary, quiz, and a study guide with AI." />
          </div>

          {/* Outputs */}
          {outputs.summary && <OutputCard icon={FileText} title="Summary" text={outputs.summary} />}
          {outputs.notes && <OutputCard icon={BookOpen} title="Structured Notes" text={outputs.notes} />}
          {outputs.studyGuide && <OutputCard icon={Sparkles} title="Study Guide" text={outputs.studyGuide} />}
          {outputs.quiz && <OutputCard icon={ListChecks} title="Quiz" text={outputs.quiz} />}
        </div>
      </div>
    </div>
  )
}

function OutputCard({ icon: Icon, title, text }: { icon: typeof FileText; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-surface p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-2"><Icon size={15} className="text-accent-primary" /> {title}</p>
      <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{text}</p>
    </div>
  )
}
