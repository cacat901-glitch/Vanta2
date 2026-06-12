import katex from 'katex'

/** Coerce stored card content (unknown) to a string. */
export function cardText(content: unknown): string {
  if (typeof content === 'string') return content
  if (content && typeof content === 'object' && 'text' in content) {
    return String((content as { text: unknown }).text ?? '')
  }
  return ''
}

/** Render lightweight markdown + inline KaTeX ($...$) to HTML string. */
export function renderCardHTML(raw: string, hideCloze = false): string {
  let text = raw

  // Cloze: {{c1::answer}} → either hidden [...] or revealed answer
  text = text.replace(/\{\{c\d+::(.*?)\}\}/g, (_m, answer) =>
    hideCloze
      ? '<span class="cloze-blank">[ ... ]</span>'
      : `<span class="cloze-answer">${escapeHtml(String(answer))}</span>`,
  )

  // Inline math $...$
  text = text.replace(/\$([^$]+)\$/g, (_m, latex) => {
    try {
      return katex.renderToString(String(latex), { throwOnError: false })
    } catch {
      return escapeHtml(String(latex))
    }
  })

  // Bold / italic / code
  text = text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-surface-elevated text-accent-primary px-1 rounded text-sm">$1</code>')
    .replace(/\n/g, '<br/>')

  return text
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Strip cloze syntax to get the answer text (for the back of cloze cards). */
export function clozeAnswers(raw: string): string {
  const matches = [...raw.matchAll(/\{\{c\d+::(.*?)\}\}/g)]
  return matches.map((m) => m[1]).join(', ')
}

export function hasCloze(raw: string): boolean {
  return /\{\{c\d+::.*?\}\}/.test(raw)
}
