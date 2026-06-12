import { Bot, User, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AIMessage } from '@/store/aiStore'

interface AIMessageBubbleProps {
  message: AIMessage
}

export function AIMessageBubble({ message }: AIMessageBubbleProps) {
  const isUser = message.role === 'user'
  const isError = !!message.error

  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser ? 'bg-accent-primary/20' : 'bg-surface-elevated',
      )}>
        {isUser
          ? <User size={12} className="text-accent-primary" />
          : <Bot size={12} className="text-accent-primary" />
        }
      </div>

      {/* Bubble */}
      <div className={cn(
        'max-w-[85%] rounded-lg px-3 py-2 text-sm',
        isUser
          ? 'bg-accent-primary/15 text-text-primary rounded-tr-none'
          : 'bg-surface text-text-primary rounded-tl-none',
        isError && 'border border-danger/30 bg-danger/5 text-danger',
        message.isStreaming && 'ai-generating',
      )}>
        {isError ? (
          <div className="flex items-start gap-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>{message.content}</span>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Render message with basic markdown (bold, code, newlines) */}
            <MarkdownText text={message.content} />
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-accent-primary/60 animate-pulse ml-0.5 rounded-sm" />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Very lightweight inline markdown renderer for AI responses */
function MarkdownText({ text }: { text: string }) {
  if (!text) return null

  const lines = text.split('\n')

  return (
    <div className="space-y-1 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return <h3 key={i} className="font-semibold text-text-primary mt-2">{line.slice(4)}</h3>
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="font-bold text-text-primary mt-2">{line.slice(3)}</h2>
        }
        if (line.startsWith('# ')) {
          return <h1 key={i} className="font-bold text-lg text-text-primary mt-2">{line.slice(2)}</h1>
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return <li key={i} className="ml-3 list-disc">{renderInline(line.slice(2))}</li>
        }
        if (/^\d+\.\s/.test(line)) {
          return <li key={i} className="ml-3 list-decimal">{renderInline(line.replace(/^\d+\.\s/, ''))}</li>
        }
        if (line === '') {
          return <div key={i} className="h-1" />
        }
        return <p key={i}>{renderInline(line)}</p>
      })}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold**, *italic*, `code`
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="bg-surface-elevated text-accent-primary px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>
    }
    return <span key={i}>{part}</span>
  })
}
