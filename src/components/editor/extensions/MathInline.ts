import { Node, mergeAttributes } from '@tiptap/core'
import katex from 'katex'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathInline: {
      setMathInline: (latex?: string) => ReturnType
    }
  }
}

/** Inline KaTeX math node. Trigger with $...$ */
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

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
    return [{ tag: 'span[data-type="math-inline"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'math-inline' })]
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('span')
      dom.setAttribute('data-type', 'math-inline')
      dom.className = 'math-inline cursor-pointer px-0.5'

      const render = (latex: string) => {
        try {
          katex.render(latex || '?', dom, { displayMode: false, throwOnError: false })
        } catch {
          dom.textContent = latex
        }
      }
      render(node.attrs.latex as string)

      dom.addEventListener('click', () => {
        const next = window.prompt('Edit inline math:', node.attrs.latex as string)
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
          if (updatedNode.type.name !== 'mathInline') return false
          render(updatedNode.attrs.latex as string)
          return true
        },
      }
    }
  },

  addCommands() {
    return {
      setMathInline:
        (latex = '') =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { latex } }),
    }
  },
})
