import { Node, mergeAttributes } from '@tiptap/core'
import katex from 'katex'

export interface MathBlockOptions {
  HTMLAttributes: Record<string, unknown>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathBlock: {
      setMathBlock: (latex?: string) => ReturnType
    }
  }
}

/** Block-level KaTeX math node. Trigger with $$ or slash command. */
export const MathBlock = Node.create<MathBlockOptions>({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { HTMLAttributes: {} }
  },

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') ?? '',
        renderHTML: (attrs) => ({ 'data-latex': attrs.latex as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="math-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'math-block' })]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div')
      dom.setAttribute('data-type', 'math-block')
      dom.className = 'math-block my-3 px-3 py-2 rounded-lg bg-surface-elevated cursor-pointer text-center'

      const render = (latex: string) => {
        try {
          katex.render(latex || '\\text{(empty equation — click to edit)}', dom, {
            displayMode: true,
            throwOnError: false,
          })
        } catch {
          dom.textContent = latex
        }
      }
      render(node.attrs.latex as string)

      dom.addEventListener('click', () => {
        const current = node.attrs.latex as string
        const next = window.prompt('Edit LaTeX equation:', current)
        if (next !== null && typeof getPos === 'function') {
          editor.chain().focus().command(({ tr }) => {
            tr.setNodeAttribute(getPos(), 'latex', next)
            return true
          }).run()
        }
      })

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'mathBlock') return false
          render(updatedNode.attrs.latex as string)
          return true
        },
      }
    }
  },

  addCommands() {
    return {
      setMathBlock:
        (latex = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    }
  },
})
