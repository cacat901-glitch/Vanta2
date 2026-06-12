import { Calendar } from 'lucide-react'
export function PlannerPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
      <Calendar size={40} className="text-accent-primary" />
      <h2 className="text-xl font-semibold text-text-primary">Planner</h2>
      <p className="text-text-muted text-sm max-w-sm">Calendar, tasks, assignments, exams, and Pomodoro timer coming in Step 5 (Planner module).</p>
    </div>
  )
}
