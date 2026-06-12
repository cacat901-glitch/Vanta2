import { useState } from 'react'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, Button, Textarea, Label, Input,
} from '@/components/ui'
import { useFlashcardStore } from '@/store/flashcardStore'
import { useAppStore } from '@/store/appStore'
import { aiService, isNoProviderError, streamToString } from '@/services/ai'

interface AIGenerateDialogProps {
  deckId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface GenCard { front: string; back: string; keep: boolean }

export function AIGenerateDialog({ deckId, open, onOpenChange }: AIGenerateDialogProps) {
  const createCard = useFlashcardStore((s) => s.createCard)
  const loadDecks = useFlashcardStore((s) => s.loadDecks)
  const toast = useAppStore((s) => s.addToast)
  const [source, setSource] = useState('')
  const [count, setCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [cards, setCards] = useState<GenCard[]>([])

  const handleGenerate = async () => {
    if (!source.trim()) return
    if (!aiService.isConfigured) {
      toast({ type: 'warning', title: 'Set up AI first', description: 'Configure a provider in Settings → AI.' })
      return
    }
    setGenerating(true)
    setCards([])
    try {
      const stream = await aiService.generateFlashcards(source, count)
      const result = await streamToString(stream)
      const json = extractJSON(result)
      if (Array.isArray(json)) {
        setCards(json.map((c: { front?: string; back?: string }) => ({
          front: String(c.front ?? ''), back: String(c.back ?? ''), keep: true,
        })).filter((c) => c.front && c.back))
      } else {
        toast({ type: 'error', title: 'Could not parse AI output', description: 'Try again or rephrase the source.' })
      }
    } catch (err) {
      if (isNoProviderError(err)) toast({ type: 'warning', title: 'No AI provider configured' })
      else toast({ type: 'error', title: 'Generation failed', description: err instanceof Error ? err.message : '' })
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    const kept = cards.filter((c) => c.keep)
    for (const c of kept) await createCard(deckId, c.front, c.back, 'basic')
    await loadDecks()
    toast({ type: 'success', title: `Added ${kept.length} cards` })
    setCards([]); setSource(''); onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles size={16} className="text-accent-primary" /> Generate Flashcards with AI</DialogTitle>
        </DialogHeader>

        {cards.length === 0 ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Source content or topic</Label>
              <Textarea value={source} onChange={(e) => setSource(e.target.value)} rows={6}
                placeholder="Paste notes, a topic, or any text to generate flashcards from…" />
            </div>
            <div className="flex items-center gap-3">
              <Label className="whitespace-nowrap">Number of cards</Label>
              <Input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-20" />
              <div className="flex-1" />
              <Button onClick={handleGenerate} disabled={generating || !source.trim()}>
                {generating ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Sparkles size={14} /> Generate</>}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted">Review the generated cards. Uncheck any you don't want, then save.</p>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {cards.map((c, i) => (
                <div key={i} className={`flex gap-3 p-3 rounded-lg border ${c.keep ? 'border-border-default bg-surface' : 'border-border-subtle opacity-50'}`}>
                  <button onClick={() => setCards((cs) => cs.map((x, j) => j === i ? { ...x, keep: !x.keep } : x))}
                    className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 ${c.keep ? 'bg-accent-primary text-white' : 'border border-border-default'}`}>
                    {c.keep ? <Check size={12} /> : <X size={12} className="text-text-muted" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{c.front}</p>
                    <p className="text-sm text-text-muted mt-1">{c.back}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCards([])}>Regenerate</Button>
              <Button onClick={handleSave}>Add {cards.filter((c) => c.keep).length} cards</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function extractJSON(text: string): unknown {
  try { return JSON.parse(text) } catch { /* try to find array */ }
  const match = text.match(/\[[\s\S]*\]/)
  if (match) { try { return JSON.parse(match[0]) } catch { return null } }
  return null
}
