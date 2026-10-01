import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'
import cytoscape from 'cytoscape'
import type { GraphView, RiskBand } from '../api/types'
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react'

export interface GraphRef {
  fit: () => void
  focus: (id: string) => void
}

export interface GraphProps {
  view: GraphView
  selectedId?: string | null
  highlightIds?: string[]
  onSelect?: (id: string) => void
  ghost?: GraphView | null
  height?: number
  className?: string
}

export const Graph = forwardRef<GraphRef, GraphProps>(
  ({ view, selectedId, highlightIds, onSelect, ghost, height = 480, className = '' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null)
    const cyRef = useRef<cytoscape.Core | null>(null)
    const [hoveredNode, setHoveredNode] = useState<{
      id: string
      label: string
      band?: RiskBand | null
      p?: number | null
      impact?: number | null
      kind: string
      x: number
      y: number
    } | null>(null)

    useImperativeHandle(ref, () => ({
      fit: () => {
        cyRef.current?.fit(undefined, 30)
      },
      focus: (id: string) => {
        const node = cyRef.current?.getElementById(id)
        if (node && node.length > 0) {
          cyRef.current?.animate({
            center: { eles: node },
            zoom: 1.4,
            duration: 300,
          })
        }
      },
    }))

    // Initialize Cytoscape
    useEffect(() => {
      if (!containerRef.current) return

      const cy = cytoscape({
        container: containerRef.current,
        boxSelectionEnabled: false,
        autounselectify: false,
        style: [
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'color': '#cbd5e1',
              'font-size': '11px',
              'font-family': 'ui-monospace, monospace',
              'text-valign': 'bottom',
              'text-margin-y': 6,
              'text-background-color': '#080c14',
              'text-background-opacity': 0.85,
              'text-background-padding': '2px',
              'text-background-shape': 'roundrectangle',
              'width': 'data(size)',
              'height': 'data(size)',
              'background-color': 'data(bgColor)',
              'border-width': '2px',
              'border-color': 'data(borderColor)',
              'transition-property': 'background-color, border-color, opacity, border-width',
              'transition-duration': 0.2,
            },
          },
          {
            selector: 'node[kind = "entry"]',
            style: {
              'shape': 'diamond',
            },
          },
          {
            selector: 'node[kind = "group"]',
            style: {
              'shape': 'hexagon',
            },
          },
          {
            selector: 'node[kind = "account"]',
            style: {
              'shape': 'roundrectangle',
            },
          },
          {
            selector: 'node.ghost',
            style: {
              'border-style': 'dashed',
              'border-width': '3px',
              'opacity': 0.75,
            },
          },
          {
            selector: 'edge',
            style: {
              'width': 1.8,
              'curve-style': 'bezier',
              'line-color': '#2a3b5c',
              'target-arrow-color': '#3b82f6',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.9,
              'opacity': 0.65,
              'label': 'data(label)',
              'font-size': '9px',
              'font-family': 'ui-monospace, monospace',
              'text-rotation': 'autorotate',
              'text-margin-y': -8,
              'color': '#64748b',
              'text-opacity': 0,
              'transition-property': 'line-color, target-arrow-color, width, opacity, text-opacity',
              'transition-duration': 0.2,
            },
          },
          {
            selector: 'edge.active-edge',
            style: {
              'line-color': '#06b6d4',
              'target-arrow-color': '#06b6d4',
              'width': 2.8,
              'opacity': 1,
              'text-opacity': 1,
              'color': '#38bdf8',
              'z-index': 999,
            },
          },
          {
            selector: 'edge.ghost',
            style: {
              'line-style': 'dashed',
              'line-color': '#f59e0b',
              'target-arrow-color': '#f59e0b',
              'opacity': 0.8,
            },
          },
          {
            selector: 'node.selected',
            style: {
              'border-color': '#38bdf8',
              'border-width': '4px',
              'underlay-color': '#38bdf8',
              'underlay-padding': '4px',
              'underlay-opacity': 0.4,
            },
          },
          {
            selector: '.dimmed',
            style: {
              'opacity': 0.15,
            },
          },
        ],
      })

      cyRef.current = cy

      // Interactions
      cy.on('tap', 'node', (evt) => {
        const id = evt.target.id()
        onSelect?.(id)
      })

      cy.on('mouseover', 'node', (evt) => {
        const node = evt.target
        const pos = node.renderedPosition()
        const data = node.data()
        setHoveredNode({
          id: node.id(),
          label: data.label,
          band: data.band,
          p: data.p,
          impact: data.impact,
          kind: data.kind,
          x: pos.x,
          y: pos.y,
        })

        node.connectedEdges().addClass('active-edge')
      })

      cy.on('mouseout', 'node', (evt) => {
        setHoveredNode(null)
        evt.target.connectedEdges().removeClass('active-edge')
      })

      return () => {
        cy.destroy()
        cyRef.current = null
      }
    }, [onSelect])

    // Update Elements and Layout
    useEffect(() => {
      const cy = cyRef.current
      if (!cy) return

      const elements: cytoscape.ElementDefinition[] = []

      // Combine view nodes and ghost nodes
      const allNodes = [...(view?.nodes ?? [])]
      if (ghost?.nodes) {
        ghost.nodes.forEach((gn) => {
          if (!allNodes.some((n) => n.id === gn.id)) {
            allNodes.push({ ...gn, ghost: true })
          }
        })
      }

      // Group nodes by layer for preset layout computation
      const layers: Record<number, typeof allNodes> = { 0: [], 1: [], 2: [] }
      allNodes.forEach((n) => {
        const layer = n.layer ?? (n.kind === 'entry' || n.kind === 'group' ? 0 : 2)
        if (!layers[layer]) layers[layer] = []
        layers[layer].push(n)
      })

      // Sort stably by ID in each layer
      Object.keys(layers).forEach((k) => {
        layers[Number(k)].sort((a, b) => a.id.localeCompare(b.id))
      })

      const containerWidth = containerRef.current?.clientWidth || 900
      const containerHeight = height

      const yPositions = {
        0: containerHeight * 0.18,
        1: containerHeight * 0.52,
        2: containerHeight * 0.82,
      }

      // Compute preset positions
      allNodes.forEach((node) => {
        const layer = node.layer ?? (node.kind === 'entry' || node.kind === 'group' ? 0 : 2)
        const rowNodes = layers[layer] || []
        const index = rowNodes.findIndex((n) => n.id === node.id)
        const total = rowNodes.length

        const padding = 80
        const step = (containerWidth - padding * 2) / Math.max(1, total - 1 || 1)
        const x = total === 1 ? containerWidth / 2 : padding + index * step
        const y = yPositions[layer as keyof typeof yPositions] || containerHeight / 2

        const band = node.band
        const bgColor =
          node.kind === 'entry'
            ? '#0284c7'
            : node.kind === 'group'
            ? '#4f46e5'
            : band === 'high'
            ? '#ef4444'
            : band === 'medium'
            ? '#f59e0b'
            : '#10b981'

        const borderColor =
          node.kind === 'entry'
            ? '#38bdf8'
            : node.kind === 'group'
            ? '#818cf8'
            : band === 'high'
            ? '#fca5a5'
            : band === 'medium'
            ? '#fde68a'
            : '#6ee7b7'

        const size = Math.max(26, Math.min(54, (node.impact ?? 5) * 4.5 + 16))

        elements.push({
          data: {
            id: node.id,
            label: node.label,
            kind: node.kind,
            layer: node.layer,
            p: node.p,
            band: node.band,
            impact: node.impact,
            size,
            bgColor,
            borderColor,
          },
          position: { x, y },
          classes: node.ghost ? 'ghost' : '',
        })
      })

      // Add Edges
      const allEdges = [...(view?.edges ?? [])]
      if (ghost?.edges) {
        ghost.edges.forEach((ge) => {
          allEdges.push({ ...ge, ghost: true })
        })
      }

      allEdges.forEach((edge, idx) => {
        elements.push({
          data: {
            id: `e_${edge.source}_${edge.target}_${idx}`,
            source: edge.source,
            target: edge.target,
            label: edge.label,
          },
          classes: edge.ghost ? 'ghost' : '',
        })
      })

      cy.elements().remove()
      cy.add(elements)
      cy.fit(undefined, 30)
    }, [view, ghost, height])

    // Highlight & Selection styles
    useEffect(() => {
      const cy = cyRef.current
      if (!cy) return

      cy.elements().removeClass('selected dimmed active-edge')

      if (selectedId) {
        const node = cy.getElementById(selectedId)
        node.addClass('selected')
        node.connectedEdges().addClass('active-edge')
      }

      if (highlightIds && highlightIds.length > 0) {
        const highlightSet = new Set(highlightIds)
        cy.nodes().each((node) => {
          if (!highlightSet.has(node.id())) {
            node.addClass('dimmed')
          }
        })
        cy.edges().each((edge) => {
          if (!highlightSet.has(edge.source().id()) || !highlightSet.has(edge.target().id())) {
            edge.addClass('dimmed')
          }
        })
      }
    }, [selectedId, highlightIds])

    return (
      <div className={`relative bg-[#070b14] border border-[#1c2638] rounded-lg overflow-hidden ${className}`}>
        {/* Controls Overlay */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-[#0d1424]/90 backdrop-blur-md p-1 border border-[#222e47] rounded-md shadow-md">
          <button
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#18233a] rounded cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#18233a] rounded cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => cyRef.current?.fit(undefined, 30)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#18233a] rounded cursor-pointer"
            title="Reset View"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2.5 bg-[#0a0f1d]/90 backdrop-blur-md px-3 py-1.5 border border-[#1e2a42] rounded-md text-[11px] font-mono-code">
          <span className="text-slate-400">Legend:</span>
          <span className="inline-flex items-center gap-1 text-slate-300">
            <span className="w-2.5 h-2.5 rotate-45 bg-[#0284c7] inline-block border border-sky-300" /> Entry
          </span>
          <span className="inline-flex items-center gap-1 text-slate-300">
            <span className="w-2.5 h-2.5 bg-[#4f46e5] inline-block border border-indigo-300" /> Group
          </span>
          <span className="inline-flex items-center gap-1 text-red-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" /> High Risk
          </span>
          <span className="inline-flex items-center gap-1 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Med Risk
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Low Risk
          </span>
          {ghost && (
            <span className="inline-flex items-center gap-1 text-amber-400 border border-dashed border-amber-500/70 px-1 rounded">
              Ghost Preview
            </span>
          )}
        </div>

        {/* Tooltip */}
        {hoveredNode && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 p-2 bg-[#0a0f1d] border border-cyan-500/40 rounded shadow-xl text-left"
            style={{ left: hoveredNode.x, top: hoveredNode.y - 10 }}
          >
            <div className="text-xs font-bold text-slate-100 font-mono-code">
              {hoveredNode.label}
            </div>
            <div className="text-[10px] text-slate-400 font-mono-code mt-0.5">
              Type: {hoveredNode.kind} {hoveredNode.impact ? `| Impact: ${hoveredNode.impact}/10` : ''}
            </div>
            {hoveredNode.p !== undefined && hoveredNode.p !== null && (
              <div className="text-[11px] text-cyan-300 font-mono-code font-semibold mt-1">
                Takeover P: {Math.round(hoveredNode.p * 100)}% ({hoveredNode.band?.toUpperCase()})
              </div>
            )}
            <div className="text-[9px] text-slate-400 italic mt-1 border-t border-slate-800 pt-0.5">
              Model-based estimate
            </div>
          </div>
        )}

        {/* Canvas */}
        <div ref={containerRef} style={{ height }} className="w-full cursor-grab active:cursor-grabbing" />
      </div>
    )
  }
)
