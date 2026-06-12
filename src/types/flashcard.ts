// ─── Flashcard Types ──────────────────────────────────────────────────

export type CardType = 'basic' | 'reversed' | 'cloze' | 'image-occlusion' | 'audio' | 'typing'

export type CardRating = 0 | 1 | 3 | 5 // Again / Hard / Good / Easy

export interface Deck {
  id: string
  name: string
  parentDeckId: string | null
  courseId: string | null
  description: string | null
  cardCount: number
  newCount: number
  dueCount: number
  createdAt: Date
  updatedAt: Date
}

export interface ClozeData {
  groups: Array<{
    id: string // c1, c2, etc.
    text: string
  }>
}

export interface OcclusionRect {
  x: number
  y: number
  width: number
  height: number
  label?: string
}

export interface Card {
  id: string
  deckId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TipTap JSON for rich card content
  front: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TipTap JSON for rich card content
  back: unknown
  cardType: CardType
  clozeData: ClozeData | null
  occlusionRects: OcclusionRect[] | null
  imageUrl: string | null
  audioUrl: string | null
  tags: string[]
  sourceObjectId: string | null
  createdAt: Date

  // SM-2 scheduling state
  interval: number // days
  easeFactor: number
  repetitions: number
  dueDate: Date
  lapses: number
  isLeech: boolean
  isSuspended: boolean
}

export interface CardReview {
  id: string
  cardId: string
  reviewedAt: Date
  ease: number
  interval: number
  rating: CardRating
  timeTaken: number // milliseconds
}

// SM-2 algorithm state
export interface SM2State {
  interval: number
  easeFactor: number
  repetitions: number
  dueDate: Date
}

export type StudyMode = 'classic' | 'multiple-choice' | 'written' | 'cram' | 'filtered' | 'preview'

export interface StudySession {
  deckId: string
  mode: StudyMode
  cards: Card[]
  currentIndex: number
  reviewedCards: Array<{ card: Card; rating: CardRating }>
  startTime: Date
  isComplete: boolean
}
