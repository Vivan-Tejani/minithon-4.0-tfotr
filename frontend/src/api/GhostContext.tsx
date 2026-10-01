import React, { createContext, useContext, useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import type { GraphView } from './types'

export interface GhostContextType {
  ghost: GraphView | null
  setGhost: (view: GraphView | null) => void
  ghostView: GraphView | null
  setGhostView: (view: GraphView | null) => void
}

const GhostContext = createContext<GhostContextType | undefined>(undefined)

export const GhostProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ghost, setGhost] = useState<GraphView | null>(null)
  const location = useLocation()

  // Clear ghost overlay automatically whenever route changes
  useEffect(() => {
    setGhost(null)
  }, [location.pathname])

  const setGhostView = (view: GraphView | null) => setGhost(view)

  return (
    <GhostContext.Provider
      value={{
        ghost,
        setGhost,
        ghostView: ghost,
        setGhostView,
      }}
    >
      {children}
    </GhostContext.Provider>
  )
}

export const useGhost = (): GhostContextType => {
  const context = useContext(GhostContext)
  if (!context) {
    // Graceful fallback if rendered outside provider
    return {
      ghost: null,
      setGhost: () => {},
      ghostView: null,
      setGhostView: () => {},
    }
  }
  return context
}
