import { GraduationCap, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InitScreenProps {
  isLoading: boolean
  error?: string | null
}

export function InitScreen({ isLoading, error }: InitScreenProps) {
  return (
    <div className="fixed inset-0 bg-app-bg flex flex-col items-center justify-center gap-6">
      {/* Logo */}
      <div className={cn(
        'w-16 h-16 rounded-2xl bg-accent-primary flex items-center justify-center',
        isLoading && 'animate-pulse',
      )}>
        <GraduationCap size={32} className="text-white" />
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary">StudyOS</h1>
        <p className="text-sm text-text-muted mt-1">
          {error ? 'Failed to start' : 'Loading your study environment…'}
        </p>
      </div>

      {isLoading && !error && (
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-accent-primary/60 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 max-w-sm text-sm text-danger">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Initialization error</p>
            <p className="text-xs mt-1 text-danger/80">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}
