import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { MediaItem, MediaType, MediaTranscriptLine } from '@/types/media'
import { getDB } from '@/db'
import { getFileSystemAdapter } from '@/platform'
import { ingest, removeFromKnowledge, knowledgeId } from '@/services/knowledgeEngine'

interface MediaState {
  items: MediaItem[]
  isLoading: boolean
  load: () => Promise<void>
  addYouTube: (url: string) => Promise<MediaItem | null>
  addImage: (file: File) => Promise<MediaItem | null>
  addWebClip: (url: string, title: string, content: string) => Promise<MediaItem>
  setTranscript: (id: string, transcript: MediaTranscriptLine[]) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
    /^([\w-]{11})$/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]!
  }
  return null
}

export const useMediaStore = create<MediaState>()(
  immer((set) => ({
    items: [],
    isLoading: false,

    load: async () => {
      set((s) => { s.isLoading = true })
      const db = await getDB()
      set((s) => { s.items = []; s.isLoading = false })
      const items = await db.media.getAll()
      set((s) => { s.items = items })
    },

    addYouTube: async (url) => {
      const id = extractYouTubeId(url)
      if (!id) return null
      const db = await getDB()
      const item = await db.media.create({
        type: 'youtube', url: `https://www.youtube.com/watch?v=${id}`,
        title: 'YouTube Video', thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
        duration: null, channelName: null, courseId: null, transcript: null,
        filePath: null, tags: [], metadata: { videoId: id },
      })
      set((s) => { s.items.unshift(item) })
      return item
    },

    addImage: async (file) => {
      const db = await getDB()
      const fs = await getFileSystemAdapter()
      const bytes = new Uint8Array(await file.arrayBuffer())
      const path = `images/${Date.now()}-${file.name}`
      await fs.writeFile(path, bytes)
      const dataUrl = await fileToDataUrl(file)
      const item = await db.media.create({
        type: 'image', url: dataUrl, title: file.name, thumbnail: dataUrl,
        duration: null, channelName: null, courseId: null, transcript: null,
        filePath: path, tags: [], metadata: {},
      })
      set((s) => { s.items.unshift(item) })
      return item
    },

    addWebClip: async (url, title, content) => {
      const db = await getDB()
      const item = await db.media.create({
        type: 'web-clip', url, title, thumbnail: null, duration: null,
        channelName: null, courseId: null, transcript: null, filePath: null,
        tags: [], metadata: { content },
      })
      ingest({ id: knowledgeId.media(item.id), type: 'web_clip', title, content })
      set((s) => { s.items.unshift(item) })
      return item
    },

    setTranscript: async (id, transcript) => {
      const db = await getDB()
      await db.media.updateTranscript(id, transcript)
      // Index the transcript so the video becomes part of the knowledge base.
      const item = await db.media.getById(id)
      if (item) {
        ingest({
          id: knowledgeId.media(id),
          type: 'video',
          title: item.title ?? 'Video',
          content: transcript.map((t) => t.text).join('\n'),
          courseId: item.courseId,
        })
      }
      set((s) => {
        const it = s.items.find((i) => i.id === id)
        if (it) it.transcript = transcript
      })
    },

    remove: async (id) => {
      const db = await getDB()
      await db.media.delete(id)
      void removeFromKnowledge(knowledgeId.media(id))
      set((s) => { s.items = s.items.filter((i) => i.id !== id) })
    },
  })),
)

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.readAsDataURL(file)
  })
}

void (null as unknown as MediaType)
