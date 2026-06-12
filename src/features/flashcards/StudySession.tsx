import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, RotateCcw, Check, Loader2, Trophy } from 'lucide-react'
import { useFlashcardStore } from '@/store/flashcardStore'
import { aiService } from '@/services/ai'
import { cardText, renderCardHTML, clozeAnswers } from './cardContent'
import { Button } from '@/components/ui'
import { cn, formatDuration } from '@/lib/utils'
import type { Card, CardRating } from '@/types/flashcard'

interface StudySessionProps {
  onExit: () => void
}

export function StudySession({ onExit }: StudySessionProps) {
  const session = useFlashcardStore((s) => s.studySession)
  const rateCard = useFlashcardStore((s) => s.rateCard)

  const [flipped, setFlipped] = useState(false)
  const [written, setWritten] = useState('')
  const [grade, setGrade] = useState<{ correct: boolean; feedback: string } | null>(null)
  const [grading, setGrading] = useState(false)
  const [choices, setChoices] = useState<string[]>([])
  const [picked, setPicked] = useState<string | null>(null)

  const card = session?.cards[session.currentIndex] ?? null
  const isMC = session?.mode === 'multiple-choice'
  const isWritten = session?.mode === 'written'

  const frontText = card ? cardText(card.front) : ''
  const backText = card ? cardText(card.back) : ''
  const isCloze = card?.cardType === 'cloze'

  // Reset per-card state
  useEffect(() => {
    setFlipped(false); setWritten(''); setGrade(null); setPicked(null); setChoices([])
  }, [card?.id])

  // Generate MC distractors
  useEffect(() => {
    if (!isMC || !card || !session) return
    const correct = isCloze ? clozeAnswers(frontText) : backText
    const others = session.cards.filter((c) => c.id !== card.id).map((c) => cardText(c.back)).filter(Boolean).slice(0, 3)
    const fallback = [...others]
    setChoices(shuffle([correct, ...fallback.slice(0, 3)]))

    if (aiService.isConfigured && fallback.length < 3) {
      void aiService.complete(
        `Generate 3 plausible but WRONG short answers for this flashcard. Question: "${frontText}". Correct answer: "${correct}". Return only the 3 wrong answers, one per line, no numbering.`,
      ).then((res) => {
        const distractors = res.split('\n').map((l) => l.replace(/^[-\d.)\s]+/, '').trim()).filter(Boolean).slice(0, 3)
        setChoices(shuffle([correct, ...distractors]))
      }).catch(() => { /* keep fallback */ })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card?.id, isMC])

  const handleWrittenGrade = useCallback(async () => {
    if (!card || !written.trim()) return
    const correct = isCloze ? clozeAnswers(frontText) : backText
    if (!aiService.isConfigured) {
      const match = written.trim().toLowerCase() === correct.trim().toLowerCase()
      setGrade({ correct: match, feedback: match ? 'Correct!' : `Expected: ${correct}` })
      setFlipped(true)
      return
    }
    setGrading(true)
    try {
      const res = await aiService.complete(
        `Grade this flashcard answer semantically (meaning, not exact words). Question: "${frontText}". Correct answer: "${correct}". Student answer: "${written}". Respond with "CORRECT" or "INCORRECT" on the first line, then one sentence of feedback.`,
      )
      const correctAns = /^correct/i.test(res.trim())
      setGrade({ correct: correctAns, feedback: res.replace(/^(correct|incorrect)\s*/i, '').trim() || (correctAns ? 'Correct!' : `Expected: ${correct}`) })
    } catch {
      setGrade({ correct: false, feedback: `Expected: ${correct}` })
    } finally {
      setGrading(false)
      setFlipped(true)
    }
  }, [card, written, frontText, backText, isCloze])

  const handleRate = useCallback((rating: CardRating) => {
    void rateCard(rating)
  }, [rateCard])

  const elapsed = useMemo(() => session ? Math.floor((Date.now() - session.startTime.getTime()) / 1000) : 0, [session])

  if (!session) return null

  // Completion screen
  if (session.isComplete) {
    const total = session.reviewedCards.length
    const good = session.reviewedCards.filter((r) => r.rating >= 3).length
    const accuracy = total ? Math.round((good / total) * 100) : 0
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 p-8">
        <div className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center">
          <Trophy size={36} className="text-success" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text-primary">Session complete! 🎉</h2>
          <p className="text-text-muted mt-1">You reviewed {total} card{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-8">
          <Stat label="Reviewed" value={`${total}`} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
          <Stat label="Time" value={formatDuration(elapsed)} />
        </div>
        <Button onClick={onExit}>Done</Button>
      </div>
    )
  }

  if (!card) return null
  const progress = (session.currentIndex / session.cards.length) * 100

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border-subtle">
        <button onClick={onExit} className="w-8 h-8 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface">
          <X size={16} />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-surface-elevated overflow-hidden">
          <div className="h-full bg-accent-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs text-text-muted tabular-nums">{session.currentIndex + 1} / {session.cards.length}</span>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 overflow-y-auto">
        <div className="w-full max-w-xl min-h-[200px] rounded-2xl border border-border-default bg-surface p-8 flex flex-col items-center justify-center text-center">
          <div className="text-lg text-text-primary leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderCardHTML(frontText, isCloze && !flipped) }} />

          {flipped && !isCloze && (
            <>
              <div className="w-full border-t border-border-subtle my-5" />
              <div className="text-base text-text-secondary leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderCardHTML(backText) }} />
            </>
          )}
          {flipped && isCloze && (
            <>
              <div className="w-full border-t border-border-subtle my-5" />
              <div className="text-base text-accent-secondary"
                dangerouslySetInnerHTML={{ __html: renderCardHTML(frontText, false) }} />
            </>
          )}
        </div>

        {/* Written mode input */}
        {isWritten && !flipped && (
          <div className="w-full max-w-xl flex flex-col gap-2">
            <textarea
              value={written}
              onChange={(e) => setWritten(e.target.value)}
              placeholder="Type your answer…"
              rows={3}
              className="w-full bg-surface border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent-primary/60 resize-none"
            />
            <Button onClick={handleWrittenGrade} disabled={!written.trim() || grading}>
              {grading ? <><Loader2 size={14} className="animate-spin" /> Grading…</> : 'Check answer'}
            </Button>
          </div>
        )}

        {/* Written grade feedback */}
        {grade && (
          <div className={cn('w-full max-w-xl rounded-lg px-4 py-3 text-sm border',
            grade.correct ? 'bg-success/10 border-success/30 text-success' : 'bg-danger/10 border-danger/30 text-danger')}>
            <div className="flex items-center gap-2 font-medium">
              {grade.correct ? <Check size={15} /> : <X size={15} />}
              {grade.correct ? 'Correct' : 'Not quite'}
            </div>
            <p className="text-text-secondary mt-1">{grade.feedback}</p>
          </div>
        )}

        {/* Multiple choice options */}
        {isMC && !flipped && (
          <div className="w-full max-w-xl grid gap-2">
            {choices.map((choice, i) => {
              const correct = isCloze ? clozeAnswers(frontText) : backText
              const isCorrect = choice === correct
              const showResult = picked !== null
              return (
                <button
                  key={i}
                  disabled={picked !== null}
                  onClick={() => { setPicked(choice); setTimeout(() => setFlipped(true), 600) }}
                  className={cn('px-4 py-3 rounded-lg border text-left text-sm transition-colors',
                    !showResult && 'border-border-default bg-surface hover:border-accent-primary/50',
                    showResult && isCorrect && 'border-success bg-success/10 text-success',
                    showResult && !isCorrect && picked === choice && 'border-danger bg-danger/10 text-danger',
                    showResult && !isCorrect && picked !== choice && 'border-border-subtle opacity-50',
                  )}
                  dangerouslySetInnerHTML={{ __html: renderCardHTML(choice) }}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div className="border-t border-border-subtle p-4">
        {!flipped && !isWritten && !isMC && (
          <div className="flex justify-center">
            <Button onClick={() => setFlipped(true)} size="lg" className="gap-2">
              <RotateCcw size={16} /> Show answer
            </Button>
          </div>
        )}
        {flipped && (
          <div className="flex justify-center gap-2 max-w-xl mx-auto">
            <RateBtn label="Again" sub="<1m" color="bg-danger/15 text-danger hover:bg-danger/25" onClick={() => handleRate(0)} />
            <RateBtn label="Hard" sub="soon" color="bg-warning/15 text-warning hover:bg-warning/25" onClick={() => handleRate(1)} />
            <RateBtn label="Good" sub="1d+" color="bg-info/15 text-info hover:bg-info/25" onClick={() => handleRate(3)} />
            <RateBtn label="Easy" sub="4d+" color="bg-success/15 text-success hover:bg-success/25" onClick={() => handleRate(5)} />
          </div>
        )}
      </div>
    </div>
  )
}

function RateBtn({ label, sub, color, onClick }: { label: string; sub: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex-1 flex flex-col items-center py-2.5 rounded-lg font-medium text-sm transition-colors', color)}>
      {label}
      <span className="text-xs opacity-70">{sub}</span>
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}
