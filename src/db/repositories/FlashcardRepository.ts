import { BaseRepository } from './base'
import type { Deck, Card, CardReview, CardRating } from '@/types'

interface DeckRow {
  id: string; name: string; parent_deck_id: string | null; course_id: string | null
  description: string | null; order_index: number; created_at: string; updated_at: string
}

interface CardRow {
  id: string; deck_id: string; front: string; back: string; card_type: string
  cloze_data: string | null; occlusion_rects: string | null; image_url: string | null
  audio_url: string | null; tags: string; source_object_id: string | null
  interval: number; ease_factor: number; repetitions: number; due_date: string
  lapses: number; is_leech: number; is_suspended: number; created_at: string
}

interface CardReviewRow {
  id: string; card_id: string; reviewed_at: string
  ease: number; interval: number; rating: number; time_taken: number
}

export class FlashcardRepository extends BaseRepository {
  // ─── Decks ────────────────────────────────────────────────────────────

  async getAllDecks(): Promise<Deck[]> {
    const rows = await this.storage.query<DeckRow>(
      'SELECT * FROM decks ORDER BY order_index ASC, name ASC'
    )
    // Get counts per deck
    const counts = await this.storage.query<{ deck_id: string; total: number; due: number }>(
      `SELECT deck_id,
         COUNT(*) as total,
         SUM(CASE WHEN due_date <= ? AND is_suspended = 0 THEN 1 ELSE 0 END) as due
       FROM cards GROUP BY deck_id`,
      [new Date().toISOString()]
    )
    const countMap = new Map(counts.map(c => [c.deck_id, c]))

    return rows.map(r => {
      const c = countMap.get(r.id)
      return {
        id: r.id, name: r.name, parentDeckId: r.parent_deck_id,
        courseId: r.course_id, description: r.description,
        cardCount: c?.total ?? 0, newCount: 0, dueCount: c?.due ?? 0,
        createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
      } satisfies Deck
    })
  }

  async getDeckById(id: string): Promise<Deck | null> {
    const row = await this.storage.queryOne<DeckRow>('SELECT * FROM decks WHERE id = ?', [id])
    if (!row) return null
    return this._rowToDeck(row)
  }

  async createDeck(name: string, parentDeckId?: string, courseId?: string): Promise<Deck> {
    const now = this.now()
    const deck: Deck = {
      id: this.newId(), name, parentDeckId: parentDeckId ?? null,
      courseId: courseId ?? null, description: null,
      cardCount: 0, newCount: 0, dueCount: 0,
      createdAt: new Date(), updatedAt: new Date(),
    }
    await this.storage.execute(
      'INSERT INTO decks (id, name, parent_deck_id, course_id, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [deck.id, deck.name, deck.parentDeckId, deck.courseId, deck.description, now, now]
    )
    return deck
  }

  async deleteDeck(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM decks WHERE id = ?', [id])
  }

  // ─── Cards ────────────────────────────────────────────────────────────

  async getCardsByDeck(deckId: string): Promise<Card[]> {
    const rows = await this.storage.query<CardRow>(
      'SELECT * FROM cards WHERE deck_id = ? ORDER BY due_date ASC',
      [deckId]
    )
    return rows.map(this._rowToCard.bind(this))
  }

  async getDueCards(deckId: string, limit = 100): Promise<Card[]> {
    const now = new Date().toISOString()
    const rows = await this.storage.query<CardRow>(
      `SELECT * FROM cards
       WHERE deck_id = ? AND due_date <= ? AND is_suspended = 0
       ORDER BY due_date ASC
       LIMIT ?`,
      [deckId, now, limit]
    )
    return rows.map(this._rowToCard.bind(this))
  }

