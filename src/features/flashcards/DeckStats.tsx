import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { getDB } from '@/db'
import { calculateRetention } from '@/services/ai/sm2'
import type { Card, CardReview } from '@/types/flashcard'

interface DeckStatsProps {
  deckId: string
}

export function DeckStats({ deckId }: DeckStatsProps) {
  const [cards, setCards] = useState<Card[]>([])
  const [reviews, setReviews] = useState<CardReview[]>([])

  useEffect(() => {
    void (async () => {
      const db = await getDB()
      setCards(await db.flashcards.getCardsByDeck(deckId))
      setReviews(await db.flashcards.getRecentReviews(deckId, 30))
    })()
  }, [deckId])

  const retention = calculateRetention(reviews)
  const totalReviews = reviews.length
  const avgEase = cards.length ? (cards.reduce((s, c) => s + c.easeFactor, 0) / cards.length).toFixed(2) : '—'
  const mature = cards.filter((c) => c.interval >= 21).length

  // Forecast: cards due each day for next 14 days
  const forecast = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() + i)
    const next = new Date(day); next.setDate(next.getDate() + 1)
    const count = cards.filter((c) => c.dueDate >= day && c.dueDate < next).length
    return { day: i === 0 ? 'Today' : day.toLocaleDateString('en', { weekday: 'short' }), count }
  })

  return (
    <div className="mb-6 p-4 rounded-xl bg-surface border border-border-subtle space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <StatBox label="Retention" value={`${retention}%`} accent />
        <StatBox label="Reviews (30d)" value={`${totalReviews}`} />
        <StatBox label="Avg ease" value={`${avgEase}`} />
        <StatBox label="Mature" value={`${mature}`} />
      </div>

      <div>
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">Review forecast (next 14 days)</p>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={forecast}>
            <XAxis dataKey="day" tick={{ fill: '#55556A', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#55556A', fontSize: 10 }} axisLine={false} tickLine={false} width={20} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: '#1F1F2E', border: '1px solid #2A2A3D', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#EEEDF8' }}
              cursor={{ fill: 'rgba(124,111,255,0.1)' }}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {forecast.map((_, i) => <Cell key={i} fill={i === 0 ? '#7C6FFF' : '#3ECFB2'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${accent ? 'text-accent-primary' : 'text-text-primary'}`}>{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  )
}
