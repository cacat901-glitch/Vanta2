import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format bytes to human readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

/** Format seconds to mm:ss */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Estimate reading time in minutes */
export function readingTime(wordCount: number): number {
  return Math.ceil(wordCount / 200)
}

/** Truncate a string to max length with ellipsis */
export function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

/** Generate a random color from course palette */
export const COURSE_COLORS = [
  '#7C6FFF', '#3ECFB2', '#FFBB38', '#FF5263',
  '#4DA6FF', '#4CAF50', '#E91E8C', '#FF9040',
  '#00BCD4', '#8BC34A',
] as const

export function randomCourseColor(): string {
  return COURSE_COLORS[Math.floor(Math.random() * COURSE_COLORS.length)] ?? '#7C6FFF'
}

/** Debounce a function */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/** Format a date relative to now (today, yesterday, 3 days ago, etc.) */
export function relativeDate(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return date.toLocaleDateString()
}

/** Extract plain text from TipTap JSON content */
export function extractTextFromTiptap(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  const doc = content as { type?: string; text?: string; content?: unknown[] }
  if (doc.text) return doc.text
  if (!doc.content) return ''
  return doc.content.map(extractTextFromTiptap).join(' ')
}

/** Generate initials from a name */
export function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
