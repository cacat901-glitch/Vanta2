import { useState, useRef, useCallback } from 'react'
import { Mic, MicOff, Volume2, Loader2, Play, Award, Send } from 'lucide-react'
import { aiService, streamToString } from '@/services/ai'
import { useAppStore } from '@/store/appStore'
import { useCourseStore } from '@/store/courseStore'
import { speak, stopSpeaking, listen, isSTTAvailable, type STTSession } from '@/lib/speech'
import { AISetupPrompt } from '@/components/ai/AISetupPrompt'
import { Button, Input, Textarea } from '@/components/ui'
import { cn } from '@/lib/utils'

interface QA { question: string; answer: string; score?: number; feedback?: string }

export function OralExamPage() {
  const toast = useAppStore((s) => s.addToast)
  const courses = useCourseStore((s) => s.courses)
  const [topic, setTopic] = useState('')
  const [phase, setPhase] = useState<'setup' | 'exam' | 'report'>('setup')
  const [qas, setQas] = useState<QA[]>([])
  const [currentQ, setCurrentQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [report, setReport] = useState('')
  const sttRef = useRef<STTSession | null>(null)
  const count = useRef(0)

  const isConfigured = aiService.isConfigured

  const askQuestion = useCallback(async (history: QA[]) => {
    setBusy(true)
    try {
      const prevQs = history.map((q) => q.question).join('; ')
      const q = await aiService.complete(
        `You are an oral examiner testing a student on "${topic}". Ask ONE concise exam question. Do not repeat these: ${prevQs || 'none'}. Return only the question.`,
      )
      setCurrentQ(q.trim())
      speak(q.trim())
    } finally { setBusy(false) }
  }, [topic])

  const startExam = async () => {
    if (!topic.trim()) return
    setPhase('exam'); setQas([]); count.current = 0
    await askQuestion([])
  }

  const submitAnswer = async () => {
    if (!answer.trim()) return
    stopSpeaking()
    setBusy(true)
    try {
      const grade = await aiService.complete(
        `Question: "${currentQ}". Student's spoken answer: "${answer}". Grade out of 10 and give one sentence of feedback. Respond as "SCORE: X | feedback".`,
      )
      const scoreMatch = grade.match(/score:\s*(\d+)/i)
      const score = scoreMatch ? Number(scoreMatch[1]) : 5
      const feedback = grade.replace(/score:\s*\d+\s*\|?\s*/i, '').trim()
      const qa: QA = { question: currentQ, answer, score, feedback }
      const newQas = [...qas, qa]
      setQas(newQas)
      setAnswer('')
      count.current++
      if (count.current >= 5) {
        await finishExam(newQas)
      } else {
        await askQuestion(newQas)
      }
    } finally { setBusy(false) }
  }

  const finishExam = async (finalQas: QA[]) => {
    setBusy(true)
    try {
      const transcript = finalQas.map((q, i) => `Q${i + 1}: ${q.question}\nA: ${q.answer}\nScore: ${q.score}/10`).join('\n\n')
      const rep = await streamToString(await aiService.chatWithSystem(
        'You are an examiner writing an exam report.',
        `Write a brief oral exam report for a student on "${topic}". Here is the transcript:\n\n${transcript}\n\nGive: overall grade, strengths, weaknesses, and what to review.`,
      ))
      setReport(rep)
      setPhase('report')
    } finally { setBusy(false) }
  }

  const toggleListen = () => {
    if (listening) { sttRef.current?.stop(); setListening(false); return }
    if (!isSTTAvailable()) { toast({ type: 'warning', title: 'Voice input not supported', description: 'Type your answer instead.' }); return }
    const session = listen((final) => { setAnswer((a) => (a ? a + ' ' : '') + final); setListening(false) }, (interim) => setAnswer(interim))
    sttRef.current = session
    setListening(true)
  }

  if (!isConfigured) {
    return <div className="flex h-full items-center justify-center"><div className="w-80"><AISetupPrompt /></div></div>
  }

  const avgScore = qas.length ? Math.round(qas.reduce((s, q) => s + (q.score ?? 0), 0) / qas.length * 10) : 0

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {phase === 'setup' && (
        <div className="flex flex-col items-center gap-5 py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-primary/15 flex items-center justify-center"><Mic size={28} className="text-accent-primary" /></div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Oral Exam</h1>
            <p className="text-text-muted text-sm mt-1">The AI examiner asks questions aloud. Answer by voice or text. Get scored feedback.</p>
          </div>
          <div className="w-full max-w-sm space-y-2">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Exam topic (e.g. Thermodynamics)" list="course-topics" />
            <datalist id="course-topics">{courses.map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <Button className="w-full" onClick={startExam} disabled={!topic.trim()}><Play size={15} /> Start Oral Exam</Button>
          </div>
        </div>
      )}

      {phase === 'exam' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-muted">Question {count.current + 1} of 5</span>
            <button onClick={() => speak(currentQ)} className="text-accent-primary hover:text-accent-hover"><Volume2 size={18} /></button>
          </div>
          <div className="rounded-xl border border-border-default bg-surface p-5">
            {busy && !currentQ ? <Loader2 className="animate-spin text-accent-primary" /> :
              <p className="text-lg text-text-primary">{currentQ}</p>}
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
            <div className="space-y-1.5">
              {qas.map((qa, i) => (
                <div key={i} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-surface/50">
                  <span className={cn('font-medium', (qa.score ?? 0) >= 6 ? 'text-success' : 'text-warning')}>{qa.score}/10</span>
                  <span className="text-text-muted truncate flex-1">{qa.question}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {phase === 'report' && (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center"><Award size={30} className="text-success" /></div>
            <h2 className="text-2xl font-bold text-text-primary">{avgScore}%</h2>
            <p className="text-text-muted text-sm">Overall oral exam score</p>
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface p-4">
            <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{report}</p>
          </div>
          <Button className="w-full" onClick={() => setPhase('setup')}>New Exam</Button>
        </div>
      )}
    </div>
  )
}
