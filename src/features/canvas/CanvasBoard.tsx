import { useEffect, useRef, useState, useCallback } from 'react'
import { fabric } from 'fabric'
import {
  MousePointer2, Pen, Highlighter, Eraser, Square, Circle as CircleIcon,
  Triangle, Minus, ArrowRight, Type, StickyNote, Hand,
  Undo, Redo, ZoomIn, ZoomOut, Maximize, Download, Trash2, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CanvasBackgroundType } from '@/types'

export type CanvasTool =
  | 'select' | 'pen' | 'highlighter' | 'eraser'
  | 'rect' | 'circle' | 'triangle' | 'line' | 'arrow'
  | 'text' | 'sticky' | 'pan'

const TOOLS: { id: CanvasTool; icon: typeof Pen; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'pen', icon: Pen, label: 'Pen (P)' },
  { id: 'highlighter', icon: Highlighter, label: 'Highlighter (H)' },
  { id: 'eraser', icon: Eraser, label: 'Eraser (E)' },
  { id: 'rect', icon: Square, label: 'Rectangle (R)' },
  { id: 'circle', icon: CircleIcon, label: 'Circle (O)' },
  { id: 'triangle', icon: Triangle, label: 'Triangle' },
  { id: 'line', icon: Minus, label: 'Line (L)' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow (A)' },
  { id: 'text', icon: Type, label: 'Text (T)' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky note (S)' },
  { id: 'pan', icon: Hand, label: 'Pan (Space)' },
]

const PALETTE = ['#EEEDF8', '#7C6FFF', '#3ECFB2', '#FFBB38', '#FF5263', '#4DA6FF', '#FF9040', '#E91E8C', '#000000']

const BACKGROUNDS: { id: CanvasBackgroundType; label: string }[] = [
  { id: 'blank-dark', label: 'Dark' },
  { id: 'blank-white', label: 'White' },
  { id: 'dot-small', label: 'Dots' },
  { id: 'graph-small', label: 'Grid' },
  { id: 'ruled-wide', label: 'Ruled' },
]

export interface CanvasBoardProps {
  initialData: unknown
  initialBackground: CanvasBackgroundType
  onSave: (data: unknown, bg: CanvasBackgroundType) => void
  onAI: (action: 'transcribe' | 'explain' | 'cleanup', dataUrl: string) => void
}


export function CanvasBoard({ initialData, initialBackground, onSave, onAI }: CanvasBoardProps) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<fabric.Canvas | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const toolRef = useRef<CanvasTool>('pen')
  const colorRef = useRef('#7C6FFF')
  const sizeRef = useRef(3)
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const isRestoring = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  const [tool, setTool] = useState<CanvasTool>('pen')
  const [color, setColor] = useState('#7C6FFF')
  const [size, setSize] = useState(3)
  const [background, setBackground] = useState<CanvasBackgroundType>(initialBackground)
  const [zoom, setZoom] = useState(1)

  toolRef.current = tool
  colorRef.current = color
  sizeRef.current = size

  // ─── Persist (debounced) ──────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const c = fabricRef.current
      if (c) onSave(c.toJSON(), background)
    }, 1500)
  }, [onSave, background])

  const pushUndo = useCallback(() => {
    const c = fabricRef.current
    if (!c || isRestoring.current) return
    undoStack.current.push(JSON.stringify(c.toJSON()))
    if (undoStack.current.length > 100) undoStack.current.shift()
    redoStack.current = []
    scheduleSave()
  }, [scheduleSave])


  // ─── Initialize Fabric ────────────────────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current || !wrapperRef.current) return
    const wrapper = wrapperRef.current
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: wrapper.clientWidth,
      height: wrapper.clientHeight,
      backgroundColor: 'transparent',
      selection: true,
      preserveObjectStacking: true,
    })
    fabricRef.current = canvas

    if (initialData && typeof initialData === 'object' && Object.keys(initialData).length > 0) {
      canvas.loadFromJSON(initialData, () => canvas.renderAll())
    }

    // Record history on object changes
    const onChange = () => pushUndo()
    canvas.on('object:added', onChange)
    canvas.on('object:modified', onChange)
    canvas.on('object:removed', onChange)

    // Resize handling
    const handleResize = () => {
      canvas.setWidth(wrapper.clientWidth)
      canvas.setHeight(wrapper.clientHeight)
      canvas.renderAll()
    }
    window.addEventListener('resize', handleResize)

    // Zoom with ctrl/cmd + wheel
    canvas.on('mouse:wheel', (opt) => {
      const e = opt.e as WheelEvent
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      let z = canvas.getZoom() * (0.999 ** e.deltaY)
      z = Math.min(Math.max(z, 0.2), 5)
      canvas.zoomToPoint(new fabric.Point(e.offsetX, e.offsetY), z)
      setZoom(z)
    })

    return () => {
      window.removeEventListener('resize', handleResize)
      canvas.dispose()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // ─── Configure tool behaviour ─────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return

    canvas.isDrawingMode = false
    canvas.selection = tool === 'select'
    canvas.defaultCursor = tool === 'pan' ? 'grab' : 'default'
    canvas.forEachObject((o) => { o.selectable = tool === 'select'; o.evented = tool === 'select' || tool === 'eraser' })

    // Freehand drawing (pen / highlighter)
    if (tool === 'pen' || tool === 'highlighter') {
      canvas.isDrawingMode = true
      const brush = new fabric.PencilBrush(canvas)
      brush.color = tool === 'highlighter' ? hexToRgba(color, 0.4) : color
      brush.width = tool === 'highlighter' ? size * 4 : size
      canvas.freeDrawingBrush = brush
    }

    // Pressure sensitivity: vary pen width with pointer pressure
    const handlePointerDown = (opt: fabric.IEvent) => {
      const e = opt.e as PointerEvent
      if ((tool === 'pen') && e.pressure && e.pressure > 0 && canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.width = Math.max(1, size * (0.4 + e.pressure * 1.6))
      }
    }
    canvas.on('mouse:down', handlePointerDown)

    // Eraser: click an object to delete it
    const handleEraser = (opt: fabric.IEvent) => {
      if (tool !== 'eraser') return
      if (opt.target) { canvas.remove(opt.target); canvas.requestRenderAll() }
    }
    canvas.on('mouse:down', handleEraser)

    // Pan
    let isPanning = false
    let lastPos = { x: 0, y: 0 }
    const onPanDown = (opt: fabric.IEvent) => {
      const e = opt.e as MouseEvent
      if (tool === 'pan' || e.button === 1) {
        isPanning = true
        canvas.selection = false
        lastPos = { x: e.clientX, y: e.clientY }
      }
    }
    const onPanMove = (opt: fabric.IEvent) => {
      if (!isPanning) return
      const e = opt.e as MouseEvent
      const vpt = canvas.viewportTransform!
      vpt[4] += e.clientX - lastPos.x
      vpt[5] += e.clientY - lastPos.y
      canvas.requestRenderAll()
      lastPos = { x: e.clientX, y: e.clientY }
    }
    const onPanUp = () => { isPanning = false }
    canvas.on('mouse:down', onPanDown)
    canvas.on('mouse:move', onPanMove)
    canvas.on('mouse:up', onPanUp)

    const cleanupShapes = attachShapeCreation(canvas, () => toolRef.current, () => colorRef.current, () => sizeRef.current)

    return () => {
      canvas.off('mouse:down', handlePointerDown)
      canvas.off('mouse:down', handleEraser)
      canvas.off('mouse:down', onPanDown)
      canvas.off('mouse:move', onPanMove)
      canvas.off('mouse:up', onPanUp)
      cleanupShapes()
    }
  }, [tool, color, size])


  // ─── Actions ──────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const c = fabricRef.current
    if (!c || undoStack.current.length < 2) return
    isRestoring.current = true
    const current = undoStack.current.pop()!
    redoStack.current.push(current)
    const prev = undoStack.current[undoStack.current.length - 1]!
    c.loadFromJSON(JSON.parse(prev), () => { c.renderAll(); isRestoring.current = false; scheduleSave() })
  }, [scheduleSave])

  const redo = useCallback(() => {
    const c = fabricRef.current
    if (!c || redoStack.current.length === 0) return
    isRestoring.current = true
    const next = redoStack.current.pop()!
    undoStack.current.push(next)
    c.loadFromJSON(JSON.parse(next), () => { c.renderAll(); isRestoring.current = false; scheduleSave() })
  }, [scheduleSave])

  const setZoomLevel = useCallback((z: number) => {
    const c = fabricRef.current
    if (!c) return
    const clamped = Math.min(Math.max(z, 0.2), 5)
    c.setZoom(clamped)
    setZoom(clamped)
  }, [])

  const fitToScreen = useCallback(() => {
    const c = fabricRef.current
    if (!c) return
    c.setViewportTransform([1, 0, 0, 1, 0, 0])
    c.setZoom(1)
    setZoom(1)
  }, [])

  const clearCanvas = useCallback(() => {
    const c = fabricRef.current
    if (!c || !confirm('Clear the entire canvas?')) return
    c.clear()
    c.setBackgroundColor('transparent', () => c.renderAll())
    pushUndo()
  }, [pushUndo])

  const exportImage = useCallback((format: 'png' | 'svg') => {
    const c = fabricRef.current
    if (!c) return
    if (format === 'svg') {
      const svg = c.toSVG()
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'canvas.svg')
    } else {
      const url = c.toDataURL({ format: 'png', multiplier: 2 })
      const a = document.createElement('a'); a.href = url; a.download = 'canvas.png'; a.click()
    }
  }, [])

  const handleAI = useCallback((action: 'transcribe' | 'explain' | 'cleanup') => {
    const c = fabricRef.current
    if (!c) return
    const dataUrl = c.toDataURL({ format: 'png', multiplier: 1 }).split(',')[1] ?? ''
    onAI(action, dataUrl)
  }, [onAI])


  // ─── Keyboard shortcuts ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); redo(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const c = fabricRef.current
        const active = c?.getActiveObjects()
        if (active && active.length) { active.forEach((o) => c!.remove(o)); c!.discardActiveObject(); c!.requestRenderAll() }
        return
      }
      const map: Record<string, CanvasTool> = { v: 'select', p: 'pen', h: 'highlighter', e: 'eraser', r: 'rect', o: 'circle', l: 'line', a: 'arrow', t: 'text', s: 'sticky' }
      if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]!)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  return (
    <div className="flex h-full">
      {/* Tool palette */}
      <div className="flex flex-col gap-1 p-1.5 border-r border-border-subtle bg-sidebar-bg">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            title={t.label}
            className={cn('w-9 h-9 flex items-center justify-center rounded-lg transition-colors',
              tool === t.id ? 'bg-accent-primary/20 text-accent-primary' : 'text-text-muted hover:bg-surface hover:text-text-primary')}
          >
            <t.icon size={17} />
          </button>
        ))}
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle bg-app-bg/95 flex-wrap">
          {/* Colors */}
          <div className="flex items-center gap-1">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                className={cn('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110', color === c ? 'border-white scale-110' : 'border-transparent')}
                style={{ backgroundColor: c }} />
            ))}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent" title="Custom color" />
          </div>
          <div className="w-px h-5 bg-border-subtle" />
          {/* Size */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Size</span>
            <input type="range" min={1} max={30} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-20 accent-accent-primary" />
          </div>
          <div className="w-px h-5 bg-border-subtle" />
          {/* Background */}
          <select value={background} onChange={(e) => setBackground(e.target.value as CanvasBackgroundType)}
            className="text-xs bg-surface border border-border-default rounded-md px-2 py-1 text-text-secondary outline-none">
            {BACKGROUNDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>

          <div className="flex-1" />

          {/* History + zoom */}
          <TBtn onClick={undo} title="Undo"><Undo size={15} /></TBtn>
          <TBtn onClick={redo} title="Redo"><Redo size={15} /></TBtn>
          <TBtn onClick={() => setZoomLevel(zoom - 0.2)} title="Zoom out"><ZoomOut size={15} /></TBtn>
          <span className="text-xs text-text-muted w-10 text-center">{Math.round(zoom * 100)}%</span>
          <TBtn onClick={() => setZoomLevel(zoom + 0.2)} title="Zoom in"><ZoomIn size={15} /></TBtn>
          <TBtn onClick={fitToScreen} title="Fit to screen"><Maximize size={15} /></TBtn>
          <div className="w-px h-5 bg-border-subtle" />
          {/* AI */}
          <button onClick={() => handleAI('transcribe')} title="Transcribe handwriting" className="flex items-center gap-1 px-2 h-7 rounded-md text-accent-primary hover:bg-accent-primary/15 text-xs font-medium">
            <Sparkles size={13} /> AI
          </button>
          <TBtn onClick={() => exportImage('png')} title="Export PNG"><Download size={15} /></TBtn>
          <TBtn onClick={clearCanvas} title="Clear canvas"><Trash2 size={15} /></TBtn>
        </div>

        {/* The canvas */}
        <div ref={wrapperRef} className={cn('flex-1 relative overflow-hidden', `canvas-bg-${background}`)}>
          <canvas ref={canvasElRef} />
        </div>
      </div>
    </div>
  )
}

function TBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:bg-surface hover:text-text-primary transition-colors">
      {children}
    </button>
  )
}


// ─── Shape creation logic ──────────────────────────────────────────────
function attachShapeCreation(
  canvas: fabric.Canvas,
  getTool: () => CanvasTool,
  getColor: () => string,
  getSize: () => number,
): () => void {
  let isDrawing = false
  let shape: fabric.Object | null = null
  let origin = { x: 0, y: 0 }

  const shapeTools: CanvasTool[] = ['rect', 'circle', 'triangle', 'line', 'arrow']

  const onDown = (opt: fabric.IEvent) => {
    const tool = getTool()
    const pointer = canvas.getPointer(opt.e)
    origin = { x: pointer.x, y: pointer.y }

    if (tool === 'text') {
      const text = new fabric.IText('Type here…', {
        left: pointer.x, top: pointer.y, fontSize: 20, fill: getColor(), fontFamily: 'Inter',
      })
      canvas.add(text); canvas.setActiveObject(text); text.enterEditing(); text.selectAll()
      return
    }
    if (tool === 'sticky') {
      const rect = new fabric.Rect({ width: 160, height: 160, fill: '#FFD56644', rx: 6, ry: 6, stroke: '#FFBB38', strokeWidth: 1 })
      const txt = new fabric.Textbox('Note…', { width: 140, fontSize: 15, fill: '#1a1a1a', left: 10, top: 10, fontFamily: 'Inter' })
      const group = new fabric.Group([rect, txt], { left: pointer.x, top: pointer.y })
      canvas.add(group)
      return
    }
    if (!shapeTools.includes(tool)) return

    isDrawing = true
    const color = getColor()
    const sw = getSize()
    const common = { left: origin.x, top: origin.y, fill: 'transparent', stroke: color, strokeWidth: sw }
    if (tool === 'rect') shape = new fabric.Rect({ ...common, width: 1, height: 1 })
    else if (tool === 'circle') shape = new fabric.Ellipse({ ...common, rx: 1, ry: 1 })
    else if (tool === 'triangle') shape = new fabric.Triangle({ ...common, width: 1, height: 1 })
    else if (tool === 'line' || tool === 'arrow') shape = new fabric.Line([origin.x, origin.y, origin.x, origin.y], { stroke: color, strokeWidth: sw })
    if (shape) canvas.add(shape)
  }

  const onMove = (opt: fabric.IEvent) => {
    if (!isDrawing || !shape) return
    const pointer = canvas.getPointer(opt.e)
    const tool = getTool()
    if (tool === 'rect' || tool === 'triangle') {
      shape.set({ width: Math.abs(pointer.x - origin.x), height: Math.abs(pointer.y - origin.y), left: Math.min(pointer.x, origin.x), top: Math.min(pointer.y, origin.y) })
    } else if (tool === 'circle') {
      (shape as fabric.Ellipse).set({ rx: Math.abs(pointer.x - origin.x) / 2, ry: Math.abs(pointer.y - origin.y) / 2, left: Math.min(pointer.x, origin.x), top: Math.min(pointer.y, origin.y) })
    } else if (tool === 'line' || tool === 'arrow') {
      (shape as fabric.Line).set({ x2: pointer.x, y2: pointer.y })
    }
    canvas.requestRenderAll()
  }

  const onUp = () => {
    if (isDrawing && shape && getTool() === 'arrow') {
      // Add arrowhead as a triangle at the line end
      const line = shape as fabric.Line
      const angle = Math.atan2((line.y2 ?? 0) - (line.y1 ?? 0), (line.x2 ?? 0) - (line.x1 ?? 0)) * 180 / Math.PI
      const head = new fabric.Triangle({ left: line.x2, top: line.y2, width: getSize() * 4, height: getSize() * 4, fill: getColor(), angle: angle + 90, originX: 'center', originY: 'center' })
      canvas.add(head)
    }
    isDrawing = false
    shape = null
  }

  canvas.on('mouse:down', onDown)
  canvas.on('mouse:move', onMove)
  canvas.on('mouse:up', onUp)

  return () => {
    canvas.off('mouse:down', onDown)
    canvas.off('mouse:move', onMove)
    canvas.off('mouse:up', onUp)
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
