import React, { createContext, useContext, useState } from 'react'
import type { Analysis } from './types'

interface SelectionContextType {
  selectedAccountId: string | null
  setSelectedAccountId: (id: string | null) => void
  isDetailOpen: boolean
  setIsDetailOpen: (open: boolean) => void
  openAccountDetail: (id: string) => void
  closeAccountDetail: () => void
  ghostView: Analysis['graph'] | null
  setGhostView: (view: Analysis['graph'] | null) => void
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined)

export const SelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [ghostView, setGhostView] = useState<Analysis['graph'] | null>(null)

  const openAccountDetail = (id: string) => {
    setSelectedAccountId(id)
    setIsDetailOpen(true)
  }

  const closeAccountDetail = () => {
    setIsDetailOpen(false)
  }

  return (
    <SelectionContext.Provider
      value={{
        selectedAccountId,
        setSelectedAccountId,
        isDetailOpen,
        setIsDetailOpen,
        openAccountDetail,
        closeAccountDetail,
        ghostView,
        setGhostView,
      }}
    >
      {children}
    </SelectionContext.Provider>
  )
}

export const useSelection = () => {
  const context = useContext(SelectionContext)
  if (!context) {
    throw new Error('useSelection must be used within SelectionProvider')
  }
  return context
}
