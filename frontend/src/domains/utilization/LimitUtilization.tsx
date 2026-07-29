// @ts-nocheck
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getLimitUtilisation, getCommandData, getDrillDown } from '../../api'
import DrillDownModal from '../../components/DrillDownModal'
import { useStore } from '../../store'
import { formatCurrencyCompact, formatPercent } from '../../utils'
import { 
  ChevronRight, FileText, ShieldCheck,
  Database, FlaskConical, X
} from 'lucide-react'

const BOE_COLOR_MAP: Record<string, string> = {
  'BOE Received & Paid': '#16a34a',
  'BOE Received & Unpaid': '#d97706',
  'BOE Not Received': '#dc2626',
  'Cancelled': '#9ca3af',
  'Other': '#6b7280',
}

const getUtilColor = (pct: number) => {
  if (pct >= 90) return '#dc2626'
  if (pct >= 70) return '#d97706'
  return '#16a34a'
}

const FacilityCard: React.FC<{
  title: string
  icon: React.ReactNode
  isActive: boolean
  onClick: () => void
  headroom: number
  limit: number
  used: number
  pct: number
  color: string
  currency: string
  unit: 'Cr' | 'Absolute'
  overdue?: { amount: number; count: number }
  frozen?: number
  formula: string
}> = ({ title, icon, isActive, onClick, headroom, limit, used, pct, color, currency, unit, overdue, frozen, formula }) => {
  const { sourceMode } = useStore()
  const [showProvenance, setShowProvenance] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Dismiss on outside click
  useEffect(() => {
    if (!showProvenance) return
    const dismiss = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowProvenance(false)
    }
    document.addEventListener('mousedown', dismiss)
    return () => document.removeEventListener('mousedown', dismiss)
  }, [showProvenance])

  return (
    <div ref={ref} className="relative flex-1">
      <button
        onClick={onClick}
        onMouseEnter={() => {
          if (hideTimer.current) clearTimeout(hideTimer.current)
          if (sourceMode && formula) setShowProvenance(true)
        }}
        onMouseLeave={() => {
          hideTimer.current = setTimeout(() => setShowProvenance(false), 300)
        }}
        className={`w-full bg-canvas border rounded-lg p-2 transition-all duration-300 text-left relative overflow-hidden group ${
          isActive 
            ? 'border-transparent shadow-sm ring-1 ring-offset-0' 
            : sourceMode && showProvenance
              ? 'border-accent/40 bg-accent/[0.01] shadow-sm'
              : 'border-hairline hover:border-hairline-strong shadow-sm'
        }`}
        style={{ 
          boxShadow: isActive ? `0 4px 12px -2px ${color}20` : undefined,
          borderColor: isActive ? color : sourceMode && showProvenance ? undefined : undefined,
          background: isActive ? `linear-gradient(135deg, var(--color-canvas) 0%, ${color}10 100%)` : 'var(--color-canvas)'
        }}
      >
        {/* Active indicator bar */}
        <div 
          className={`absolute top-0 left-0 w-full h-1 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundColor: color }}
        />

        <div className="flex justify-between items-center h-8">
          {/* Left section: Icon + Title + Progress */}
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded transition-colors ${isActive ? 'bg-canvas-soft' : 'bg-canvas-soft group-hover:bg-canvas-soft'}`} style={{ color: isActive ? color : '#64748b' }}>
              {React.cloneElement(icon as React.ReactElement, { size: 14 })}
            </div>
            <span className="text-[10.5px] font-black text-ink uppercase tracking-wider">{title}</span>
            
            <div className="hidden lg:flex items-center gap-1.5 ml-2 w-16">
              <div className="flex-1 bg-canvas-soft h-1 rounded-full overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
                />
              </div>
              <span className="text-[8px] font-black text-ink-faint whitespace-nowrap" title="Utilization % = (Used / Limit) * 100">{formatPercent(pct)}</span>
            </div>
          </div>
          
          {/* Right section: Limit, Used, Available, Overdue, Frozen */}
          <div className="flex items-center gap-3 md:gap-4" title={formula}>
            <div className="flex flex-col items-end">
              <span className="text-[7px] font-bold text-ink-faint uppercase tracking-tight leading-none mb-0.5">Limit</span>
              <span className="text-[10.5px] font-bold text-ink-mute leading-none">{formatCurrencyCompact(limit, currency, unit)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[7px] font-bold text-ink-faint uppercase tracking-tight leading-none mb-0.5">Used</span>
              <span className="text-[10.5px] font-bold text-ink-mute leading-none">{formatCurrencyCompact(used, currency, unit)}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[7px] font-bold text-ink-faint uppercase tracking-tight leading-none mb-0.5">Available</span>
              <span className="text-[11.5px] font-black text-ink leading-none">{formatCurrencyCompact(headroom, currency, unit)}</span>
            </div>
            
            {((overdue && overdue.amount > 0) || (frozen && frozen > 0)) && (
              <div className="flex gap-3 pl-2 md:pl-3 border-l border-hairline-cool">
                {overdue && overdue.amount > 0 && (
                  <div className="flex flex-col items-end">
                    <span className="text-[6px] font-bold text-red-500 uppercase tracking-tighter leading-none mb-0.5">Overdue</span>
                    <span className="text-[10px] font-black text-red-600 leading-none">{formatCurrencyCompact(overdue.amount, currency, unit)}</span>
                  </div>
                )}
                {frozen && frozen > 0 && (
                  <div className="flex flex-col items-end">
                    <span className="text-[6px] font-bold text-ink-faint uppercase tracking-tighter leading-none mb-0.5">Frozen</span>
                    <span className="text-[10px] font-black text-ink-mute leading-none">{formatCurrencyCompact(frozen, currency, unit)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </button>

      {/* ── Source Mode: Formula overlay on hover ── */}
      {sourceMode && showProvenance && formula && (
        <div
          className="fixed inset-x-2 top-1/2 -translate-y-1/2 z-[100] max-h-[80vh] overflow-y-auto sm:absolute sm:top-full sm:mt-1.5 sm:left-1/2 sm:-translate-x-1/2 sm:w-[340px] sm:right-auto sm:max-h-none sm:overflow-y-visible bg-white border border-[#dfdfdf] rounded-xl shadow-lift text-left"
          onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); setShowProvenance(true) }}
          onMouseLeave={() => { hideTimer.current = setTimeout(() => setShowProvenance(false), 300) }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#dfdfdf] bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                <Database className="w-3.5 h-3.5 text-accent" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-accent">Formula</span>
                <p className="text-[9px] text-slate-400 font-medium">{title}</p>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setShowProvenance(false) }}
              className="sm:hidden flex items-center justify-center w-7 h-7 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3.5 space-y-3">
            <div className="flex gap-2.5">
              <div className="text-slate-400 mt-0.5">
                <FlaskConical className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-slate-400">Computation</p>
                <p className="text-[11px] font-mono text-slate-600 leading-relaxed mt-1">{formula}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const LimitUtilization: React.FC = () => {
  const { currency, fy, amountUnit, setAmountUnit } = useStore()
  const [utilData, setUtilData] = useState<any>(null)
  const [cmdData, setCmdData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid' | 'All'>('Unpaid')
  const [facilityToggle, setFacilityToggle] = useState<'LC' | 'SBLC' | 'CASH'>('LC')
  const [boeToggle, setBoeToggle] = useState<'Open' | 'Closed' | 'All'>('Open')
  const [isBanksCollapsed, setIsBanksCollapsed] = useState(false)
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())
  const [isLcOutstandingExpanded, setIsLcOutstandingExpanded] = useState(true)
  const [isInterchangeableExpanded, setIsInterchangeableExpanded] = useState(true)
  const [drillDownData, setDrillDownData] = useState<any[]>([])
  const [drillDownTitle, setDrillDownTitle] = useState('')
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false)

  // marginFraction is the raw DB value (0.1 = 10%, 1.0 = 100%)
  const handleMarginClick = async (marginFraction: number, bank: string) => {
    try {
      const data = await getDrillDown({
        fy,
        status: 'Open',
        bank: bank !== 'Total' ? bank : undefined,
        margin: marginFraction
      })
      setDrillDownData(data)
      setDrillDownTitle(`${bank === 'Total' ? 'All Banks' : bank} — ${+(marginFraction * 100).toFixed(2)}% Margin · Open LCs`)
      setIsDrillDownOpen(true)
    } catch (err) {
      console.error('Drill down error:', err)
    }
  }

  const handleBoeClick = async (boeStatus: string, paymentStatus: string, bank: string) => {
    try {
      const data = await getDrillDown({
        fy,
        boe_status: boeStatus,
        payment_status: paymentStatus,
        bank: bank !== 'Total' ? bank : undefined,
        status: boeToggle === 'All' ? undefined : boeToggle
      })
      setDrillDownData(data)
      setDrillDownTitle(`${bank === 'Total' ? 'All Banks' : bank} — ${toProperCase(boeStatus)} · ${toProperCase(paymentStatus)} (${boeToggle} LCs)`)
      setIsDrillDownOpen(true)
    } catch (err) {
      console.error('Drill down error:', err)
    }
  }

  const toggleBank = () => {
    setIsBanksCollapsed(!isBanksCollapsed)
  }

  const toggleType = (type: string) => {
    const next = new Set(expandedTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    setExpandedTypes(next)
  }

  const [expandedBoeStatus, setExpandedBoeStatus] = useState<Set<string>>(new Set(['UNPAID', 'Unpaid', 'unpaid']))

  const toggleBoeStatus = (key: string) => {
    const next = new Set(expandedBoeStatus)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setExpandedBoeStatus(next)
  }

  // Stable ref to hold latest fetchData for event listener
  const fetchDataRef = useRef<() => void>()
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = useCallback(async (signal: AbortSignal) => {
    try {
      setLoading(true)
      setFetchError(null)
      setUtilData(null)
      setCmdData(null)

      // Phase 1 — load critical KPIs first for fast initial render
      const cmd = await getCommandData(currency, fy, paymentStatus, facilityToggle, boeToggle)
      if (signal.aborted) return
      setCmdData(cmd)
      setLoading(false)

      // Phase 2 — load detailed analytics in background, stream in when ready
      try {
        const util = await getLimitUtilisation(currency, fy, paymentStatus, facilityToggle, boeToggle)
        if (signal.aborted) return
        setUtilData(util)
      } catch (e: any) {
        console.error('Phase 2 fetch error (non-critical):', e)
      }
    } catch (e: any) {
      const msg = e?.message || 'Request failed'
      console.error('Data fetch error:', e)
      if (signal.aborted) return
      setFetchError(msg)
      setLoading(false)
    }
  }, [currency, fy, paymentStatus, facilityToggle, boeToggle])

  // Main data loading effect — re-runs when filters change
  useEffect(() => {
    const abortController = new AbortController()
    loadData(abortController.signal)
    return () => abortController.abort()
  }, [loadData, refreshKey])

  // Stable event listener for global Refresh button
  useEffect(() => {
    fetchDataRef.current = () => setRefreshKey(k => k + 1)
    const handler = () => fetchDataRef.current?.()
    window.addEventListener('app-refresh', handler)
    return () => window.removeEventListener('app-refresh', handler)
  }, [])

  // ── Phase-1 skeleton (cmdData not yet arrived) ──────────────────────────
  if (loading && !cmdData) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-canvas-soft rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-20 bg-canvas-soft rounded-lg" />)}
        </div>
        <div className="h-32 bg-canvas-soft rounded-xl" />
        <div className="h-64 bg-canvas-soft rounded-xl" />
      </div>
    )
  }

  if (!cmdData) {
    return (
      <div className="p-12 text-center">
        <div className="text-ink-mute text-sm mb-2">No data available. Verify the backend connection.</div>
        {fetchError && (
          <div className="text-red-500 text-xs font-mono bg-red-50 dark:bg-red-900/20 inline-block px-3 py-1.5 rounded border border-red-200 dark:border-red-800">
            {fetchError}
          </div>
        )}
      </div>
    )
  }

  const { bank_utilization: banksRaw = [], portfolio_summary: summary = {} } = utilData || {}
  const {
    summary: cmdSummary = {},
    product_unpaid_pivot = [],
    boe_status_bank_pivot = [],
    banks_list: cmdBanksList = []
  } = cmdData

  // Sort banks: SBI, BOI, IDBI first
  const bankOrderMap: Record<string, number> = { 'SBI': 1, 'BOI': 2, 'IDBI': 3 }
  const banks = [...banksRaw].sort((a, b) => {
    const valA = bankOrderMap[a.bank?.toUpperCase()] || 99
    const valB = bankOrderMap[b.bank?.toUpperCase()] || 99
    if (valA !== valB) return valA - valB
    return (a.bank || '').localeCompare(b.bank || '')
  })

  const reorderBanksList = (list: string[]) => {
    return [...list].sort((a, b) => {
      const valA = bankOrderMap[a.toUpperCase()] || 99
      const valB = bankOrderMap[b.toUpperCase()] || 99
      if (valA !== valB) return valA - valB
      return a.localeCompare(b)
    })
  }

  const sortedCmdBanksList = reorderBanksList(cmdBanksList)
  const sortedBanksList = reorderBanksList(cmdBanksList)

  // Dynamic columns matching the selected currency
  const isInr = currency === 'INR'
  const colAmt = isInr ? 'LC."LC Amt (in INR)"' : 'LC."Final LC Amt (in FC)"'
  const colBoe = isInr ? 'LC."BOE Bill Amt (in INR)"' : 'LC."BOE Bill Amt (in FC)"'
  const colInProcess = isInr ? '"LC BG in Process"."AMT IN INR"' : '"LC BG in Process"."Amt in FC"'
  const colSblc = isInr ? 'SBLC."Final PAYMENT AMT INR"' : 'SBLC."SBLC Bill Amt (in FC)"'
  const colCash = isInr ? 'LC."LC Amt (in INR)"' : 'LC."Final LC Amt (in FC)"'

  const isSblcActive = facilityToggle === 'SBLC'
  const isCashActive = facilityToggle === 'CASH'
  const amountColorClass = isSblcActive ? 'text-[#16a34a]' : (isCashActive ? 'text-ink-mute' : 'text-[#1d4ed8]')

  // Dynamic tooltips for the consolidated values
  const tooltipTotalLimit = 'Limit = Sum of (bank_limit.LC + bank_limit.Cash) across all banks'
  const tooltipTotalUsed = `Used = Sum of (LC Outstanding + LC in Process + SBLC Used + Cash Used) across all banks`
  const tooltipTotalBalance = 'Balance = Total Limit - Total Used'

  const tooltipLcLimit = 'Limit = Sum of (bank_limit.LC - SBLC Limit) [SBLC Limit is dynamically bound to SBLC Used for BOI & IDBI]'
  const tooltipLcUsed = 'Used = Sum of (LC Outstanding + LC in Process) across all banks'
  const tooltipLcBalance = 'Balance = LC Limit - LC Used'

  const tooltipLcOutstanding = `Used = Sum of (${colAmt} where LC.LC Status = 'Open' and LC.Margin = 0.1) [BOI & IDBI use ${colBoe}]`
  const tooltipLcInProcess = `Used = Sum of (${colInProcess} where Status = 'DOC SUBMITTED TO BANK') [BOI & IDBI are fixed at 0]`

  const tooltipInterchangeableLimit = 'Limit = SBLC Limit + Cash Limit (bank_limit.Cash) [SBLC Limit is dynamically SBLC Used for BOI & IDBI]'
  const tooltipInterchangeableUsed = 'Used = SBLC Used + Cash Used'
  const tooltipInterchangeableBalance = 'Balance = Interchangeable Limit - Interchangeable Used'

  const tooltipSblcLimit = 'Limit = bank_limit.SBLC [SBLC Used for dynamic banks (BOI/IDBI)]'
  const tooltipSblcUsed = `Used = Sum of (${colSblc} where Payment Status != 'Paid')`
  const tooltipSblcBalance = 'Balance = SBLC Limit - SBLC Used'

  const tooltipCashLimit = 'Limit = bank_limit.Cash'
  const tooltipCashUsed = `Used = Sum of cash-specific exposures derived from ${colCash} where Product Name or Type contains 'CASH'`
  const tooltipCashBalance = 'Balance = Cash Limit - Cash Used'

  const totalLcLimit = banks.reduce((acc: any, b: any) => {
    const isDynamicSblc = b.bank?.toUpperCase() === 'BOI' || b.bank?.toUpperCase() === 'IDBI'
    const effectiveSblcLimit = isDynamicSblc ? (b.sblc_utilization || 0) : (b.sblc_limit || 0)
    return acc + (b.interchangeability_limit - effectiveSblcLimit)
  }, 0)
  const totalLcUsed = banks.reduce((acc: any, b: any) => acc + (b.lc_open || 0) + (b.lc_in_process || 0), 0)
  const lcPct = totalLcLimit > 0 ? (totalLcUsed / totalLcLimit) * 100 : 0

  const totalSblcLimitOnly = banks.reduce((acc: any, b: any) => {
    const isDynamicSblc = b.bank?.toUpperCase() === 'BOI' || b.bank?.toUpperCase() === 'IDBI'
    return acc + (isDynamicSblc ? (b.sblc_utilization || 0) : (b.sblc_limit || 0))
  }, 0)
  const totalSblcUsedOnly = banks.reduce((acc: any, b: any) => acc + (b.sblc_utilization || 0), 0)
  const sblcOnlyPct = totalSblcLimitOnly > 0 ? (totalSblcUsedOnly / totalSblcLimitOnly) * 100 : 0

  const totalCashLimit = banks.reduce((acc: any, b: any) => acc + (b.cash_limit || 0), 0)
  const totalCashUsed = banks.reduce((acc: any, b: any) => acc + (b.cash_utilization || 0), 0)

  const totalSblcLimit = totalSblcLimitOnly
  const totalSblcUsed = totalSblcUsedOnly
  const sblcPct = sblcOnlyPct

  // Hoisted function declaration: referenced earlier in the component (e.g. the
  // data-derivation forEach and drill-down handler) before this point, so it must
  // not be a `const` (which would be in the temporal dead zone at those call sites).
  function toProperCase(str: string | null | undefined) {
    if (!str || typeof str !== 'string') return ''
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }

  const groupedProducts: Record<string, any[]> = {}
  product_unpaid_pivot.forEach((row: any) => {
    const t = toProperCase(row.type || 'Unknown')
    if (!groupedProducts[t]) groupedProducts[t] = []
    groupedProducts[t].push(row)
  })

  const overallPct = summary.overall_utilization_pct || 0
  
  const getStatusColor = (pct: number) => {
    if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Critical' }
    if (pct >= 75) return { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'High' }
    if (pct >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100', label: 'Moderate' }
    return { bar: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-100', label: 'Safe' }
  }

  return (
    <div className="p-3 md:p-4 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-2.5">
        
        {/* ── Page Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-ink tracking-tight leading-tight">Limit Utilization Monitor</h1>
            <p className="text-[11px] text-ink-mute mt-0.5">
              Consolidated bank-wise LC & Interchangeable facility usage
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAmountUnit(amountUnit === 'Absolute' ? 'Cr' : 'Absolute')}
              className={`px-2.5 py-1 text-[9px] font-bold rounded-md border transition-all ${
                amountUnit === 'Absolute'
                  ? 'bg-blue-600 border-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-canvas text-ink-mute border-hairline hover:border-blue-600 hover:text-[#1d4ed8]'
              }`}
            >
              {amountUnit === 'Absolute' ? 'Absolute Active' : 'Absolute View'}
            </button>
          </div>
        </div>
        {/* ── [TOP ELEMENT] Bank Quick Cards (Horizontal Scroll) ── */}
        <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2 custom-scrollbar-horizontal items-start">
          {/* ── Portfolio Total Card ── */}
          {(() => {
            const totalLimit = banks.reduce((acc: number, b: any) => acc + (b.interchangeability_limit + (b.cash_limit || 0)), 0)
            const totalUsed = banks.reduce((acc: number, b: any) => acc + ((b.lc_open || 0) + (b.lc_in_process || 0) + (b.sblc_utilization || 0) + (b.cash_utilization || 0)), 0)
            const totalBalance = totalLimit - totalUsed
            const totalLcUsed = banks.reduce((acc: number, b: any) => acc + (b.lc_open || 0) + (b.lc_in_process || 0), 0)
            const totalLcOutstanding = banks.reduce((acc: number, b: any) => acc + (b.lc_open || 0), 0)
            const totalLcInProcess = banks.reduce((acc: number, b: any) => acc + (b.lc_in_process || 0), 0)
            const totalSblcUsed = banks.reduce((acc: number, b: any) => acc + (b.sblc_utilization || 0), 0)
            const totalCashUsed = banks.reduce((acc: number, b: any) => acc + (b.cash_utilization || 0), 0)
            const totalLcLimit = banks.reduce((acc: number, b: any) => {
              const isDynamicSblc = b.bank?.toUpperCase() === 'BOI' || b.bank?.toUpperCase() === 'IDBI'
              const effectiveSblcLimit = isDynamicSblc ? (b.sblc_utilization || 0) : (b.sblc_limit || 0)
              return acc + (b.interchangeability_limit - effectiveSblcLimit)
            }, 0)
            const totalInterchangeableLimit = banks.reduce((acc: number, b: any) => {
              const isDynamicSblc = b.bank?.toUpperCase() === 'BOI' || b.bank?.toUpperCase() === 'IDBI'
              const effectiveSblcLimit = isDynamicSblc ? (b.sblc_utilization || 0) : (b.sblc_limit || 0)
              return acc + (b.cash_limit || 0) + effectiveSblcLimit
            }, 0)
            const totalSblcLimit = banks.reduce((acc: number, b: any) => {
              const isDynamicSblc = b.bank?.toUpperCase() === 'BOI' || b.bank?.toUpperCase() === 'IDBI'
              return acc + (isDynamicSblc ? (b.sblc_utilization || 0) : (b.sblc_limit || 0))
            }, 0)
            const totalCashLimit = banks.reduce((acc: number, b: any) => acc + (b.cash_limit || 0), 0)

            const status = getStatusColor(overallPct)

            return (
              <div className={`bg-canvas border border-hairline rounded-[10px] shadow-sm hover:shadow-md transition-all flex flex-col min-w-[320px] w-fit flex-shrink-0 ${isBanksCollapsed ? 'p-2.5' : 'p-3'}`}>
                <div className={`flex justify-between items-center cursor-pointer select-none ${isBanksCollapsed ? 'mb-0' : 'mb-1'}`} onClick={toggleBank}>
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.bar}`} />
                    <h3 className="font-bold text-[13.5px] text-ink tracking-tight">Consolidated</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100" title={`LC Utilization % = (LC Used / LC Limit) * 100. Used: ${formatCurrencyCompact(totalLcUsed, currency, amountUnit)} / Limit: ${formatCurrencyCompact(totalLcLimit, currency, amountUnit)}`}>
                      {formatPercent(lcPct)}
                    </span>
                    <span className="text-[10px] text-ink-faint font-bold">/</span>
                    <span className="text-[12px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100" title={`SBLC Utilization % = (SBLC Used / SBLC Limit) * 100. Used: ${formatCurrencyCompact(totalSblcUsed, currency, amountUnit)} / Limit: ${formatCurrencyCompact(totalSblcLimit, currency, amountUnit)}`}>
                      {formatPercent(sblcPct)}
                    </span>
                    <ChevronRight className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-200 ${isBanksCollapsed ? '' : 'rotate-90'}`} />
                  </div>
                </div>

                {isBanksCollapsed ? (
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9.5px] font-bold text-ink-mute">Total Available Balance</span>
                    <span className="text-[12px] font-black text-[#15803d]">
                      {formatCurrencyCompact(totalBalance, currency, amountUnit)}
                    </span>
                  </div>
                ) : (
                  <div className="bg-parchment rounded-lg border border-hairline p-1.5 mb-0.5">
                    <table className="w-full text-[9.5px]">
                      <thead>
                        <tr className="text-ink-mute border-b border-hairline">
                          <th className="pb-0.5 text-left font-bold tracking-wider">Facility</th>
                          <th className="pb-0.5 text-right font-bold tracking-wider px-1">Limit</th>
                          <th className="pb-0.5 text-right font-bold tracking-wider px-1">Used</th>
                          <th className="pb-0.5 text-right font-black tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded-t">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-hairline">
                        <tr title="Total = LC Limit Pot + Cash Limit">
                          <td className="py-1 font-black text-ink">Total</td>
                          <td className="py-1 text-right font-bold text-ink-mute px-1" title={tooltipTotalLimit}>{formatCurrencyCompact(totalLimit, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-bold text-ink-mute px-1" title={tooltipTotalUsed}>{formatCurrencyCompact(totalUsed, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-black text-emerald-700 dark:text-emerald-400 text-[12.5px] bg-emerald-500/10 px-1" title={tooltipTotalBalance}>
                            {formatCurrencyCompact(totalBalance, currency, amountUnit)}
                          </td>
                        </tr>
                        <tr title="LC = LC Limit Pot - SBLC Limit">
                          <td 
                            className="py-0.5 pl-1 font-bold text-ink-mute cursor-pointer hover:text-[#1d4ed8] flex items-center gap-0.5"
                            onClick={(e) => { e.stopPropagation(); setIsLcOutstandingExpanded(!isLcOutstandingExpanded); }}
                          >
                            LC {isLcOutstandingExpanded ? '−' : '+'}
                          </td>
                          <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipLcLimit}>{formatCurrencyCompact(totalLcLimit, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-bold text-[#94a3b8] px-1" title={tooltipLcUsed}>{formatCurrencyCompact(totalLcUsed, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-emerald-500/10 px-1" title={tooltipLcBalance}>
                            {formatCurrencyCompact(totalLcLimit - totalLcUsed, currency, amountUnit)}
                          </td>
                        </tr>
                        {isLcOutstandingExpanded && (
                          <>
                            <tr title="LC Outstanding: Open Letter of Credit Exposure">
                              <td className="py-0.5 pl-4 font-medium text-ink-mute">LC Outstanding</td>
                              <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title="Limit = Not Applicable for individual sub-facilities">—</td>
                              <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipLcOutstanding}>{formatCurrencyCompact(totalLcOutstanding, currency, amountUnit)}</td>
                              <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-emerald-500/10 px-1" title="Balance = Not Applicable for individual sub-facilities">—</td>
                            </tr>
                            <tr title="LC in Process: Documents submitted to bank but not yet drawn">
                              <td className="py-0.5 pl-4 font-medium text-ink-mute">LC in Process</td>
                              <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title="Limit = Not Applicable for individual sub-facilities">—</td>
                              <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipLcInProcess}>{formatCurrencyCompact(totalLcInProcess, currency, amountUnit)}</td>
                              <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-emerald-500/10 px-1" title="Balance = Not Applicable for individual sub-facilities">—</td>
                            </tr>
                          </>
                        )}
                        <tr title="Interchangeable = SBLC Limit + Cash Limit">
                          <td 
                            className="py-1 pl-1 font-bold text-ink-mute cursor-pointer hover:text-[#1d4ed8] flex items-center gap-0.5"
                            onClick={(e) => { e.stopPropagation(); setIsInterchangeableExpanded(!isInterchangeableExpanded); }}
                          >
                            Interchangeable {isInterchangeableExpanded ? '−' : '+'}
                          </td>
                          <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipInterchangeableLimit}>{formatCurrencyCompact(totalInterchangeableLimit, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipInterchangeableUsed}>{formatCurrencyCompact(totalSblcUsed + totalCashUsed, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-bold text-emerald-700 dark:text-emerald-400 text-[10.5px] bg-emerald-500/10 px-1 rounded-b" title={tooltipInterchangeableBalance}>
                            {formatCurrencyCompact(totalInterchangeableLimit - (totalSblcUsed + totalCashUsed), currency, amountUnit)}
                          </td>
                        </tr>
                        {isInterchangeableExpanded && (
                          <>
                            <tr className="bg-canvas-soft/50" title="SBLC: Standby Letter of Credit">
                              <td className="py-0.5 pl-4 font-medium text-ink-mute">SBLC</td>
                              <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={tooltipSblcLimit}>{formatCurrencyCompact(totalSblcLimit, currency, amountUnit)}</td>
                              <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={tooltipSblcUsed}>{formatCurrencyCompact(totalSblcUsed, currency, amountUnit)}</td>
                              <td className="py-0.5 text-right px-1 font-medium text-[#16a34a]" title={tooltipSblcBalance}>
                                {formatCurrencyCompact(Math.max(0, totalSblcLimit - totalSblcUsed), currency, amountUnit)}
                              </td>
                            </tr>
                            <tr className="bg-canvas-soft/50" title="Cash: Cash Credit or other fungible components">
                              <td className="py-0.5 pl-4 font-medium text-ink-mute">Cash</td>
                              <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={tooltipCashLimit}>{formatCurrencyCompact(totalCashLimit, currency, amountUnit)}</td>
                              <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={tooltipCashUsed}>{formatCurrencyCompact(totalCashUsed, currency, amountUnit)}</td>
                              <td className="py-0.5 text-right px-1 font-medium text-ink-mute" title={tooltipCashBalance}>
                                {formatCurrencyCompact(Math.max(0, totalCashLimit - totalCashUsed), currency, amountUnit)}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="w-full flex gap-2 mt-1.5 h-1">
                  <div className="w-1/2 bg-canvas-soft h-full rounded-full overflow-hidden" title={`LC Utilization: ${formatPercent(lcPct)}`}>
                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(lcPct, 100)}%` }} />
                  </div>
                  <div className="w-1/2 bg-canvas-soft h-full rounded-full overflow-hidden" title={`SBLC Utilization: ${formatPercent(sblcPct)}`}>
                    <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${Math.min(sblcPct, 100)}%` }} />
                  </div>
                </div>
              </div>
            )
          })()}


          {banks.map((bank: any, idx: number) => {
            const status = getStatusColor(bank.utilization_pct)
            const isDynamicSblc = bank.bank?.toUpperCase() === 'BOI' || bank.bank?.toUpperCase() === 'IDBI'
            const effectiveSblcLimit = isDynamicSblc ? (bank.sblc_utilization || 0) : (bank.sblc_limit || 0)
            const lcLimit = bank.interchangeability_limit - effectiveSblcLimit
            const lcUsed = (bank.lc_open || 0) + (bank.lc_in_process || 0)
            const bankLcPct = lcLimit > 0 ? (lcUsed / lcLimit) * 100 : 0

            const sblcLimit = effectiveSblcLimit
            const sblcUsed = bank.sblc_utilization || 0
            const bankSblcPct = sblcLimit > 0 ? (sblcUsed / sblcLimit) * 100 : 0

            const totalLimit = bank.interchangeability_limit + (bank.cash_limit || 0)
            const totalUsed = (bank.lc_open || 0) + (bank.lc_in_process || 0) + (bank.sblc_utilization || 0) + (bank.cash_utilization || 0)
            const totalBalance = totalLimit - totalUsed

            return (
              <div key={idx} className={`bg-canvas border border-hairline rounded-[10px] shadow-sm hover:shadow-md transition-all flex flex-col min-w-[320px] w-fit flex-shrink-0 ${isBanksCollapsed ? 'p-2.5' : 'p-3'}`}>
                <div className={`flex justify-between items-center cursor-pointer select-none ${isBanksCollapsed ? 'mb-0' : 'mb-1'}`} onClick={toggleBank}>
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.bar}`} />
                    <h3 className="font-bold text-[13.5px] text-ink">{bank.bank}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100" title={`LC Utilization % = (LC Used / LC Limit) * 100. Used: ${formatCurrencyCompact(lcUsed, currency, amountUnit)} / Limit: ${formatCurrencyCompact(lcLimit, currency, amountUnit)}`}>
                      {formatPercent(bankLcPct)}
                    </span>
                    <span className="text-[10px] text-ink-faint font-bold">/</span>
                    <span className="text-[12px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100" title={`SBLC Utilization % = (SBLC Used / SBLC Limit) * 100. Used: ${formatCurrencyCompact(sblcUsed, currency, amountUnit)} / Limit: ${formatCurrencyCompact(sblcLimit, currency, amountUnit)}`}>
                      {formatPercent(bankSblcPct)}
                    </span>
                    <ChevronRight className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-200 ${isBanksCollapsed ? '' : 'rotate-90'}`} />
                  </div>
                </div>

                {isBanksCollapsed ? (
                  /* Compact collapsed card: bank (header) + utilization% (header) + balance */
                  <div className="flex items-center justify-between mt-0.5" title={`Balance = (bank_limit.LC + bank_limit.Cash) - (LC Outstanding + LC in Process + SBLC Used + Cash Used) for ${bank.bank}`}>
                    <span className="text-[9.5px] font-bold text-ink-mute">Balance Available</span>
                    <span className="text-[12px] font-black text-[#15803d]">
                      {formatCurrencyCompact(totalBalance, currency, amountUnit)}
                    </span>
                  </div>
                ) : (
                  /* Expanded card: full 3x3 facility grid (Total, LC, SBLC) */
                  <div className="bg-parchment rounded-lg border border-hairline p-1.5 mb-0.5">
                      {(() => {
                        return (
                          <table className="w-full text-[9.5px]">
                            <thead>
                              <tr className="text-ink-mute border-b border-hairline">
                                <th className="pb-0.5 text-left font-bold tracking-wider">Facility</th>
                                <th className="pb-0.5 text-right font-bold tracking-wider px-1">Limit</th>
                                <th className="pb-0.5 text-right font-bold tracking-wider px-1">Used</th>
                                <th className="pb-0.5 text-right font-black tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded-t">Balance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-hairline">
                              <tr title="Total = LC Limit Pot + Cash Limit">
                                <td className="py-1 font-black text-ink">Total</td>
                                <td className="py-1 text-right font-bold text-ink-mute px-1" title={`Limit = bank_limit.LC + bank_limit.Cash for ${bank.bank}`}>{formatCurrencyCompact(totalLimit, currency, amountUnit)}</td>
                                <td className="py-1 text-right font-bold text-ink-mute px-1" title={`Used = LC Outstanding + LC in Process + SBLC Used + Cash Used for ${bank.bank}`}>{formatCurrencyCompact(totalUsed, currency, amountUnit)}</td>
                                <td className="py-1 text-right font-black text-emerald-700 dark:text-emerald-400 text-[12.5px] bg-emerald-500/10 px-1" title="Balance = Total Limit - Total Used">
                                  {formatCurrencyCompact(totalBalance, currency, amountUnit)}
                                </td>
                              </tr>
                              <tr title="LC = LC Limit Pot - SBLC Limit">
                                <td 
                                  className="py-0.5 pl-1 font-bold text-ink-mute cursor-pointer hover:text-[#1d4ed8] flex items-center gap-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsLcOutstandingExpanded(!isLcOutstandingExpanded);
                                  }}
                                >
                                  LC
                                  <span className="text-[9px] font-black">{isLcOutstandingExpanded ? '−' : '+'}</span>
                                </td>
                                <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={`Limit = bank_limit.LC - SBLC Limit for ${bank.bank} ${isDynamicSblc ? '[Note: SBLC Limit is dynamically bound to SBLC Used]' : ''}`}>{formatCurrencyCompact(lcLimit, currency, amountUnit)}</td>
                                <td className="py-1 text-right font-bold text-[#94a3b8] px-1" title={`Used = LC Outstanding + LC in Process for ${bank.bank}`}>{formatCurrencyCompact((bank.lc_open || 0) + (bank.lc_in_process || 0), currency, amountUnit)}</td>
                                <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-emerald-500/10 px-1" title="Balance = LC Limit - LC Used">
                                  {formatCurrencyCompact(lcLimit - ((bank.lc_open || 0) + (bank.lc_in_process || 0)), currency, amountUnit)}
                                </td>
                              </tr>
                              {isLcOutstandingExpanded && (
                                <>
                                  <tr title="LC Outstanding: Open Letter of Credit Exposure">
                                    <td className="py-0.5 pl-4 font-medium text-ink-mute">LC Outstanding</td>
                                    <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title="Limit = Not Applicable for individual sub-facilities">—</td>
                                    <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={isDynamicSblc ? `Used = Sum of (${colBoe} where LC.Bank Name = '${bank.bank}', LC.LC Status = 'Open', LC.Margin = 0.1)` : `Used = Sum of (${colAmt} where LC.Bank Name = '${bank.bank}', LC.LC Status = 'Open', LC.Margin = 0.1)`}>{formatCurrencyCompact(bank.lc_open || 0, currency, amountUnit)}</td>
                                    <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-emerald-500/10 px-1" title="Balance = Not Applicable for individual sub-facilities">—</td>
                                  </tr>
                                  <tr title="LC in Process: Documents submitted to bank but not yet drawn">
                                    <td className="py-0.5 pl-4 font-medium text-ink-mute">LC in Process</td>
                                    <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title="Limit = Not Applicable for individual sub-facilities">—</td>
                                    <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={isDynamicSblc ? "Used = Fixed at 0 for BOI & IDBI" : `Used = Sum of (${colInProcess} where LC BG in Process.Bank Name = '${bank.bank}' and LC BG in Process.Status = 'DOC SUBMITTED TO BANK')`}>{formatCurrencyCompact(bank.lc_in_process || 0, currency, amountUnit)}</td>
                                    <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-emerald-500/10 px-1" title="Balance = Not Applicable for individual sub-facilities">—</td>
                                  </tr>
                                </>
                              )}
                              <tr title="Interchangeable = SBLC Limit + Cash Limit">
                                <td 
                                  className="py-1 pl-1 font-bold text-ink-mute cursor-pointer hover:text-[#1d4ed8] flex items-center gap-0.5"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsInterchangeableExpanded(!isInterchangeableExpanded);
                                  }}
                                >
                                  Interchangeable
                                  <span className="text-[9px] font-black">{isInterchangeableExpanded ? '−' : '+'}</span>
                                </td>
                                <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={`Limit = SBLC Limit + Cash Limit (bank_limit.Cash) for ${bank.bank} ${isDynamicSblc ? '[Note: SBLC Limit is dynamically bound to SBLC Used]' : ''}`}>{formatCurrencyCompact((bank.cash_limit || 0) + effectiveSblcLimit, currency, amountUnit)}</td>
                                <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={`Used = SBLC Used + Cash Used for ${bank.bank}`}>{formatCurrencyCompact((bank.sblc_utilization || 0) + (bank.cash_utilization || 0), currency, amountUnit)}</td>
                                <td className="py-1 text-right font-bold text-emerald-700 dark:text-emerald-400 text-[10.5px] bg-emerald-500/10 px-1 rounded-b" title="Balance = Interchangeable Limit - Interchangeable Used">
                                  {formatCurrencyCompact(((bank.cash_limit || 0) + effectiveSblcLimit) - ((bank.sblc_utilization || 0) + (bank.cash_utilization || 0)), currency, amountUnit)}
                                </td>
                              </tr>
                              {isInterchangeableExpanded && (
                                <>
                                  <tr className="bg-canvas-soft/50" title="SBLC: Standby Letter of Credit">
                                    <td className="py-0.5 pl-4 font-medium text-ink-mute">SBLC</td>
                                    <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={isDynamicSblc ? "Limit = SBLC Used (dynamically bound for BOI/IDBI)" : `Limit = bank_limit.SBLC for ${bank.bank}`}>
                                      {effectiveSblcLimit ? formatCurrencyCompact(effectiveSblcLimit, currency, amountUnit) : '—'}
                                    </td>
                                    <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={`Used = Sum of (${colSblc} where SBLC.BANK = '${bank.bank}' and (SBLC.Payment Status != 'Paid' OR SBLC.Payment Status IS NULL))`}>{formatCurrencyCompact(bank.sblc_utilization || 0, currency, amountUnit)}</td>
                                    <td className="py-0.5 text-right px-1 font-medium text-[#16a34a]" title="Balance = SBLC Limit - SBLC Used">
                                      {formatCurrencyCompact(Math.max(0, (effectiveSblcLimit || 0) - (bank.sblc_utilization || 0)), currency, amountUnit)}
                                    </td>
                                  </tr>
                                  <tr className="bg-canvas-soft/50" title="Cash: Cash Credit or other fungible components">
                                    <td className="py-0.5 pl-4 font-medium text-ink-mute">Cash</td>
                                    <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={`Limit = bank_limit.Cash for ${bank.bank}`}>
                                      {bank.cash_limit ? formatCurrencyCompact(bank.cash_limit, currency, amountUnit) : '—'}
                                    </td>
                                    <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={`Used = Sum of cash-specific exposures derived from ${colCash} where LC.Bank Name = '${bank.bank}' and (Product Name or Type contains 'CASH')`}>{formatCurrencyCompact(bank.cash_utilization || 0, currency, amountUnit)}</td>
                                    <td className="py-0.5 text-right px-1 font-medium text-ink-mute" title="Balance = Cash Limit - Cash Used">
                                      {formatCurrencyCompact(Math.max(0, (bank.cash_limit || 0) - (bank.cash_utilization || 0)), currency, amountUnit)}
                                    </td>
                                  </tr>
                                </>
                              )}
                            </tbody>
                          </table>
                        )
                      })()}
                  </div>
                )}

                <div className="w-full flex gap-2 mt-1.5 h-1">
                  <div className="w-1/2 bg-canvas-soft h-full rounded-full overflow-hidden" title={`LC Utilization: ${formatPercent(bankLcPct)}`}>
                    <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${Math.min(bankLcPct, 100)}%` }} />
                  </div>
                  <div className="w-1/2 bg-canvas-soft h-full rounded-full overflow-hidden" title={`SBLC Utilization: ${formatPercent(bankSblcPct)}`}>
                    <div className="h-full bg-green-500 transition-all duration-1000" style={{ width: `${Math.min(bankSblcPct, 100)}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Phase-2 shimmer (utilData still loading) ── */}
        {!utilData && (
          <div className="animate-pulse flex items-center gap-3 px-4 py-2 rounded-lg bg-canvas border border-hairline">
            <div className="h-2 w-2 rounded-full bg-amber-400" />
            <div className="h-3 w-48 bg-canvas-soft rounded" />
            <div className="flex gap-2 ml-auto">
              <div className="h-8 w-24 bg-canvas-soft rounded" />
              <div className="h-8 w-24 bg-canvas-soft rounded" />
            </div>
          </div>
        )}

        {/* ── [ACTION CENTER ELEMENT] Facility Cards ── */}
        <div className="flex flex-col md:flex-row gap-4">
          <FacilityCard
            title="Letter of Credit"
            icon={<FileText className="w-5 h-5" />}
            isActive={facilityToggle === 'LC'}
            onClick={() => setFacilityToggle('LC')}
            headroom={Math.max(0, totalLcLimit - totalLcUsed)}
            limit={totalLcLimit}
            used={totalLcUsed}
            pct={lcPct}
            color="#1d4ed8"
            currency={currency}
            unit={amountUnit}
            overdue={{ amount: cmdSummary.overdue_amount, count: cmdSummary.overdue_count }}
            frozen={cmdSummary.working_capital_frozen}
            formula={`Available = (bank_limit.LC - SBLC Limit) - (SUM(${colAmt} where LC.LC Status = 'Open' and LC.Margin = 0.1) + SUM(${colInProcess} where Status = 'DOC SUBMITTED TO BANK')) [Note: BOI & IDBI use ${colBoe} for Open LCs]`}
          />

          <FacilityCard
            title="SBLC Facility"
            icon={<ShieldCheck className="w-5 h-5" />}
            isActive={facilityToggle === 'SBLC'}
            onClick={() => setFacilityToggle('SBLC')}
            headroom={Math.max(0, totalSblcLimit - totalSblcUsed)}
            limit={totalSblcLimit}
            used={totalSblcUsed}
            pct={sblcPct}
            color="#16a34a"
            currency={currency}
            unit={amountUnit}
            formula={`Available = (SBLC Limit + bank_limit.Cash) - (SUM(${colSblc} where SBLC.Payment Status != 'Paid') + Cash Used)`}
          />
        </div>

        {/* ── Main Data Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 !mt-1">

          
          {/* BOE Pipeline Table (Bifurcated by Bank) */}
          <div className="bg-canvas border border-hairline rounded-[10px] shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 border-b flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-ink">BOE Pipeline Compliance</h3>
                <p className="text-[10px] text-ink-mute">Operational tracking of Bill of Entry submission</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-ink-mute">NFB Status:</span>
                <div className="flex items-center gap-0.5 bg-canvas border border-hairline rounded-lg p-0.5 shadow-sm">
                  {(['Open', 'Closed', 'All'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setBoeToggle(s)}
                      className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md transition-all ${
                        boeToggle === s
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'text-ink-mute hover:text-[#1d4ed8]'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-canvas">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-ink-mute bg-canvas z-10">Payment</th>
                    <th className="px-3 py-2 text-left font-bold text-ink-mute border-r border-hairline bg-canvas z-10">BOE Status</th>
                    <th className="px-3 py-2 text-right font-bold text-ink bg-canvas">Total</th>
                    {sortedCmdBanksList.map((bank: string) => (
                      <th key={bank} className="px-3 py-2 text-right font-bold text-ink-mute min-w-[80px] bg-canvas z-10">{bank}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {Object.entries(
                    (boe_status_bank_pivot || []).reduce((acc: any, row: any) => {
                      const rowTotal = sortedCmdBanksList.reduce((sum: number, b: string) => sum + (row[b] || 0), 0);
                      if (rowTotal > 0) {
                        const ps = row.payment_status;
                        if (!acc[ps]) acc[ps] = [];
                        acc[ps].push(row);
                      }
                      return acc;
                    }, {})
                  ).sort((a, b) => b[0].localeCompare(a[0])).map(([paymentStatusGroup, rows]: [string, any]) => {
                    // Default-expanded groups (e.g. "Unpaid") are seeded into expandedBoeStatus; toggling adds/removes freely.
                    const isExpanded = expandedBoeStatus.has(paymentStatusGroup);
                    const groupTotal = rows.reduce((acc: number, row: any) => acc + sortedCmdBanksList.reduce((acc2: number, b: string) => acc2 + (row[b] || 0), 0), 0);
                    
                    return (
                      <React.Fragment key={paymentStatusGroup}>
                        <tr 
                          className="bg-canvas hover:bg-canvas-soft/40 transition-colors cursor-pointer group"
                          onClick={() => toggleBoeStatus(paymentStatusGroup)}
                        >
                          <td className="px-3 py-2 font-black text-ink bg-canvas group-hover:bg-canvas-soft/40 z-10 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <ChevronRight className={`w-3 h-3 text-ink-faint transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              {toProperCase(paymentStatusGroup)}
                            </div>
                          </td>
                          <td className="px-3 py-2 border-r border-hairline bg-canvas group-hover:bg-canvas-soft/40 z-10 text-[9px] text-ink-mute font-bold uppercase tracking-wider">
                            
                          </td>
                          <td className={`px-3 py-2 text-right font-black ${amountColorClass} bg-canvas group-hover:bg-canvas-soft/40`}>
                            {formatCurrencyCompact(groupTotal, currency, amountUnit)}
                          </td>
                          {sortedCmdBanksList.map((bank: string) => {
                            const bankTotal = rows.reduce((acc: number, row: any) => acc + (row[bank] || 0), 0);
                            return (
                              <td key={bank} className="px-3 py-2 text-right font-bold text-ink">
                                {bankTotal > 0 ? formatCurrencyCompact(bankTotal, currency, amountUnit) : '—'}
                              </td>
                            )
                          })}
                        </tr>
                        
                        {isExpanded && [...rows].sort((a: any, b: any) => (b.boe_status || '').localeCompare(a.boe_status || '')).map((row: any, i: number) => {
                          const rowTotal = sortedCmdBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                          const statusKey = `${row.boe_status} & ${row.payment_status}`
                          return (
                            <tr key={i} className="hover:bg-canvas-soft/40 transition-colors group">
                              <td className="px-6 py-2 font-medium text-ink-mute bg-canvas group-hover:bg-canvas-soft/40 z-10 whitespace-nowrap">
                                {toProperCase(row.payment_status)}
                              </td>
                              <td className="px-3 py-2 flex items-center gap-1.5 border-r border-hairline bg-canvas group-hover:bg-canvas-soft/40 z-10 whitespace-nowrap">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: BOE_COLOR_MAP[statusKey] || '#6b7280' }} />
                                <span className="font-medium text-ink">{toProperCase(row.boe_status)}</span>
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-bold ${amountColorClass} bg-canvas group-hover:bg-canvas-soft/40 ${rowTotal > 0 ? 'cursor-pointer hover:underline' : ''}`}
                                onClick={() => { if (rowTotal > 0) handleBoeClick(row.boe_status, row.payment_status, 'Total') }}
                              >
                                {formatCurrencyCompact(rowTotal, currency, amountUnit)}
                              </td>
                              {sortedCmdBanksList.map((bank: string) => (
                                <td
                                  key={bank}
                                  className={`px-3 py-2 text-right font-semibold ${row[bank] > 0 ? `${amountColorClass} cursor-pointer hover:underline` : 'text-ink-mute'}`}
                                  onClick={() => { if (row[bank] > 0) handleBoeClick(row.boe_status, row.payment_status, bank) }}
                                >
                                  {row[bank] > 0 ? formatCurrencyCompact(row[bank], currency, amountUnit) : '—'}
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-canvas font-bold border-t-2 border-hairline">
                    <td colSpan={2} className="px-3 py-2 text-left text-ink border-r border-hairline sticky left-0 bg-canvas z-10 uppercase text-[9px]">Total</td>
                    <td className={`px-3 py-2 text-right ${amountColorClass} text-[11px]`}>
                      {formatCurrencyCompact((boe_status_bank_pivot || []).reduce((acc: number, row: any) => acc + sortedCmdBanksList.reduce((acc2: number, b: string) => acc2 + (row[b] || 0), 0), 0), currency, amountUnit)}
                    </td>
                    {sortedCmdBanksList.map((bank: string) => {
                      const colTotal = (boe_status_bank_pivot || []).reduce((acc: number, row: any) => acc + (row[bank] || 0), 0)
                      return (
                        <td key={bank} className="px-3 py-2 text-right text-ink">
                          {formatCurrencyCompact(colTotal, currency, amountUnit)}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>

            </div>
          </div>

          {/* Right column: Product-wise stacked above Margin-wise */}
          <div className="flex flex-col gap-3">

          {/* Product-wise Bills Pivot Table */}
          <div className="bg-canvas border border-hairline rounded-[10px] shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-ink">Product-wise BOE</h3>
                <p className="text-[10px] text-ink-mute mt-0.5">
                  Bifurcation of outstanding Bill of Entry compliance value by product categories across banks.
                </p>
              </div>
              <div className="flex items-center gap-0.5 bg-canvas border border-hairline rounded-lg p-0.5 shadow-sm">
                {(['Unpaid', 'Paid', 'All'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setPaymentStatus(s)}
                    className={`px-2 py-0.5 text-[8.5px] font-bold uppercase rounded-md transition-all ${
                      paymentStatus === s
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'text-ink-mute hover:text-[#1d4ed8]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10.5px]">
                <thead className="bg-canvas">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold text-ink-mute border-r border-hairline sticky left-0 bg-canvas z-10">Product Type</th>
                    <th className="px-4 py-2 text-right font-bold text-ink bg-canvas">Total</th>
                    {sortedCmdBanksList.map((bank: string) => (
                      <th key={bank} className="px-4 py-2 text-right font-bold text-ink-mute min-w-[80px] bg-canvas z-10">{bank}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {Object.entries(groupedProducts).map(([type, products]) => {
                    const isExpanded = expandedTypes.has(type)
                    const typeTotal = sortedCmdBanksList.reduce((acc, b) => acc + products.reduce((pAcc, p) => pAcc + (p[b] || 0), 0), 0)
                    
                    return (
                      <React.Fragment key={type}>
                        {/* Type Summary Row */}
                        <tr 
                          className="bg-canvas hover:bg-canvas-soft/40 transition-colors cursor-pointer group"
                          onClick={() => toggleType(type)}
                        >
                          <td className="px-4 py-2 border-r border-hairline sticky left-0 bg-canvas group-hover:bg-canvas-soft/40 z-10">
                            <div className="flex items-center gap-1.5">
                              <ChevronRight className={`w-3 h-3 text-ink-faint transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              <span className="font-black text-ink tracking-wide">{type}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-2 text-right font-black ${amountColorClass} bg-canvas group-hover:bg-canvas-soft/40`}>
                            {formatCurrencyCompact(typeTotal, currency, amountUnit)}
                          </td>
                          {sortedCmdBanksList.map((bank: string) => {
                            const bankTotal = products.reduce((acc, p) => acc + (p[bank] || 0), 0)
                            return (
                              <td key={bank} className="px-4 py-2 text-right font-bold text-ink">
                                {bankTotal > 0 ? formatCurrencyCompact(bankTotal, currency, amountUnit) : '—'}
                              </td>
                            )
                          })}
                        </tr>

                        {/* Individual Product Rows */}
                        {isExpanded && products.map((row: any, i: number) => {
                          const rowTotal = sortedCmdBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                          return (
                            <tr key={`${type}-${i}`} className="hover:bg-canvas-soft/40 transition-colors group">
                              <td className="px-6 py-1.5 font-medium text-ink-mute border-r border-hairline sticky left-0 bg-canvas group-hover:bg-canvas-soft/40 z-10 truncate max-w-[180px]" title={row.product}>
                                {row.product}
                              </td>
                              <td className="px-4 py-1.5 text-right font-bold text-ink-mute bg-canvas group-hover:bg-canvas-soft/40">
                                {formatCurrencyCompact(rowTotal, currency, amountUnit)}
                              </td>
                              {sortedCmdBanksList.map((bank: string) => (
                                <td key={bank} className="px-4 py-1.5 text-right font-semibold text-ink-mute">
                                  {row[bank] > 0 ? formatCurrencyCompact(row[bank], currency, amountUnit) : '—'}
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Margin-wise Pivot Table */}
          <div className="bg-canvas border border-hairline rounded-[10px] shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-1.5 border-b flex items-center justify-between bg-canvas">
              <div>
                <h3 className="text-[12px] font-bold text-ink">Margin-wise Exposure</h3>
                <p className="text-[9px] text-ink-mute">Open · Sum of Amount · all margin bands</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-canvas">
                    <th className="px-3 py-1.5 text-left font-bold text-ink-mute border-r border-hairline sticky left-0 bg-canvas z-10">Margin</th>
                    <th className="px-3 py-1.5 text-right font-bold text-ink bg-canvas">Total</th>
                    {sortedBanksList.map((bank: string) => (
                      <th key={bank} className="px-3 py-1.5 text-right font-bold text-ink-mute min-w-[100px] bg-canvas z-10">{bank}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {(utilData?.margin_bank_pivot || []).map((row: any, i: number) => {
                    const marginFraction = Number(row.margin)
                    const marginPct = +(marginFraction * 100).toFixed(2)
                    const rowTotal = sortedBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                    return (
                      <tr key={i} className="hover:bg-canvas-soft/40 transition-colors group">
                        <td className="px-3 py-1.5 font-bold text-ink border-r border-hairline sticky left-0 bg-canvas group-hover:bg-canvas-soft/40 z-10">
                          {marginPct}%
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-bold ${amountColorClass} cursor-pointer hover:underline bg-canvas group-hover:bg-canvas-soft/40`}
                          onClick={() => handleMarginClick(marginFraction, 'Total')}
                        >
                          {formatCurrencyCompact(rowTotal, currency, amountUnit)}
                        </td>
                        {sortedBanksList.map((bank: string) => (
                          <td
                            key={bank}
                            className={`px-3 py-1.5 text-right ${row[bank] > 0 ? `${amountColorClass} cursor-pointer hover:underline` : 'text-ink-mute'}`}
                            onClick={() => {
                              if (row[bank] > 0) handleMarginClick(marginFraction, bank)
                            }}
                          >
                            {row[bank] > 0 ? formatCurrencyCompact(row[bank], currency, amountUnit) : '—'}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          </div>{/* end right column wrapper */}

        </div>{/* end grid */}

        <DrillDownModal 
          isOpen={isDrillDownOpen}
          onClose={() => setIsDrillDownOpen(false)}
          data={drillDownData}
          title={drillDownTitle}
        />
      </div>
    </div>
  )
}

export default LimitUtilization
