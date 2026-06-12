import { Pen } from 'lucide-react'
export function CanvasPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
      <Pen size={40} className="text-accent-primary" />
      <h2 className="text-xl font-semibold text-text-primary">Canvas</h2>
      <p className="text-text-muted text-sm max-w-sm">Infinite canvas with Fabric.js, pen/stylus support, shapes, and AI diagram generation coming in Step 3 (Canvas module).</p>
    </div>
  )
}
