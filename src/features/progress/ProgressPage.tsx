import { BarChart3 } from 'lucide-react'
export function ProgressPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
      <BarChart3 size={40} className="text-accent-primary" />
      <h2 className="text-xl font-semibold text-text-primary">Progress</h2>
      <p className="text-text-muted text-sm max-w-sm">Dashboard analytics, streak tracking, XP system, and AI coach reports coming in Step 6 (Progress module).</p>
    </div>
  )
}
