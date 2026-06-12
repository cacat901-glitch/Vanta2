import { useEffect } from 'react'
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore, type Toast } from '@/store/appStore'

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts)
  const removeToast = useAppStore((s) => s.removeToast)

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => {
    const duration = toast.duration ?? 4000
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onClose])

  const icons = {
    success: <CheckCircle2 size={15} className="text-success flex-shrink-0" />,
    error: <AlertCircle size={15} className="text-danger flex-shrink-0" />,
    warning: <AlertTriangle size={15} className="text-warning flex-shrink-0" />,
    info: <Info size={15} className="text-info flex-shrink-0" />,
  }

  const borders = {
    success: 'border-success/30',
    error: 'border-danger/30',
    warning: 'border-warning/30',
    info: 'border-info/30',
  }

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg',
        'bg-surface-elevated border shadow-xl',
        'min-w-72 max-w-sm',
        'animate-slide-in-right',
        borders[toast.type],
      )}
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-text-secondary mt-0.5">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-text-muted hover:text-text-secondary transition-colors flex-shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  )
}
