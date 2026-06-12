import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Network, RefreshCw } from 'lucide-react'
import { getDB } from '@/db'
import { useCourseStore } from '@/store/courseStore'
import type { KnowledgeObjectType } from '@/types/knowledge'

interface GNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  type: KnowledgeObjectType | 'course'
  connections: number
}
interface GLink extends d3.SimulationLinkDatum<GNode> {
  source: string | GNode
  target: string | GNode
}

const TYPE_COLOR: Record<string, string> = {
  page: '#7C6FFF', note: '#7C6FFF', pdf: '#FF5263', lecture: '#4DA6FF',
  course: '#3ECFB2', flashcard: '#FFBB38', video: '#FF9040', web_clip: '#00BCD4',
  document: '#FF5263', mindmap: '#E91E8C', canvas: '#8BC34A', concept: '#9183FF',
}

export function GraphPage() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const courses = useCourseStore((s) => s.courses)
  const [empty, setEmpty] = useState(false)
  const [loading, setLoading] = useState(true)

  const build = async () => {
    setLoading(true)
    const db = await getDB()
    const objects = await db.knowledge.getAll()

    const nodes: GNode[] = []
    const links: GLink[] = []
    const nodeIds = new Set<string>()

    // Course nodes
    for (const c of courses) {
      nodes.push({ id: `course:${c.id}`, label: c.name, type: 'course', connections: 0 })
      nodeIds.add(`course:${c.id}`)
    }
    // Knowledge object nodes
    for (const o of objects) {
      nodes.push({ id: o.id, label: o.title, type: o.type, connections: 0 })
      nodeIds.add(o.id)
      if (o.courseId && nodeIds.has(`course:${o.courseId}`)) {
        links.push({ source: o.id, target: `course:${o.courseId}` })
      }
    }
    // Tag-based + title-mention links (lightweight semantic association)
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const a = objects[i]!, b = objects[j]!
        const shared = a.tags.filter((t) => b.tags.includes(t)).length
        const mentions = a.content.toLowerCase().includes(b.title.toLowerCase()) || b.content.toLowerCase().includes(a.title.toLowerCase())
        if (shared > 0 || mentions) links.push({ source: a.id, target: b.id })
      }
    }

    // Count connections
    for (const l of links) {
      const s = typeof l.source === 'string' ? l.source : l.source.id
      const t = typeof l.target === 'string' ? l.target : l.target.id
      const sn = nodes.find((n) => n.id === s); if (sn) sn.connections++
      const tn = nodes.find((n) => n.id === t); if (tn) tn.connections++
    }

    setEmpty(nodes.length === 0)
    setLoading(false)
    if (nodes.length > 0) renderGraph(nodes, links)
  }

  const renderGraph = (nodes: GNode[], links: GLink[]) => {
    const container = containerRef.current
    const svgEl = svgRef.current
    if (!container || !svgEl) return
    const width = container.clientWidth
    const height = container.clientHeight

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    svg.attr('viewBox', `0 0 ${width} ${height}`)

    const g = svg.append('g')
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]).on('zoom', (e) => g.attr('transform', e.transform))
    svg.call(zoom)

    const sim = d3.forceSimulation<GNode>(nodes)
      .force('link', d3.forceLink<GNode, GLink>(links).id((d) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(30))

    const link = g.append('g').attr('stroke', '#2A2A3D').attr('stroke-width', 1)
      .selectAll('line').data(links).join('line')

    const node = g.append('g').selectAll<SVGGElement, GNode>('g').data(nodes).join('g')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, GNode>()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null }))

    node.append('circle')
      .attr('r', (d) => 6 + Math.min(d.connections * 2, 14))
      .attr('fill', (d) => TYPE_COLOR[d.type] ?? '#8A8AA8')
      .attr('stroke', '#0F0F13').attr('stroke-width', 2)

    node.append('text')
      .text((d) => d.label.length > 18 ? d.label.slice(0, 18) + '…' : d.label)
      .attr('x', 12).attr('y', 4).attr('fill', '#8A8AA8').attr('font-size', 11)

    node.append('title').text((d) => `${d.label} (${d.type})`)

    sim.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as GNode).x ?? 0).attr('y1', (d) => (d.source as GNode).y ?? 0)
        .attr('x2', (d) => (d.target as GNode).x ?? 0).attr('y2', (d) => (d.target as GNode).y ?? 0)
      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })
  }

  useEffect(() => { void build() }, [courses.length])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
        <h1 className="flex items-center gap-2 text-sm font-medium text-text-primary"><Network size={16} className="text-accent-primary" /> Knowledge Graph</h1>
        <button onClick={() => build()} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary"><RefreshCw size={13} /> Rebuild</button>
      </div>
      <div ref={containerRef} className="flex-1 relative bg-app-bg">
        {empty && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
            <Network size={40} className="text-text-muted" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Your graph is empty</h2>
              <p className="text-text-muted text-sm mt-1">Create notes, import PDFs, and add courses — they'll connect here automatically.</p>
            </div>
          </div>
        )}
        <svg ref={svgRef} className="w-full h-full" />
      </div>
    </div>
  )
}
