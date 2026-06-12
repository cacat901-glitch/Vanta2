import { useEffect, useRef, useState, useCallback } from 'react'
import type { Editor } from '@tiptap/react'
import * as Icons from 'lucide-react'
import { cn } from '@/lib/utils'
import { filterSlashCommands, type SlashCommandDef } from './slashCommands'

interface SlashMenuProps {
  editor: Editor
}

interface MenuState {
  open: boolean
  query: string
  from: number // position of the "/" char
  coords: { top: number; left: number }
}

/** Floating slash command menu. Watches the editor for "/" triggers. */
export function SlashMenu({ editor }: SlashMenuProps) {
  const [state, setState] = useState<MenuState>({ open: false, query: '', from: 0, coords: { top: 0, left: 0 } })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const commands = filterSlashCommands(state.query)

  const close = useCallback(() => setState((s) => ({ ...s, open: false, query: '' })), [])

  const execute = useCallback((cmd: SlashCommandDef) => {
    // Delete the "/query" text then run the command
    const to = editor.state.selection.from
    editor.chain().focus().deleteRange({ from: state.from, to }).run()
    cmd.run(editor)
    close()
  }, [editor, state.from, close])

  useEffect(() => {
    setSelectedIndex(0)
  }, [state.query])

  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      const { state: edState } = editor
      const { from } = edState.selection
      const textBefore = edState.doc.textBetween(Math.max(0, from - 50), from, '\n', '\0')

      // Match a "/" followed by word chars at the end, preceded by start or whitespace
      const match = /(?:^|\s)\/(\w*)$/.exec(textBefore)
      if (match) {
        const slashOffset = textBefore.lastIndexOf('/')
        const slashPos = from - (textBefore.length - slashOffset)
        try {
          const coords = editor.view.coordsAtPos(from)
          setState({
            open: true,
            query: match[1] ?? '',
            from: slashPos,
            coords: { top: coords.bottom + 6, left: coords.left },
          })
        } catch {
          /* position not available */
        }
      } else {
        setState((s) => (s.open ? { ...s, open: false } : s))
      }
    }

    editor.on('update', handleUpdate)
    editor.on('selectionUpdate', handleUpdate)
    return () => {
      editor.off('update', handleUpdate)
      editor.off('selectionUpdate', handleUpdate)
    }
  }, [editor])

  useEffect(() => {
    if (!state.open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, commands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = commands[selectedIndex]
        if (cmd) execute(cmd)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [state.open, commands, selectedIndex, execute, close])

  if (!state.open || commands.length === 0) return null

  // Group commands
  const groups = commands.reduce<Record<string, SlashCommandDef[]>>((acc, cmd) => {
    ;(acc[cmd.group] ??= []).push(cmd)
    return acc
  }, {})

  let flatIndex = -1

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 max-h-80 overflow-y-auto rounded-lg border border-border-default bg-surface-elevated shadow-2xl py-1.5 no-scrollbar"
      style={{ top: Math.min(state.coords.top, window.innerHeight - 340), left: Math.min(state.coords.left, window.innerWidth - 270) }}
    >
      {Object.entries(groups).map(([group, cmds]) => (
        <div key={group}>
          <p className="px-3 py-1 text-2xs font-semibold text-text-muted uppercase tracking-wider">{group}</p>
          {cmds.map((cmd) => {
            flatIndex++
            const thisIndex = flatIndex
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic icon lookup
            const Icon = (Icons as any)[cmd.icon] ?? Icons.Square
            return (
              <button
                key={cmd.id}
                onMouseEnter={() => setSelectedIndex(thisIndex)}
                onMouseDown={(e) => { e.preventDefault(); execute(cmd) }}
                className={cn(
                  'flex items-center gap-3 w-full px-3 py-1.5 text-left transition-colors',
                  thisIndex === selectedIndex ? 'bg-accent-primary/15' : 'hover:bg-surface',
                )}
              >
                <div className="w-7 h-7 rounded-md bg-surface flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-text-primary truncate">{cmd.title}</p>
                  <p className="text-xs text-text-muted truncate">{cmd.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
