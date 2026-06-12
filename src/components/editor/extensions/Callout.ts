import { Node, mergeAttributes } from '@tiptap/core'

export type CalloutType = 'info' | 'tip' | 'warning' | 'danger'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type: CalloutType) => ReturnType
      toggleCallout: (type: CalloutType) => ReturnType
    }
  }
}

const CALLOUT_META: Record<CalloutType, { icon: string; cls: string }> = {
  info: { icon: 'ℹ️', cls: 'callout-info' },
  tip: { icon: '💡', cls: 'callout-tip' },
  warning: { icon: '⚠️', cls: 'callout-warning' },
  danger: { icon: '🛑', cls: 'callout-danger' },
}

/** Notion-style colored callout block. Contains editable block content. */
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-callout-type') ?? 'info',
        renderHTML: (attrs) => ({ 'data-callout-type': attrs.type as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    const type = (node.attrs.type as CalloutType) ?? 'info'
    const meta = CALLOUT_META[type] ?? CALLOUT_META.info
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'callout',
        class: `callout ${meta.cls}`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setCallout:
        (type) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { type }),
      toggleCallout:
        (type) =>
        ({ commands }) =>
          commands.toggleWrap(this.name, { type }),
    }
  },
})
