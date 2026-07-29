import React, { createContext, useState, useEffect } from 'react'
import { getAuditCatalog, getDrillDown } from '../api'
import DrillDownModal from '../components/DrillDownModal'

export interface MetricMeta {
  id: string
  name: string
  tab: string
  formula: string
  source: string
  caveats?: string
  confidence?: 'high' | 'medium' | 'low'
  atRisk?: string
  config_keys?: string
}

export interface AuditContextType {
  isAuditMode: boolean
  setAuditMode: (mode: boolean) => void
  catalog: any
  loading: boolean
  getMetricMeta: (id: string) => MetricMeta | undefined
  triggerDrillDown: (title: string, params: any) => Promise<void>
}

// Export the context so useAudit.ts can import it (keeps this file component-only for Vite Fast Refresh)
export const AuditContext = createContext<AuditContextType | undefined>(undefined)

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuditMode, setAuditMode] = useState<boolean>(() => {
    return localStorage.getItem('agy_audit_mode') === 'true'
  })
  const [catalog, setCatalog] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Drill down modal state
  const [drillDownData, setDrillDownData] = useState<any[]>([])
  const [drillDownTitle, setDrillDownTitle] = useState('')
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('agy_audit_mode', String(isAuditMode))
  }, [isAuditMode])

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const data = await getAuditCatalog()
        setCatalog(data)
      } catch (err) {
        console.error('Failed to load audit catalog:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCatalog()
  }, [])

  const getMetricMeta = (id: string): MetricMeta | undefined => {
    if (!catalog?.metrics) return undefined
    return catalog.metrics.find((m: any) => m.id === id)
  }

  const triggerDrillDown = async (title: string, params: any) => {
    try {
      const data = await getDrillDown(params)
      setDrillDownData(data)
      setDrillDownTitle(title)
      setIsDrillDownOpen(true)
    } catch (err) {
      console.error('Drill down fetch failed:', err)
    }
  }

  return (
    <AuditContext.Provider
      value={{
        isAuditMode,
        setAuditMode,
        catalog,
        loading,
        getMetricMeta,
        triggerDrillDown
      }}
    >
      {children}
      <DrillDownModal
        isOpen={isDrillDownOpen}
        onClose={() => setIsDrillDownOpen(false)}
        data={drillDownData}
        title={drillDownTitle}
      />
    </AuditContext.Provider>
  )
}
