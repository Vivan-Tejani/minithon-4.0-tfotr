import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react'
import cytoscape from 'cytoscape'
import type { GraphView, RiskBand } from '../api/types'
import { useGhost } from '../api/hooks'
import {
  Maximize2,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Eye,
  Search,
} from 'lucide-react'

export interface GraphRef {
  fit: () => void
  focus: (id: string) => void
  setLayout: (mode: 'organic' | 'hierarchical' | 'concentric') => void
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

// Deterministic position calculator
function computeLayoutPositions(
  nodes: { id: string; kind?: string; layer?: number }[],
  mode: 'hierarchical' | 'organic' | 'concentric',
  width: number,
  height: number
): Record<string, { x: number; y: number }> {
  const w = Math.max(640, width)
  const h = Math.max(400, height)
  const cx = w / 2
  const cy = h / 2
  const minDim = Math.min(w, h)
  const posMap: Record<string, { x: number; y: number }> = {}

  if (nodes.length === 0) return posMap

  if (mode === 'hierarchical') {
    const layers: Record<number, typeof nodes> = { 0: [], 1: [], 2: [] }
    nodes.forEach((n) => {
      const l = n.layer ?? (n.kind === 'entry' || n.kind === 'group' ? 0 : 2)
      if (!layers[l]) layers[l] = []
      layers[l].push(n)
    })
    Object.keys(layers).forEach((k) => {
      layers[Number(k)].sort((a, b) => a.id.localeCompare(b.id))
    })

    const yMap = {
      0: Math.max(70, h * 0.18),
      1: h * 0.50,
      2: Math.min(h - 70, h * 0.82),
    }

    ;[0, 1, 2].forEach((l) => {
      const row = layers[l] || []
      const total = row.length
      const padding = 70
      const step = total > 1 ? (w - padding * 2) / (total - 1) : 0
      row.forEach((n, i) => {
        posMap[n.id] = {
          x: total === 1 ? cx : padding + i * step,
          y: yMap[l as keyof typeof yMap] || cy,
        }
      })
    })
  } else if (mode === 'concentric') {
    const hubs = nodes.filter((n) => n.kind === 'entry' || n.kind === 'group')
    const others = nodes.filter((n) => n.kind !== 'entry' && n.kind !== 'group')

    hubs.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, hubs.length) - Math.PI / 2
      posMap[n.id] = {
        x: cx + Math.cos(angle) * (minDim * 0.22),
        y: cy + Math.sin(angle) * (minDim * 0.22),
      }
    })

    others.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, others.length) - Math.PI / 2
      posMap[n.id] = {
        x: cx + Math.cos(angle) * (minDim * 0.38),
        y: cy + Math.sin(angle) * (minDim * 0.38),
      }
    })
  } else {
    // Organic constellation layout
    const total = nodes.length
    nodes.forEach((n, i) => {
      const goldenAngle = i * 2.39996
      const r = (minDim * 0.36) * Math.sqrt((i + 1) / Math.max(1, total))
      posMap[n.id] = {
        x: cx + Math.cos(goldenAngle) * r,
        y: cy + Math.sin(goldenAngle) * r,
      }
    })
  }

  return posMap
}

