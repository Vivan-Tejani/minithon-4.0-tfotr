import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react'
import cytoscape from 'cytoscape'
import type { GraphView, RiskBand } from '../api/types'
import { Maximize2, ZoomIn, ZoomOut, HelpCircle, Eye } from 'lucide-react'

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
    const [showLegend, setShowLegend] = useState(true)

    const [hoveredNode, setHoveredNode] = useState<{
      id: string
      label: string
      band?: RiskBand | null
      p?: number | null
      impact?: number | null
      kind: string
      layer: number
      isGhost?: boolean
      x: number
      y: number
    } | null>(null)

    // Fit canvas helper
    const fitCanvas = useCallback(() => {
      if (cyRef.current) {
        cyRef.current.animate({
          fit: { eles: cyRef.current.elements(), padding: 36 },
          duration: 250,
          easing: 'ease-out',
        })
      }
    }, [])

    // Focus on specific node helper
    const focusNode = useCallback((id: string) => {
      const cy = cyRef.current
      if (!cy) return
      const target = cy.getElementById(id)
      if (target && target.length > 0) {
        cy.animate({
          center: { eles: target },
          zoom: 1.45,
          duration: 350,
          easing: 'ease-out',
        })
      }
    }, [])

    useImperativeHandle(ref, () => ({
      fit: fitCanvas,
      focus: focusNode,
    }))

    // Initialize Cytoscape core
    useEffect(() => {
      if (!containerRef.current) return

      const cy = cytoscape({
        container: containerRef.current,
        boxSelectionEnabled: false,
        autounselectify: false,
        wheelSensitivity: 0.25,
        minZoom: 0.35,
        maxZoom: 3.5,
        style: [
          // Base Node Style
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'color': '#cbd5e1',
              'font-size': '11px',
              'font-family': 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              'text-valign': 'bottom',
              'text-margin-y': 7,
              'text-background-color': '#070b14',
              'text-background-opacity': 0.9,
              'text-background-padding': '3px',
              'text-background-shape': 'roundrectangle',
              'width': 'data(size)',
              'height': 'data(size)',
              'background-color': 'data(bgColor)',
              'border-width': '2px',
              'border-color': 'data(borderColor)',
              'transition-property': 'background-color, border-color, opacity, border-width, underlay-opacity',
              'transition-duration': 0.2,
            },
          },
          // Entry Node Style (Diamond)
          {
            selector: 'node[kind = "entry"]',
            style: {
              'shape': 'diamond',
              'background-color': '#0284c7',
              'border-color': '#38bdf8',
            },
          },
          // Credential Group Node Style (Hexagon)
          {
            selector: 'node[kind = "group"]',
            style: {
              'shape': 'hexagon',
              'background-color': '#4f46e5',
              'border-color': '#818cf8',
            },
          },
          // Account Node Style (Round Rectangle)
          {
            selector: 'node[kind = "account"]',
            style: {
              'shape': 'roundrectangle',
            },
          },
          // Ghost Preview Node Style
          {
            selector: 'node.ghost',
            style: {
              'border-style': 'dashed',
              'border-width': '3px',
              'border-color': '#f59e0b',
              'opacity': 0.85,
              'underlay-color': '#f59e0b',
              'underlay-padding': '4px',
              'underlay-opacity': 0.25,
            },
          },
          // Base Edge Style
          {
            selector: 'edge',
            style: {
              'width': 1.6,
              'curve-style': 'bezier',
              'line-color': '#22324f',
              'target-arrow-color': '#2a426c',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.85,
              'opacity': 0.65,
              'label': 'data(label)',
              'font-size': '10px',
              'font-family': 'ui-monospace, monospace',
              'text-rotation': 'autorotate',
              'text-margin-y': -8,
              'color': '#94a3b8',
              'text-opacity': 0, // only reveal on hover or active connected edges
              'text-background-color': '#080c14',
              'text-background-opacity': 0.9,
              'text-background-padding': '2px',
              'text-background-shape': 'roundrectangle',
              'transition-property': 'line-color, target-arrow-color, width, opacity, text-opacity',
              'transition-duration': 0.2,
            },
          },
          // Active & Hovered Connected Edges
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
          // Ghost Edge Style
          {
            selector: 'edge.ghost',
            style: {
              'line-style': 'dashed',
              'line-color': '#f59e0b',
              'target-arrow-color': '#f59e0b',
              'opacity': 0.9,
              'text-opacity': 1,
              'color': '#fbbf24',
              'z-index': 888,
            },
          },
          // Selected Node Glow
          {
            selector: 'node.selected',
            style: {
              'border-color': '#38bdf8',
              'border-width': '4px',
              'underlay-color': '#06b6d4',
              'underlay-padding': '6px',
              'underlay-opacity': 0.45,
              'z-index': 1000,
            },
          },
          // Highlighted Active Cascade Nodes (e.g. Scenarios Hop playback)
          {
            selector: 'node.highlighted',
            style: {
              'border-color': '#ef4444',
              'border-width': '3px',
              'underlay-color': '#ef4444',
              'underlay-padding': '5px',
              'underlay-opacity': 0.35,
              'z-index': 900,
            },
          },
          // Dimmed Inactive Nodes (when scenario highlight is active)
          {
            selector: '.dimmed',
            style: {
              'opacity': 0.12,
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
          layer: data.layer,
          isGhost: data.ghost,
          x: pos.x,
          y: pos.y,
        })

        // Reveal connected edges
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

      const containerWidth = containerRef.current?.clientWidth || 960
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

        const padding = 70
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

        const size = Math.max(28, Math.min(54, (node.impact ?? 5) * 4.2 + 16))

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
            ghost: Boolean(node.ghost),
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
      cy.fit(undefined, 36)
    }, [view, ghost, height])

    // Highlight & Selection synchronization
    useEffect(() => {
      const cy = cyRef.current
      if (!cy) return

      cy.elements().removeClass('selected dimmed active-edge highlighted')

      // Selected Node styling
      if (selectedId) {
        const node = cy.getElementById(selectedId)
        if (node.length > 0) {
          node.addClass('selected')
          node.connectedEdges().addClass('active-edge')
        }
      }

      // Highlighted IDs (e.g. Scenarios Hop playback)
      if (highlightIds && highlightIds.length > 0) {
        const highlightSet = new Set(highlightIds)

        cy.nodes().each((node) => {
          if (highlightSet.has(node.id())) {
            node.addClass('highlighted')
          } else {
            node.addClass('dimmed')
          }
        })

        cy.edges().each((edge) => {
          if (highlightSet.has(edge.source().id()) && highlightSet.has(edge.target().id())) {
            edge.addClass('active-edge')
          } else {
            edge.addClass('dimmed')
          }
        })
      }
    }, [selectedId, highlightIds])

    // Container Resize Observer
    useEffect(() => {
      if (!containerRef.current) return
      const observer = new ResizeObserver(() => {
        if (cyRef.current) {
          cyRef.current.resize()
          cyRef.current.fit(undefined, 36)
        }
      })
      observer.observe(containerRef.current)
      return () => observer.disconnect()
    }, [])

    return (
      <div className={`relative bg-[#070b14] border border-[#1c2638] rounded-lg overflow-hidden ${className}`}>
        {/* Navigation & View Controls Overlay */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-[#0d1424]/90 backdrop-blur-md p-1 border border-[#222e47] rounded-md shadow-md">
          <button
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#18233a] rounded cursor-pointer transition-colors"
            title="Zoom In"
            aria-label="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#18233a] rounded cursor-pointer transition-colors"
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={fitCanvas}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-[#18233a] rounded cursor-pointer transition-colors"
            title="Reset & Fit View"
            aria-label="Fit Canvas"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowLegend((prev) => !prev)}
            className={`p-1.5 rounded cursor-pointer transition-colors ${
              showLegend
                ? 'text-cyan-300 bg-cyan-950/60'
                : 'text-slate-400 hover:text-slate-100 hover:bg-[#18233a]'
            }`}
            title="Toggle Legend"
            aria-label="Toggle Legend"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

        {/* Legend Overlay */}
        {showLegend && (
          <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 bg-[#0a0f1d]/95 backdrop-blur-md px-3.5 py-2 border border-[#1e2a42] rounded-md text-[11px] font-mono-code shadow-lg">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Topology:</span>
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 rotate-45 bg-[#0284c7] inline-block border border-sky-300 shadow-[0_0_6px_rgba(2,132,199,0.5)]" />{' '}
              Entry Vector
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <span className="w-2.5 h-2.5 bg-[#4f46e5] inline-block border border-indigo-300 shadow-[0_0_6px_rgba(79,70,229,0.5)]" />{' '}
              Password Group
            </span>
            <span className="inline-flex items-center gap-1.5 text-red-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block shadow-[0_0_6px_rgba(239,68,68,0.5)]" />{' '}
              High Risk (P≥40%)
            </span>
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Med Risk (15–39%)
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Low Risk (&lt;15%)
            </span>
            {ghost && (
              <span className="inline-flex items-center gap-1 text-amber-300 border border-dashed border-amber-500 px-1.5 py-0.5 rounded bg-amber-950/30">
                <Eye className="w-3 h-3 text-amber-400" /> Ghost Delta
              </span>
            )}
          </div>
        )}

        {/* Hover Diagnostic Tooltip */}
        {hoveredNode && (
          <div
            className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 p-3 bg-[#090e1a] border border-cyan-500/50 rounded-lg shadow-2xl text-left min-w-[210px] max-w-[280px]"
            style={{
              left: Math.max(120, Math.min(hoveredNode.x, (containerRef.current?.clientWidth || 900) - 120)),
              top: Math.max(10, hoveredNode.y - 12),
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-[#1c2638] pb-1.5 mb-1.5">
              <span className="text-xs font-bold text-slate-100 font-mono-code truncate">
                {hoveredNode.label}
              </span>
              {hoveredNode.isGhost && (
                <span className="text-[9px] font-mono-code bg-amber-950 text-amber-300 border border-amber-800 px-1 rounded">
                  GHOST
                </span>
              )}
            </div>

            <div className="space-y-1 text-[11px] font-mono-code text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Node Kind:</span>
                <span className="text-slate-100 uppercase">{hoveredNode.kind}</span>
              </div>

              {hoveredNode.impact !== undefined && hoveredNode.impact !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Impact Score:</span>
                  <span className="text-slate-100 font-bold">{hoveredNode.impact} / 10</span>
                </div>
              )}

              {hoveredNode.p !== undefined && hoveredNode.p !== null && (
                <div className="flex items-center justify-between text-cyan-300 font-semibold pt-1 border-t border-[#1c2638]">
                  <span>Takeover Prob:</span>
                  <span>{Math.round(hoveredNode.p * 100)}% ({hoveredNode.band?.toUpperCase()})</span>
                </div>
              )}
            </div>

            <div className="text-[9px] text-slate-400 italic mt-2 border-t border-[#1c2638]/80 pt-1 leading-tight">
              Model-based estimate, not a measured probability. Data stays on this device.
            </div>
          </div>
        )}

        {/* Cytoscape Canvas Container */}
        <div
          ref={containerRef}
          style={{ height }}
          className="w-full cursor-grab active:cursor-grabbing focus:outline-none"
        />
      </div>
    )
  }
)