  async getDueCountAll(): Promise<number> {
    const now = new Date().toISOString()
    const row = await this.storage.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM cards WHERE due_date <= ? AND is_suspended = 0',
      [now]
    )
    return row?.count ?? 0
  }

  async createCard(deckId: string, front: unknown, back: unknown, cardType = 'basic'): Promise<Card> {
    const now = this.now()
    const card: Partial<Card> & { id: string; deckId: string } = {
      id: this.newId(), deckId, front, back, cardType: cardType as Card['cardType'],
      clozeData: null, occlusionRects: null, imageUrl: null, audioUrl: null,
      tags: [], sourceObjectId: null,
      interval: 0, easeFactor: 2.5, repetitions: 0,
      dueDate: new Date(), lapses: 0, isLeech: false, isSuspended: false,
      createdAt: new Date(),
    }
    await this.storage.execute(
      `INSERT INTO cards
        (id, deck_id, front, back, card_type, cloze_data, occlusion_rects, image_url, audio_url,
         tags, source_object_id, interval, ease_factor, repetitions, due_date, lapses,
         is_leech, is_suspended, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        card.id, card.deckId, JSON.stringify(card.front), JSON.stringify(card.back), card.cardType,
        null, null, null, null, JSON.stringify([]), null,
        0, 2.5, 0, now, 0, 0, 0, now,
      ]
    )
    return card as Card
  }

  async updateCardAfterReview(
    cardId: string,
    state: { interval: number; easeFactor: number; repetitions: number; dueDate: Date; lapses: number; isLeech: boolean }
  ): Promise<void> {
    await this.storage.execute(
      `UPDATE cards SET interval=?, ease_factor=?, repetitions=?, due_date=?, lapses=?, is_leech=?
       WHERE id=?`,
      [state.interval, state.easeFactor, state.repetitions, state.dueDate.toISOString(),
       state.lapses, state.isLeech ? 1 : 0, cardId]
    )
  }

  async recordReview(cardId: string, rating: CardRating, ease: number, interval: number, timeTaken: number): Promise<void> {
    await this.storage.execute(
      'INSERT INTO card_reviews (id, card_id, reviewed_at, ease, interval, rating, time_taken) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [this.newId(), cardId, this.now(), ease, interval, rating, timeTaken]
    )
  }

  async getRecentReviews(deckId: string, days = 30): Promise<CardReview[]> {
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const rows = await this.storage.query<CardReviewRow>(
      `SELECT cr.* FROM card_reviews cr
       JOIN cards c ON c.id = cr.card_id
       WHERE c.deck_id = ? AND cr.reviewed_at >= ?
       ORDER BY cr.reviewed_at DESC`,
      [deckId, since]
    )
    return rows.map(r => ({
      id: r.id, cardId: r.card_id, reviewedAt: new Date(r.reviewed_at),
      ease: r.ease, interval: r.interval, rating: r.rating as CardRating, timeTaken: r.time_taken,
    }))
  }

  async deleteCard(id: string): Promise<void> {
    await this.storage.execute('DELETE FROM cards WHERE id = ?', [id])
  }

  // ─── Row mappers ────────────────────────────────────────────────────

  private _rowToDeck(r: DeckRow): Deck {
    return {
      id: r.id, name: r.name, parentDeckId: r.parent_deck_id, courseId: r.course_id,
      description: r.description, cardCount: 0, newCount: 0, dueCount: 0,
      createdAt: new Date(r.created_at), updatedAt: new Date(r.updated_at),
    }
  }

  private _rowToCard(r: CardRow): Card {
    return {
      id: r.id, deckId: r.deck_id,
      front: this.deserialize(r.front, {}),
      back: this.deserialize(r.back, {}),
      cardType: r.card_type as Card['cardType'],
      clozeData: this.deserialize(r.cloze_data, null),
      occlusionRects: this.deserialize(r.occlusion_rects, null),
      imageUrl: r.image_url, audioUrl: r.audio_url,
      tags: this.deserialize<string[]>(r.tags, []),
      sourceObjectId: r.source_object_id,
      interval: r.interval, easeFactor: r.ease_factor, repetitions: r.repetitions,
      dueDate: new Date(r.due_date), lapses: r.lapses,
      isLeech: this.toBool(r.is_leech), isSuspended: this.toBool(r.is_suspended),
      createdAt: new Date(r.created_at),
    }
  }
}
