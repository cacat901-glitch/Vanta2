import { Extension } from '@tiptap/core'
import { InputRule } from '@tiptap/core'

/**
 * Markdown-style input rules for math:
 *  - `$$ ` at line start → block math
 *  - `$x$` inline → inline math
 */
export const MathInputRules = Extension.create({
  name: 'mathInputRules',

  addInputRules() {
    return [
      // Block math: type "$$" then space
      new InputRule({
        find: /^\$\$\s$/,
        handler: ({ state, range, chain }) => {
          chain()
            .deleteRange(range)
            .insertContent({ type: 'mathBlock', attrs: { latex: '' } })
            .run()
          void state
        },
      }),
      // Inline math: type "$...$"
      new InputRule({
        find: /\$([^$]+)\$$/,
        handler: ({ range, match, chain }) => {
          const latex = match[1] ?? ''
          chain()
            .deleteRange(range)
            .insertContent({ type: 'mathInline', attrs: { latex } })
            .run()
        },
      }),
    ]
  },
})
