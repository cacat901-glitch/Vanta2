import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { Deck, Card, StudySession, StudyMode } from '@/types'
import type { CardRating } from '@/types/flashcard'
import { calculateNextState } from '@/services/ai/sm2'
import { getDB } from '@/db'

interface FlashcardState {
  decks: Deck[]
  currentDeckId: string | null
  currentCards: Card[]
  studySession: StudySession | null
  dueCountAll: number
  isLoading: boolean

  // Actions
  loadDecks: () => Promise<void>
  createDeck: (name: string, parentDeckId?: string, courseId?: string) => Promise<Deck>
  deleteDeck: (id: string) => Promise<void>
  loadCards: (deckId: string) => Promise<Card[]>
  createCard: (deckId: string, front: unknown, back: unknown, type?: string) => Promise<Card>
  deleteCard: (id: string) => Promise<void>

  // Study session
  startStudy: (deckId: string, mode: StudyMode) => Promise<void>
  rateCard: (rating: CardRating) => Promise<void>
  endStudy: () => void
  getDueCount: (deckId: string) => Promise<number>
  refreshDueCount: () => Promise<void>
}

export const useFlashcardStore = create<FlashcardState>()(
  immer((set, get) => ({
    decks: [],
    currentDeckId: null,
    currentCards: [],
    studySession: null,
    dueCountAll: 0,
    isLoading: false,

    loadDecks: async () => {
      set((s) => { s.isLoading = true })
      const db = await getDB()
      const decks = await db.flashcards.getAllDecks()
      set((s) => { s.decks = decks; s.isLoading = false })
      await get().refreshDueCount()
    },

    createDeck: async (name, parentDeckId, courseId) => {
      const db = await getDB()
      const deck = await db.flashcards.createDeck(name, parentDeckId, courseId)
      set((s) => { s.decks.push(deck) })
      return deck
    },

    deleteDeck: async (id) => {
      const db = await getDB()
      await db.flashcards.deleteDeck(id)
      set((s) => { s.decks = s.decks.filter((d) => d.id !== id) })
    },

    loadCards: async (deckId) => {
      const db = await getDB()
      const cards = await db.flashcards.getCardsByDeck(deckId)
      set((s) => { s.currentCards = cards; s.currentDeckId = deckId })
      return cards
    },

    createCard: async (deckId, front, back, type = 'basic') => {
      const db = await getDB()
      const card = await db.flashcards.createCard(deckId, front, back, type)
      set((s) => { s.currentCards.push(card) })
      // Update deck count
      set((s) => {
        const deck = s.decks.find((d) => d.id === deckId)
        if (deck) deck.cardCount++
      })
      return card
    },

    deleteCard: async (id) => {
      const db = await getDB()
      await db.flashcards.deleteCard(id)
      set((s) => { s.currentCards = s.currentCards.filter((c) => c.id !== id) })
    },

    startStudy: async (deckId, mode) => {
      const db = await getDB()
      let cards: Card[]

      if (mode === 'cram') {
        cards = await db.flashcards.getCardsByDeck(deckId)
      } else {
        cards = await db.flashcards.getDueCards(deckId, 100)
      }

      if (cards.length === 0) {
        set((s) => { s.studySession = null })
        return
      }

      // Shuffle for cram mode
      if (mode === 'cram') {
        cards = [...cards].sort(() => Math.random() - 0.5)
      }

      set((s) => {
        s.studySession = {
          deckId, mode, cards, currentIndex: 0,
          reviewedCards: [], startTime: new Date(), isComplete: false,
        }
        s.currentDeckId = deckId
      })
    },

    rateCard: async (rating) => {
      const { studySession } = get()
      if (!studySession) return

      const card = studySession.cards[studySession.currentIndex]
      if (!card) return

      const startTime = Date.now()
      const db = await getDB()

      if (studySession.mode !== 'cram' && studySession.mode !== 'preview') {
        const newState = calculateNextState(
          { interval: card.interval, easeFactor: card.easeFactor, repetitions: card.repetitions, dueDate: card.dueDate },
          rating,
        )
        await db.flashcards.updateCardAfterReview(card.id, newState)
        await db.flashcards.recordReview(card.id, rating, newState.easeFactor, newState.interval, Date.now() - startTime)
      }

      // Log activity
      await db.activity.log('flashcard_review', { courseId: undefined })

      const nextIndex = studySession.currentIndex + 1
      const isComplete = nextIndex >= studySession.cards.length

      set((s) => {
        if (!s.studySession) return
        s.studySession.reviewedCards.push({ card, rating })
        if (isComplete) {
          s.studySession.isComplete = true
        } else {
          s.studySession.currentIndex = nextIndex
        }
      })
    },

    endStudy: () => set((s) => { s.studySession = null }),

    getDueCount: async (deckId) => {
      const db = await getDB()
      const cards = await db.flashcards.getDueCards(deckId)
      return cards.length
    },

    refreshDueCount: async () => {
      const db = await getDB()
      const count = await db.flashcards.getDueCountAll()
      set((s) => { s.dueCountAll = count })
    },
  })),
)
