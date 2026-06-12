import { useState } from 'react'
import { ArrowLeft, FileText, Brain, Sparkles, Loader2 } from 'lucide-react'
import { useMediaStore } from '@/store/mediaStore'
import { useAppStore } from '@/store/appStore'
import { useFlashcardStore } from '@/store/flashcardStore'
import { aiService, streamToString } from '@/services/ai'
import { Button, Textarea } from '@/components/ui'
import type { MediaItem } from '@/types/media'

export function YouTubeViewer({ item, onBack }: { item: MediaItem; onBack: () => void }) {
  const videoId = (item.metadata as { videoId?: string }).videoId ?? ''
  const setTranscript = useMediaStore((s) => s.setTranscript)
  const toast = useAppStore((s) => s.addToast)
  const [transcript, setLocalTranscript] = useState(
    item.transcript?.map((t) => t.text).join('\n') ?? '',
  )
  const [aiResult, setAiResult] = useState<{ title: string; text: string; loading: boolean } | null>(null)

  const runAI = async (kind: 'summary' | 'questions' | 'flashcards') => {
    if (!transcript.trim()) { toast({ type: 'warning', title: 'Add a transcript first' }); return }
    if (!aiService.isConfigured) { toast({ type: 'warning', title: 'Set up AI in Settings' }); return }
    setAiResult({ title: kind, text: '', loading: true })
    try {
      let text = ''
      if (kind === 'summary') text = await streamToString(await aiService.summarize(transcript, 'key-concepts'))
      else if (kind === 'questions') text = await streamToString(await aiService.generateQuestions(transcript, 5, 'mixed', 'medium'))
      else if (kind === 'flashcards') {
        const raw = await streamToString(await aiService.generateFlashcards(transcript, 12))
        const match = raw.match(/\[[\s\S]*\]/)
        const cards = match ? JSON.parse(match[0]) as Array<{ front: string; back: string }> : []
        const fc = useFlashcardStore.getState()
        const deck = await fc.createDeck(`${item.title} (Video)`)
        for (const c of cards) await fc.createCard(deck.id, c.front, c.back, 'basic')
        await fc.loadDecks()
        text = `Created ${cards.length} flashcards in "${item.title} (Video)".`
      }
      setAiResult({ title: kind, text, loading: false })
    } catch (err) {
      setAiResult({ title: kind, text: err instanceof Error ? err.message : 'AI failed', loading: false })
    }
  }

  const saveTranscript = () => {
    const lines = transcript.split('\n').filter(Boolean).map((text, i) => ({ text, startSeconds: i * 5 }))
    void setTranscript(item.id, lines)
    toast({ type: 'success', title: 'Transcript saved' })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
        <button onClick={onBack} className="w-7 h-7 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface"><ArrowLeft size={16} /></button>
        <span className="text-sm font-medium text-text-primary truncate flex-1">{item.title}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="aspect-video rounded-xl overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={item.title ?? 'video'} className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => runAI('summary')}><FileText size={14} /> Summarize</Button>
            <Button size="sm" variant="ghost" onClick={() => runAI('questions')}><Sparkles size={14} /> Questions</Button>
            <Button size="sm" variant="ghost" onClick={() => runAI('flashcards')}><Brain size={14} /> Flashcards</Button>
          </div>

          {aiResult && (
            <div className="rounded-xl border border-border-subtle bg-surface p-4">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 capitalize">{aiResult.title}</p>
              {aiResult.loading ? <Loader2 className="animate-spin text-accent-primary" /> :
                <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{aiResult.text}</p>}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-primary">Transcript</label>
              <Button size="sm" variant="outline" onClick={saveTranscript}>Save transcript</Button>
            </div>
            <Textarea value={transcript} onChange={(e) => setLocalTranscript(e.target.value)} rows={10}
              placeholder="Paste the video transcript here (YouTube → ... → Show transcript), then use AI tools above. Auto-fetch is blocked by YouTube's CORS policy." />
          </div>
        </div>
      </div>
    </div>
  )
}
