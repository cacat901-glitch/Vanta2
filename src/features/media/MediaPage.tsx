import { useEffect, useState, useRef } from 'react'
import { Youtube, Image as ImageIcon, Globe, Mic, Plus, Trash2, Loader2 } from 'lucide-react'
import { useMediaStore } from '@/store/mediaStore'
import { useAppStore } from '@/store/appStore'
import { YouTubeViewer } from './YouTubeViewer'
import { ImageViewer } from './ImageViewer'
import { AudioRecorder } from './AudioRecorder'
import { Button, Input } from '@/components/ui'
import { cn, relativeDate } from '@/lib/utils'
import { aiService, streamToString } from '@/services/ai'
import type { MediaItem, MediaType } from '@/types/media'

type Tab = 'youtube' | 'image' | 'web-clip' | 'audio'

const TABS: { id: Tab; label: string; icon: typeof Youtube }[] = [
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'image', label: 'Images', icon: ImageIcon },
  { id: 'web-clip', label: 'Web Clips', icon: Globe },
  { id: 'audio', label: 'Audio', icon: Mic },
]

export function MediaPage() {
  const [tab, setTab] = useState<Tab>('youtube')
  const [active, setActive] = useState<MediaItem | null>(null)
  const items = useMediaStore((s) => s.items)
  const load = useMediaStore((s) => s.load)
  const addYouTube = useMediaStore((s) => s.addYouTube)
  const addImage = useMediaStore((s) => s.addImage)
  const addWebClip = useMediaStore((s) => s.addWebClip)
  const remove = useMediaStore((s) => s.remove)
  const toast = useAppStore((s) => s.addToast)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { void load() }, [load])

  const filtered = items.filter((i) => i.type === (tab === 'audio' ? 'audio' : tab))

  const handleAddYouTube = async () => {
    if (!url.trim()) return
    const item = await addYouTube(url)
    if (item) { setUrl(''); toast({ type: 'success', title: 'Video added' }) }
    else toast({ type: 'error', title: 'Invalid YouTube URL' })
  }

  const handleAddWebClip = async () => {
    if (!url.trim()) return
    setBusy(true)
    try {
      // Attempt to fetch + extract via AI (CORS may block direct fetch)
      let content = ''
      let title = url
      try {
        const res = await fetch(url)
        const html = await res.text()
        const doc = new DOMParser().parseFromString(html, 'text/html')
        title = doc.title || url
        content = doc.body?.innerText?.slice(0, 8000) ?? ''
      } catch {
        if (aiService.isConfigured) {
          content = await streamToString(await aiService.summarize(url, 'paragraph'))
        }
      }
      await addWebClip(url, title, content || 'Could not extract content (CORS blocked). Paste manually.')
      setUrl(''); toast({ type: 'success', title: 'Web clip saved' })
    } finally { setBusy(false) }
  }

  if (active?.type === 'youtube') return <YouTubeViewer item={active} onBack={() => setActive(null)} />
  if (active?.type === 'image') return <ImageViewer item={active} onBack={() => setActive(null)} />

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border-subtle">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t.id ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-secondary hover:bg-surface')}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Add bar */}
          {tab === 'youtube' && (
            <div className="flex gap-2 mb-6">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste a YouTube URL…"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddYouTube() }} />
              <Button onClick={handleAddYouTube}><Plus size={14} /> Add</Button>
            </div>
          )}
          {tab === 'web-clip' && (
            <div className="flex gap-2 mb-6">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste an article URL…"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleAddWebClip() }} />
              <Button onClick={handleAddWebClip} disabled={busy}>{busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Clip</Button>
            </div>
          )}
          {tab === 'image' && (
            <div className="mb-6">
              <Button onClick={() => fileRef.current?.click()}><Plus size={14} /> Upload Image</Button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={async (e) => { for (const f of Array.from(e.target.files ?? [])) await addImage(f); toast({ type: 'success', title: 'Image added' }) }} />
            </div>
          )}
          {tab === 'audio' && <AudioRecorder />}

          {/* Gallery */}
          {tab !== 'audio' && (
            <MediaGallery items={filtered} tab={tab} onOpen={setActive} onRemove={remove} />
          )}
        </div>
      </div>
    </div>
  )
}

void (null as unknown as MediaType)

function MediaGallery({ items, tab, onOpen, onRemove }: {
  items: MediaItem[]; tab: Tab; onOpen: (i: MediaItem) => void; onRemove: (id: string) => void
}) {
  if (items.length === 0) {
    const labels: Record<Tab, string> = { youtube: 'No videos yet', image: 'No images yet', 'web-clip': 'No web clips yet', audio: '' }
    return <div className="text-center py-16 text-text-muted text-sm">{labels[tab]}</div>
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <div key={item.id} className="group relative">
          <button onClick={() => onOpen(item)}
            className="w-full aspect-video rounded-xl bg-surface border border-border-subtle hover:border-accent-primary/50 transition-colors overflow-hidden flex items-center justify-center">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt={item.title ?? ''} className="w-full h-full object-cover" />
            ) : (
              <Globe size={28} className="text-text-muted" />
            )}
          </button>
          <div className="mt-2 px-1">
            <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
            <p className="text-xs text-text-muted">{relativeDate(item.addedAt)}</p>
          </div>
          <button onClick={() => { if (confirm('Remove this item?')) onRemove(item.id) }}
            className="absolute top-2 right-2 w-7 h-7 rounded-md bg-surface-elevated text-text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