export const Graph = forwardRef<GraphRef, GraphProps>(
  ({ view, selectedId, highlightIds, onSelect, ghost, height = 520, className = '' }, ref) => {
    const { ghost: contextGhost } = useGhost()
    const effectiveGhost = ghost !== undefined ? ghost : contextGhost

    const containerRef = useRef<HTMLDivElement>(null)
    const cyRef = useRef<cytoscape.Core | null>(null)
    const [showLegend, setShowLegend] = useState(true)
    const [layoutMode, setLayoutMode] = useState<'organic' | 'hierarchical' | 'concentric'>('hierarchical')
    const [searchQuery, setSearchQuery] = useState('')
    const [activeFilter, setActiveFilter] = useState<'all' | 'high' | 'spofs' | 'entry'>('all')

    const [hoveredNode, setHoveredNode] = useState<{
      id: string
      label: string
      band?: RiskBand | null
      p?: number | null
      impact?: number | null
      kind: string
      layer: number
      isGhost?: boolean
      inDegree?: number
      outDegree?: number
      x: number
      y: number
    } | null>(null)

    // Fit canvas helper
    const fitCanvas = useCallback(() => {
      if (cyRef.current) {
        cyRef.current.resize()
        cyRef.current.animate({
          fit: { eles: cyRef.current.elements(), padding: 42 },
          duration: 300,
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

    // Smooth layout switcher
    const handleLayoutChange = useCallback(
      (newMode: 'organic' | 'hierarchical' | 'concentric') => {
        setLayoutMode(newMode)
        const cy = cyRef.current
        if (!cy) return

        const containerWidth = containerRef.current?.clientWidth || 960
        const containerHeight = height

        const allNodeData = cy.nodes().map((n) => ({
          id: n.id(),
          kind: n.data('kind'),
          layer: n.data('layer'),
        }))

        const newPositions = computeLayoutPositions(
          allNodeData,
          newMode,
          containerWidth,
          containerHeight
        )

        cy.batch(() => {
          cy.nodes().each((node) => {
            const pos = newPositions[node.id()]
            if (pos) {
              node.animate({
                position: pos,
                duration: 400,
                easing: 'ease-out',
              })
            }
          })
        })

        setTimeout(() => {
          if (cyRef.current) {
            cyRef.current.animate({
              fit: { eles: cyRef.current.elements(), padding: 42 },
              duration: 250,
              easing: 'ease-out',
            })
          }
        }, 440)
      },
      [height]
    )

    useImperativeHandle(ref, () => ({
      fit: fitCanvas,
      focus: focusNode,
      setLayout: handleLayoutChange,
    }))

    const onSelectRef = useRef(onSelect)
    useEffect(() => {
      onSelectRef.current = onSelect
    }, [onSelect])

    const initCytoscape = useCallback(() => {
      if (!containerRef.current) return null
      if (cyRef.current && !cyRef.current.destroyed()) {
        return cyRef.current
      }

      const cy = cytoscape({
        container: containerRef.current,
        boxSelectionEnabled: false,
        autounselectify: false,
        minZoom: 0.2,
        maxZoom: 4,
        style: [
          // Flat neutral gray nodes by default, red/amber/green ring only for risk
          {
            selector: 'node',
            style: {
              'label': 'data(label)',
              'color': '#d4d4d8',
              'font-size': '11px',
              'font-family': 'Inter, system-ui, sans-serif',
              'font-weight': 400,
              'text-valign': 'bottom',
              'text-margin-y': 7,
              'text-background-color': '#18181b',
              'text-background-opacity': 0.9,
              'text-background-padding': '3px',
              'text-background-shape': 'roundrectangle',
              'width': 'data(size)',
              'height': 'data(size)',
              'background-color': '#27272a',
              'border-width': '2px',
              'border-color': 'data(borderColor)',
              'transition-property': 'background-color, border-color, opacity, border-width',
              'transition-duration': 0.15,
            },
          },
          // Entry Node
          {
            selector: 'node[kind = "entry"]',
            style: {
              'shape': 'ellipse',
              'background-color': '#27272a',
              'border-color': '#71717a',
              'border-width': '2px',
            },
          },
          // Credential Group Node
          {
            selector: 'node[kind = "group"]',
            style: {
              'shape': 'hexagon',
              'background-color': '#27272a',
              'border-color': '#71717a',
              'border-width': '2px',
            },
          },
          // Account Node
          {
            selector: 'node[kind = "account"]',
            style: {
              'shape': 'ellipse',
            },
          },
          // Ghost Preview Node Style
          {
            selector: 'node.ghost',
            style: {
              'border-style': 'dashed',
              'border-width': '2px',
              'border-color': '#f59e0b',
              'opacity': 0.85,
            },
          },
          // Flat, thin gray edges, no glow
          {
            selector: 'edge',
            style: {
              'width': 1.5,
              'curve-style': 'bezier',
              'line-color': '#3f3f46',
              'target-arrow-color': '#52525b',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.75,
              'opacity': 0.6,
              'label': 'data(label)',
              'font-size': '10px',
              'font-family': 'Inter, system-ui, sans-serif',
              'text-rotation': 'autorotate',
              'text-margin-y': -7,
              'color': '#a1a1aa',
              'text-opacity': 0,
              'text-background-color': '#18181b',
              'text-background-opacity': 0.9,
              'text-background-padding': '2px',
              'text-background-shape': 'roundrectangle',
              'transition-property': 'line-color, target-arrow-color, width, opacity, text-opacity',
              'transition-duration': 0.15,
            },
          },
          // Active & Hovered Connected Edges
          {
            selector: 'edge.active-edge',
            style: {
              'line-color': '#fafafa',
              'target-arrow-color': '#fafafa',
              'width': 2,
              'opacity': 1,
              'text-opacity': 1,
              'color': '#fafafa',
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
              'opacity': 0.8,
              'z-index': 888,
            },
          },
          // Selected Node
          {
            selector: 'node.selected',
            style: {
              'border-color': '#fafafa',
              'border-width': '3px',
              'z-index': 1000,
            },
          },
          // Highlighted Active Cascade Nodes
          {
            selector: 'node.highlighted',
            style: {
              'border-color': '#ef4444',
              'border-width': '3px',
              'z-index': 950,
            },
          },
          // Dimmed elements
          {
            selector: '.dimmed',
            style: {
              'opacity': 0.15,
            },
          },
          {
            selector: 'node.neighbor-focus',
            style: {
              'border-color': '#fafafa',
              'border-width': '2.5px',
            },
          },
        ],
      })

      cyRef.current = cy

      // Interactions: Node click
      cy.on('tap', 'node', (evt) => {
        const id = evt.target.id()
        onSelectRef.current?.(id)
      })

      // Hover over node: Focus effect
      cy.on('mouseover', 'node', (evt) => {
        const node = evt.target
        const pos = node.renderedPosition()
        const data = node.data()

        const inDegree = node.indegree()
        const outDegree = node.outdegree()

        setHoveredNode({
          id: node.id(),
          label: data.label,
          band: data.band,
          p: data.p,
          impact: data.impact,
          kind: data.kind,
          layer: data.layer,
          isGhost: data.ghost,
          inDegree,
          outDegree,
          x: pos.x,
          y: pos.y,
        })

        cy.elements().addClass('dimmed')

        node.removeClass('dimmed')
        const connectedEdges = node.connectedEdges()
        const connectedNodes = connectedEdges.connectedNodes()

        connectedEdges.removeClass('dimmed').addClass('active-edge')
        connectedNodes.removeClass('dimmed').addClass('neighbor-focus')
      })

      // Mouse out from node: restore graph
      cy.on('mouseout', 'node', () => {
        setHoveredNode(null)
        cy.elements().removeClass('dimmed active-edge neighbor-focus')
      })

      return cy
    }, [])

    // Initialize Cytoscape core on mount
    useEffect(() => {
      initCytoscape()

      return () => {
        if (cyRef.current) {
          cyRef.current.destroy()
          cyRef.current = null
        }
      }
    }, [initCytoscape])

    // Update Elements & Positions Deterministically
    useEffect(() => {
      const cy = initCytoscape()
      if (!cy) return

      const elements: cytoscape.ElementDefinition[] = []

      // Combine view nodes and ghost nodes
      const allNodes = [...(view?.nodes ?? [])]
      if (effectiveGhost?.nodes) {
        effectiveGhost.nodes.forEach((gn) => {
          if (!allNodes.some((n) => n.id === gn.id)) {
            allNodes.push({ ...gn, ghost: true })
          }
        })
      }

      const containerWidth = Math.max(640, containerRef.current?.clientWidth || 960)
      const containerHeight = Math.max(400, height || 480)

      // Deterministically calculate positions
      const posMap = computeLayoutPositions(allNodes, layoutMode, containerWidth, containerHeight)

      // Add Nodes
      allNodes.forEach((node) => {
        const band = node.band
        // Red/amber/green ring only for risk, neutral gray for rest
        const borderColor =
          band === 'high'
            ? '#ef4444'
            : band === 'medium'
            ? '#f59e0b'
            : band === 'low'
            ? '#10b981'
            : '#52525b'

        const size = Math.max(28, Math.min(48, (node.impact ?? 5) * 3.5 + 16))
        const pos = posMap[node.id] || { x: containerWidth / 2, y: containerHeight / 2 }

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
            borderColor,
            ghost: Boolean(node.ghost),
          },
          position: pos,
          classes: node.ghost ? 'ghost' : '',
        })
      })

      // Add Edges
      const allEdges = [...(view?.edges ?? [])]
      if (effectiveGhost?.edges) {
        effectiveGhost.edges.forEach((ge) => {
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

      // Safe Auto fit
      try {
        cy.resize()
        if (elements.length > 0) {
          cy.fit(cy.elements(), 36)
        }
      } catch {
        // Defensive
      }

      const timer1 = setTimeout(() => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          try {
            cyRef.current.resize()
            if (cyRef.current.nodes().length > 0) {
              cyRef.current.fit(cyRef.current.elements(), 36)
            }
          } catch {
            // Defensive
          }
        }
      }, 50)

      const timer2 = setTimeout(() => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          try {
            cyRef.current.resize()
            if (cyRef.current.nodes().length > 0) {
              cyRef.current.fit(cyRef.current.elements(), 36)
            }
          } catch {
            // Defensive
          }
        }
      }, 200)

      const timer3 = setTimeout(() => {
        if (cyRef.current && !cyRef.current.destroyed()) {
          try {
            cyRef.current.resize()
            if (cyRef.current.nodes().length > 0) {
              cyRef.current.fit(cyRef.current.elements(), 36)
            }
          } catch {
            // Defensive
          }
        }
      }, 500)

      return () => {
        clearTimeout(timer1)
        clearTimeout(timer2)
        clearTimeout(timer3)
      }
    }, [view, effectiveGhost, height, layoutMode, initCytoscape])

    // Highlight & Selection synchronization
    useEffect(() => {
      const cy = cyRef.current
      if (!cy) return

      cy.elements().removeClass('selected dimmed active-edge highlighted')

      if (selectedId) {
        const node = cy.getElementById(selectedId)
        if (node.length > 0) {
          node.addClass('selected')
          node.connectedEdges().addClass('active-edge')
        }
      }

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

    // Search and filter handling
    const handleSearchChange = (query: string) => {
      setSearchQuery(query)
      const cy = cyRef.current
      if (!cy) return

      if (!query.trim()) {
        cy.elements().removeClass('dimmed active-edge')
        return
      }

      const q = query.toLowerCase()
      let matchedNode: cytoscape.NodeSingular | null = null

      cy.nodes().each((node) => {
        const data = node.data()
        const label = (data.label || '').toLowerCase()
        const id = node.id().toLowerCase()
        if (label.includes(q) || id.includes(q)) {
          node.removeClass('dimmed')
          if (!matchedNode) matchedNode = node
        } else {
          node.addClass('dimmed')
        }
      })

      if (matchedNode) {
        cy.animate({
          center: { eles: matchedNode },
          zoom: 1.45,
          duration: 350,
          easing: 'ease-out',
        })
      }
    }

    // Filter pill handling
    const handleFilterChange = (filter: 'all' | 'high' | 'spofs' | 'entry') => {
      setActiveFilter(filter)
      const cy = cyRef.current
      if (!cy) return

      cy.elements().removeClass('dimmed')

      if (filter === 'all') return

      cy.nodes().each((node) => {
        const data = node.data()
        let match = false
        if (filter === 'high' && data.band === 'high') match = true
        if (filter === 'entry' && data.kind === 'entry') match = true
        if (filter === 'spofs' && (data.kind === 'entry' || data.kind === 'group' || (data.impact ?? 0) >= 8)) match = true

        if (match) {
          node.removeClass('dimmed')
        } else {
          node.addClass('dimmed')
        }
      })
    }

    // Container Resize Observer
    useEffect(() => {
      if (!containerRef.current) return
      const observer = new ResizeObserver(() => {
        if (cyRef.current && !cyRef.current.destroyed() && cyRef.current.nodes().length > 0) {
          try {
            cyRef.current.resize()
            cyRef.current.fit(cyRef.current.elements(), 36)
          } catch {
            // Defensive
          }
        }
      })
      observer.observe(containerRef.current)
      return () => observer.disconnect()
    }, [])

    const hasNodes = (view?.nodes?.length ?? 0) > 0

    return (
      <div className={`relative flex flex-col rounded-xl overflow-hidden border border-zinc-800 bg-[#121214] ${className}`}>
        {/* Top Control Bar: clean, flat */}
        <div className="z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#121214] border-b border-zinc-800">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-40 sm:w-48 pl-8 pr-2.5 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            <div className="hidden sm:flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => handleFilterChange('all')}
                className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  activeFilter === 'all' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('high')}
                className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  activeFilter === 'high' ? 'bg-red-500/10 text-red-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                High risk
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('spofs')}
                className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  activeFilter === 'spofs' ? 'bg-amber-500/10 text-amber-400 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                SPOFs
              </button>
              <button
                type="button"
                onClick={() => handleFilterChange('entry')}
                className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  activeFilter === 'entry' ? 'bg-zinc-800 text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Entry vectors
              </button>
            </div>
          </div>

          {/* Layout & Zoom Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => handleLayoutChange('hierarchical')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'hierarchical'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Flow
              </button>
              <button
                type="button"
                onClick={() => handleLayoutChange('organic')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'organic'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Organic
              </button>
              <button
                type="button"
                onClick={() => handleLayoutChange('concentric')}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  layoutMode === 'concentric'
                    ? 'bg-zinc-800 text-zinc-100 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Radial
              </button>
            </div>

            <div className="flex items-center bg-zinc-900 p-0.5 border border-zinc-800 rounded-lg">
              <button
                type="button"
                onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 1.25)}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded cursor-pointer transition-colors"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => cyRef.current?.zoom(cyRef.current.zoom() * 0.8)}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded cursor-pointer transition-colors"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={fitCanvas}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 rounded cursor-pointer transition-colors"
                title="Fit canvas"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowLegend((prev) => !prev)}
                className={`p-1.5 rounded cursor-pointer transition-colors ${
                  showLegend ? 'text-zinc-100 bg-zinc-800' : 'text-zinc-400 hover:text-zinc-100'
                }`}
                title="Toggle legend"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Container */}
        <div className="relative w-full bg-[#0e0e10] overflow-hidden">
          {/* Empty state overlay if no nodes exist */}
          {!hasNodes && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-zinc-500 text-xs space-y-1">
              <p>No graph nodes available</p>
              <p className="text-zinc-600 text-[11px]">Load demo persona or add accounts to view the attack topology.</p>
            </div>
          )}

          {/* Minimal Legend Overlay */}
          {showLegend && hasNodes && (
            <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-3 bg-zinc-900/90 backdrop-blur-sm px-3 py-1.5 border border-zinc-800 rounded-full text-xs text-zinc-400 shadow-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-red-500 bg-red-500/20" /> High risk
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-amber-500 bg-amber-500/20" /> Medium risk
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-emerald-500 bg-emerald-500/20" /> Low risk
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-zinc-500 bg-zinc-700" /> Neutral
              </span>
              {ghost && (
                <span className="inline-flex items-center gap-1 text-amber-400">
                  <Eye className="w-3 h-3" /> Ghost delta
                </span>
              )}
            </div>
          )}

          {/* Minimal Floating Tooltip Card */}
          {hoveredNode && (
            <div
              className="absolute z-20 pointer-events-none -translate-x-1/2 -translate-y-full mb-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl text-left min-w-[200px] max-w-[260px] text-xs text-zinc-300"
              style={{
                left: Math.max(120, Math.min(hoveredNode.x, (containerRef.current?.clientWidth || 900) - 120)),
                top: Math.max(10, hoveredNode.y - 10),
              }}
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-zinc-800">
                <span className="font-medium text-zinc-100">{hoveredNode.label}</span>
                {hoveredNode.band && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                      hoveredNode.band === 'high'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : hoveredNode.band === 'medium'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {hoveredNode.band}
                  </span>
                )}
              </div>

              <div className="space-y-1 text-xs">
                {hoveredNode.p !== undefined && hoveredNode.p !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Takeover likelihood</span>
                    <span className="font-semibold text-zinc-100 font-mono-code tabular-nums">
                      {Math.round(hoveredNode.p * 100)}%
                    </span>
                  </div>
                )}
                {hoveredNode.impact !== undefined && hoveredNode.impact !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400">Impact</span>
                    <span className="font-mono-code text-zinc-100 tabular-nums">{hoveredNode.impact} / 10</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cytoscape Canvas Container */}
          <div
            ref={containerRef}
            style={{ height, minHeight: height }}
            className="w-full cursor-grab active:cursor-grabbing focus:outline-none"
          />
        </div>
      </div>
    )
  }
)
