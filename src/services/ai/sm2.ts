/**
 * SM-2 Spaced Repetition Algorithm
 * Based on: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-learning-process-of-foreign-languages
 */
import type { CardRating, SM2State } from '@/types/flashcard'

export const MIN_EASE = 1.3
export const DEFAULT_EASE = 2.5
export const LEECH_THRESHOLD = 8

/**
 * Calculate new SM-2 state after a review.
 * @param current — current card state
 * @param rating — user rating: 0=Again, 1=Hard, 3=Good, 5=Easy
 * @param leechThreshold — how many lapses before marking as leech
 */
export function calculateNextState(
  current: SM2State,
  rating: CardRating,
  leechThreshold = LEECH_THRESHOLD,
): SM2State & { lapses: number; isLeech: boolean } {
  let { interval, easeFactor, repetitions } = current
  let lapses = (current as SM2State & { lapses?: number }).lapses ?? 0
  let nextInterval: number
  let nextEase: number
  let nextRepetitions: number

  if (rating === 0) {
    // Again — reset to learning
    nextRepetitions = 0
    nextInterval = 1 // 1 day
    nextEase = Math.max(MIN_EASE, easeFactor - 0.2)
    lapses++
  } else if (rating === 1) {
    // Hard — reduce interval
    nextRepetitions = repetitions
    nextInterval = Math.max(1, Math.round(interval * 1.2))
    nextEase = Math.max(MIN_EASE, easeFactor - 0.15)
  } else if (rating === 3) {
    // Good — normal interval
    if (repetitions === 0) {
      nextInterval = 1
    } else if (repetitions === 1) {
      nextInterval = 6
    } else {
      nextInterval = Math.round(interval * easeFactor)
    }
    nextRepetitions = repetitions + 1
    nextEase = easeFactor // No change for Good
  } else {
    // Easy (5) — bonus interval
    if (repetitions === 0) {
      nextInterval = 4
    } else if (repetitions === 1) {
      nextInterval = 10
    } else {
      nextInterval = Math.round(interval * easeFactor * 1.3)
    }
    nextRepetitions = repetitions + 1
    nextEase = easeFactor + 0.1
  }

  // Cap ease factor
  nextEase = Math.min(Math.max(nextEase, MIN_EASE), 3.5)

  // Fuzz interval slightly to prevent "review storms"
  nextInterval = fuzzInterval(nextInterval)

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + nextInterval)
  dueDate.setHours(4, 0, 0, 0) // Due at 4 AM to avoid timezone issues

  return {
    interval: nextInterval,
    easeFactor: nextEase,
    repetitions: nextRepetitions,
    dueDate,
    lapses,
    isLeech: lapses >= leechThreshold,
  }
}

/** Add small random fuzz to avoid all cards being due on same day */
function fuzzInterval(interval: number): number {
  if (interval < 2) return interval
  const fuzz = Math.max(1, Math.round(interval * 0.05))
  return interval + Math.floor(Math.random() * fuzz * 2) - fuzz
}

/** Calculate retention percentage for a deck based on recent reviews */
export function calculateRetention(
  reviews: Array<{ rating: CardRating }>,
): number {
  if (reviews.length === 0) return 0
  const good = reviews.filter(r => r.rating >= 3).length
  return Math.round((good / reviews.length) * 100)
}

/** Ebbinghaus forgetting curve: R = e^(-t/S) where t=time, S=stability */
export function forgettingCurve(daysSinceReview: number, stability: number): number {
  return Math.exp(-daysSinceReview / stability) * 100
}

/** Calculate stability from ease factor and interval */
export function getStability(easeFactor: number, interval: number): number {
  return interval * (easeFactor / DEFAULT_EASE)
}
