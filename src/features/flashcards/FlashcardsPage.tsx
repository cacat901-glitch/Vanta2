import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Brain, Plus, Sparkles, Trash2, ArrowLeft, Play, Shuffle,
  PenLine, ListChecks, BarChart3, Layers,
} from 'lucide-react'
import { useFlashcardStore } from '@/store/flashcardStore'
import { useAppStore } from '@/store/appStore'
import { StudySession } from './StudySession'
import { CardEditorDialog } from './CardEditorDialog'
import { AIGenerateDialog } from './AIGenerateDialog'
import { DeckStats } from './DeckStats'
import { cardText } from './cardContent'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { StudyMode } from '@/types/flashcard'

export function FlashcardsPage() {
  const { deckId } = useParams()
  const navigate = useNavigate()
  const decks = useFlashcardStore((s) => s.decks)
  const currentCards = useFlashcardStore((s) => s.currentCards)
  const studySession = useFlashcardStore((s) => s.studySession)
  const loadDecks = useFlashcardStore((s) => s.loadDecks)
  const createDeck = useFlashcardStore((s) => s.createDeck)
  const deleteDeck = useFlashcardStore((s) => s.deleteDeck)
  const loadCards = useFlashcardStore((s) => s.loadCards)
  const deleteCard = useFlashcardStore((s) => s.deleteCard)
  const startStudy = useFlashcardStore((s) => s.startStudy)
  const endStudy = useFlashcardStore((s) => s.endStudy)
  const toast = useAppStore((s) => s.addToast)

  const [cardEditorOpen, setCardEditorOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [showStats, setShowStats] = useState(false)

  useEffect(() => { void loadDecks() }, [loadDecks])
  useEffect(() => { if (deckId) void loadCards(deckId) }, [deckId, loadCards])

  // Study session active — show it full-screen
  if (studySession) {
    return <StudySession onExit={() => { endStudy(); void loadDecks(); if (deckId) void loadCards(deckId) }} />
  }

  const deck = deckId ? decks.find((d) => d.id === deckId) : null

  const launch = async (mode: StudyMode) => {
    await startStudy(deckId!, mode)
    if (!useFlashcardStore.getState().studySession) {
      toast({ type: 'info', title: 'No cards to study', description: mode === 'cram' ? 'This deck is empty.' : 'No cards are due. Try Cram mode.' })
    }
  }

  // Deck detail view
  if (deck) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <button onClick={() => navigate('/flashcards')} className="flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary mb-4">
          <ArrowLeft size={14} /> All decks
        </button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{deck.name}</h1>
            <p className="text-sm text-text-muted mt-1">{deck.cardCount} cards · {deck.dueCount} due today</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)}><BarChart3 size={14} /> Stats</Button>
            <Button variant="outline" size="sm" onClick={() => setAiOpen(true)}><Sparkles size={14} /> AI</Button>
            <Button size="sm" onClick={() => setCardEditorOpen(true)}><Plus size={14} /> Card</Button>
          </div>
        </div>

        {showStats && <DeckStats deckId={deck.id} />}

        {/* Study mode buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
          <StudyModeBtn icon={Play} label="Classic" sub={`${deck.dueCount} due`} onClick={() => launch('classic')} primary />
          <StudyModeBtn icon={ListChecks} label="Multiple Choice" sub="AI options" onClick={() => launch('multiple-choice')} />
          <StudyModeBtn icon={PenLine} label="Written" sub="AI graded" onClick={() => launch('written')} />
          <StudyModeBtn icon={Shuffle} label="Cram" sub="all cards" onClick={() => launch('cram')} />
        </div>

        {/* Card list */}
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-2">Cards</h2>
        {currentCards.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">
            No cards yet. Add one manually or generate with AI.
          </div>
        ) : (
          <div className="space-y-1.5">
            {currentCards.map((card) => (
              <div key={card.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface border border-border-subtle">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{cardText(card.front)}</p>
                  <p className="text-xs text-text-muted truncate">{cardText(card.back)}</p>
                </div>
                <span className="text-xs text-text-muted">{card.repetitions > 0 ? `×${card.repetitions}` : 'new'}</span>
                <button onClick={() => deleteCard(card.id)} className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-danger transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <CardEditorDialog deckId={deck.id} open={cardEditorOpen} onOpenChange={setCardEditorOpen} />
        <AIGenerateDialog deckId={deck.id} open={aiOpen} onOpenChange={setAiOpen} />
      </div>
    )
  }

  // Deck gallery
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary">Flashcards</h1>
        <Button size="sm" onClick={async () => {
          const name = prompt('Deck name:', 'New Deck')
          if (name) { const d = await createDeck(name); navigate(`/flashcards/${d.id}`) }
        }}><Plus size={14} /> New Deck</Button>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center"><Brain size={28} className="text-text-muted" /></div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">No decks yet</h2>
            <p className="text-text-muted text-sm mt-1">Create a deck and add cards, or generate them with AI</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {decks.map((d) => (
            <div key={d.id} className="group relative">
              <button onClick={() => navigate(`/flashcards/${d.id}`)}
                className="w-full text-left p-4 rounded-xl bg-surface border border-border-subtle hover:border-accent-primary/50 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <Layers size={16} className="text-accent-primary" />
                  <span className="font-medium text-text-primary truncate">{d.name}</span>
                </div>
                <div className="flex gap-3 text-xs">
                  <span className="text-text-muted">{d.cardCount} cards</span>
                  {d.dueCount > 0 && <span className="text-accent-primary font-medium">{d.dueCount} due</span>}
                </div>
              </button>
              <button onClick={() => { if (confirm(`Delete deck "${d.name}"?`)) void deleteDeck(d.id) }}
                className="absolute top-3 right-3 text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StudyModeBtn({ icon: Icon, label, sub, onClick, primary }: {
  icon: typeof Play; label: string; sub: string; onClick: () => void; primary?: boolean
}) {
  return (
    <button onClick={onClick}
      className={cn('flex flex-col items-center gap-1 p-3 rounded-xl border transition-colors',
        primary ? 'border-accent-primary/40 bg-accent-primary/10 hover:bg-accent-primary/15' : 'border-border-subtle bg-surface hover:border-border-default')}>
      <Icon size={18} className={primary ? 'text-accent-primary' : 'text-text-secondary'} />
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <span className="text-xs text-text-muted">{sub}</span>
    </button>
  )
}
