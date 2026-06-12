import { Brain } from 'lucide-react'
export function FlashcardsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
      <Brain size={40} className="text-accent-primary" />
      <h2 className="text-xl font-semibold text-text-primary">Flashcards</h2>
      <p className="text-text-muted text-sm max-w-sm">Full flashcard system with SM-2 spaced repetition coming in Step 4 (Flashcards module).</p>
    </div>
  )
}
