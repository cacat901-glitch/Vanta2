import { useNavigate } from 'react-router-dom'
import { Zap, ArrowRight } from 'lucide-react'

export function AISetupPrompt() {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
        <Zap size={24} className="text-accent-primary" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">Set up AI</h3>
        <p className="text-xs text-text-muted mt-1 leading-relaxed">
          Connect Ollama for free local AI, or use Gemini/Groq for free cloud AI.
        </p>
      </div>
      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-primary text-white text-sm font-medium hover:bg-accent-hover transition-colors"
      >
        Configure AI
        <ArrowRight size={14} />
      </button>
      <p className="text-xs text-text-muted">
        Ollama is free, offline, and runs on your machine.{' '}
        <a
          href="https://ollama.ai"
          className="text-accent-primary hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download →
        </a>
      </p>
    </div>
  )
}
