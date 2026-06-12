import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, Button, Textarea, Label,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui'
import { useFlashcardStore } from '@/store/flashcardStore'
import { cardText } from './cardContent'
import type { Card, CardType } from '@/types/flashcard'

interface CardEditorDialogProps {
  deckId: string
  card?: Card | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CardEditorDialog({ deckId, card, open, onOpenChange }: CardEditorDialogProps) {
  const createCard = useFlashcardStore((s) => s.createCard)
  const [type, setType] = useState<CardType>('basic')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')

  useEffect(() => {
    if (card) {
      setType(card.cardType)
      setFront(cardText(card.front))
      setBack(cardText(card.back))
    } else {
      setType('basic'); setFront(''); setBack('')
    }
  }, [card, open])

  const handleSave = async () => {
    if (!front.trim()) return
    // For reversed, create two cards
    if (type === 'reversed') {
      await createCard(deckId, front, back, 'basic')
      await createCard(deckId, back, front, 'basic')
    } else {
      await createCard(deckId, front, back, type)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{card ? 'Edit Card' : 'New Card'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Card type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CardType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic (front / back)</SelectItem>
                <SelectItem value="reversed">Reversed (both directions)</SelectItem>
                <SelectItem value="cloze">Cloze deletion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'cloze' ? (
            <div className="space-y-1.5">
              <Label>Text with cloze deletions</Label>
              <Textarea
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="The capital of France is {{c1::Paris}}."
                rows={4}
              />
              <p className="text-xs text-text-muted">Wrap hidden parts in {'{{c1::answer}}'}. Supports $math$, **bold**, `code`.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label>Front</Label>
                <Textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="Question or term…" rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Back</Label>
                <Textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Answer or definition…" rows={3} />
              </div>
              <p className="text-xs text-text-muted">Supports $math$, **bold**, *italic*, `code`.</p>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!front.trim()}>Save card</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
