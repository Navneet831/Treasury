// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react'
import { getLimitUtilisation, getCommandData, getDrillDown } from '../../api'
import DrillDownModal from '../../components/DrillDownModal'
import ProvenanceBadge from '../../components/ProvenanceBadge'
import { useStore } from '../../store'
import { formatCurrencyCompact, formatPercent } from '../../utils'
import { 
  Gauge, RefreshCw, Clock, Shield,
  ChevronRight, TrendingUp, Building2,  FileText, CreditCard, Activity, Wallet, ShieldCheck,
  Package, Users, Globe
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'

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
}> = ({ title, icon, isActive, onClick, headroom, limit, used, pct, color, currency, unit, overdue, frozen, formula }) => (
  <button
    onClick={onClick}
    className={`flex-1 bg-white border rounded-lg p-2 transition-all duration-300 text-left relative overflow-hidden group ${
      isActive 
        ? 'border-transparent shadow-sm ring-1 ring-offset-0' 
        : 'border-slate-200 hover:border-slate-300 shadow-sm'
    }`}
    style={{ 
      boxShadow: isActive ? `0 4px 12px -2px ${color}20` : undefined,
      borderColor: isActive ? color : undefined,
      background: isActive ? `linear-gradient(135deg, var(--color-canvas) 0%, ${color}05 100%)` : 'var(--color-canvas)'
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
        <div className={`p-1 rounded transition-colors ${isActive ? 'bg-slate-50' : 'bg-slate-50 group-hover:bg-slate-100'}`} style={{ color: isActive ? color : '#64748b' }}>
          {React.cloneElement(icon as React.ReactElement, { size: 14 })}
        </div>
        <span className="text-[10.5px] font-black text-slate-900 uppercase tracking-wider">{title}</span>
        
        <div className="hidden lg:flex items-center gap-1.5 ml-2 w-16">
          <div className="flex-1 bg-slate-100 h-1 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-[8px] font-black text-slate-500 whitespace-nowrap" title="Utilization % = (Used / Limit) * 100">{formatPercent(pct)}</span>
        </div>
      </div>
      
      {/* Right section: Limit, Used, Available, Overdue, Frozen */}
      <div className="flex items-center gap-3 md:gap-4" title={formula}>
        <div className="flex flex-col items-end">
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-0.5">Limit</span>
          <span className="text-[10.5px] font-bold text-slate-600 leading-none">{formatCurrencyCompact(limit, currency, unit)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-0.5">Used</span>
          <span className="text-[10.5px] font-bold text-slate-600 leading-none">{formatCurrencyCompact(used, currency, unit)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tight leading-none mb-0.5">Available</span>
          <span className="text-[11.5px] font-black text-slate-900 leading-none">{formatCurrencyCompact(headroom, currency, unit)}</span>
        </div>
        
        {((overdue && overdue.amount > 0) || (frozen && frozen > 0)) && (
          <div className="flex gap-3 pl-2 md:pl-3 border-l border-slate-100">
            {overdue && overdue.amount > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[6px] font-bold text-red-500 uppercase tracking-tighter leading-none mb-0.5">Overdue</span>
                <span className="text-[10px] font-black text-red-600 leading-none">{formatCurrencyCompact(overdue.amount, currency, unit)}</span>
              </div>
            )}
            {frozen && frozen > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[6px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-0.5">Frozen</span>
                <span className="text-[10px] font-black text-slate-600 leading-none">{formatCurrencyCompact(frozen, currency, unit)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </button>
)

const LimitUtilization: React.FC = () => {
  const { currency, fy, asOnDate, amountUnit, setAmountUnit } = useStore()
  const [utilData, setUtilData] = useState<any>(null)
  const [cmdData, setCmdData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [util, cmd] = await Promise.all([
        getLimitUtilisation(currency, fy, paymentStatus, facilityToggle, boeToggle),
        getCommandData(currency, fy, paymentStatus, facilityToggle, boeToggle)
      ])
      setUtilData(util)
      setCmdData(cmd)
    } catch (e) {
      console.error('Data fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [currency, fy, paymentStatus, facilityToggle, boeToggle])

  useEffect(() => { fetchData() }, [fetchData])

  // Listen for global Refresh button in Header
  useEffect(() => {
    window.addEventListener('app-refresh', fetchData)
    return () => window.removeEventListener('app-refresh', fetchData)
  }, [fetchData])

  if (loading && !utilData) {
    return (
      <div className="p-8 space-y-6 animate-pulse bg-[#f8fafc] min-h-screen">
        <div className="h-8 w-64 bg-[#e2e8f0] rounded" />
        <div className="grid grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-20 bg-[#e2e8f0] rounded-lg" />)}
        </div>
        <div className="h-32 bg-[#e2e8f0] rounded-xl" />
        <div className="h-64 bg-[#e2e8f0] rounded-xl" />
      </div>
    )
  }

  if (!utilData || !cmdData) {
    return (
      <div className="p-12 text-center text-[#64748b] bg-[#f8fafc] min-h-screen">
        No data available. Verify the backend connection.
      </div>
    )
  }

  let { bank_utilization: banks = [], portfolio_summary: summary = {}, margin_bank_pivot = [], banks_list = [] } = utilData
  const {
    summary: cmdSummary = {},
    boe_status_wise = [],
    product_unpaid_pivot = [],
    currencies_list = [],
    boe_status_bank_pivot = [],
    banks_list: cmdBanksList = []
  } = cmdData

  // Sort banks: SBI, BOI, IDBI first
  const bankOrderMap: Record<string, number> = { 'SBI': 1, 'BOI': 2, 'IDBI': 3 }
  banks = [...banks].sort((a, b) => {
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
  const sortedBanksList = reorderBanksList(banks_list)

  // Dynamic columns matching the selected currency
  const isInr = currency === 'INR'
  const colAmt = isInr ? 'LC."LC Amt (in INR)"' : 'LC."Final LC Amt (in FC)"'
  const colBoe = isInr ? 'LC."BOE Bill Amt (in INR)"' : 'LC."BOE Bill Amt (in FC)"'
  const colInProcess = isInr ? '"LC BG in Process"."AMT IN INR"' : '"LC BG in Process"."Amt in FC"'
  const colSblc = isInr ? 'SBLC."Final PAYMENT AMT INR"' : 'SBLC."SBLC Bill Amt (in FC)"'
  const colCash = isInr ? 'LC."LC Amt (in INR)"' : 'LC."Final LC Amt (in FC)"'

  const isSblcActive = facilityToggle === 'SBLC'
  const isCashActive = facilityToggle === 'CASH'
  const amountColorClass = isSblcActive ? 'text-[#16a34a]' : (isCashActive ? 'text-[#475569]' : 'text-[#1d4ed8]')

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
  const cashPct = totalCashLimit > 0 ? (totalCashUsed / totalCashLimit) * 100 : 0

  const totalSblcLimit = totalSblcLimitOnly
  const totalSblcUsed = totalSblcUsedOnly
  const sblcPct = sblcOnlyPct

  // Hoisted function declaration: referenced earlier in the component (e.g. the
  // data-derivation forEach and drill-down handler) before this point, so it must
  // not be a `const` (which would be in the temporal dead zone at those call sites).
  function toProperCase(str: string) {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }

  const groupedProducts: Record<string, any[]> = {}
  product_unpaid_pivot.forEach((row: any) => {
    const t = toProperCase(row.type || 'Unknown')
    if (!groupedProducts[t]) groupedProducts[t] = []
    groupedProducts[t].push(row)
  })

  const overallPct = summary.overall_utilization_pct || 0
  const utilColor = getUtilColor(overallPct)
  
  const getStatusColor = (pct: number) => {
    if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Critical' }
    if (pct >= 75) return { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'High' }
    if (pct >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100', label: 'Moderate' }
    return { bar: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-100', label: 'Safe' }
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen p-3 md:p-4 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-2.5">
        
        {/* ── Page Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-[#0f172a] tracking-tight leading-tight">Limit Utilization Monitor</h1>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Consolidated bank-wise LC & Interchangeable facility usage
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAmountUnit(amountUnit === 'Absolute' ? 'Cr' : 'Absolute')}
              className={`px-2.5 py-1 text-[9px] font-bold rounded-md border transition-all ${
                amountUnit === 'Absolute'
                  ? 'bg-[#1d4ed8] text-white border-[#1d4ed8] shadow-sm'
                  : 'bg-white text-[#64748b] border-[#e2e8f0] hover:border-[#1d4ed8] hover:text-[#1d4ed8]'
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
              <div className={`bg-white border border-[#e2e8f0] rounded-[10px] shadow-sm hover:shadow-md transition-all flex flex-col min-w-[320px] w-fit flex-shrink-0 ${isBanksCollapsed ? 'p-2.5' : 'p-3'}`}>
                <div className={`flex justify-between items-center cursor-pointer select-none ${isBanksCollapsed ? 'mb-0' : 'mb-1'}`} onClick={toggleBank}>
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.bar}`} />
                    <h3 className="font-bold text-[13.5px] text-[#0f172a] tracking-tight">Consolidated</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100" title={`LC Utilization % = (LC Used / LC Limit) * 100. Used: ${formatCurrencyCompact(totalLcUsed, currency, amountUnit)} / Limit: ${formatCurrencyCompact(totalLcLimit, currency, amountUnit)}`}>
                      {formatPercent(lcPct)}
                    </span>
                    <span className="text-[10px] text-slate-300 font-bold">/</span>
                    <span className="text-[12px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100" title={`SBLC Utilization % = (SBLC Used / SBLC Limit) * 100. Used: ${formatCurrencyCompact(totalSblcUsed, currency, amountUnit)} / Limit: ${formatCurrencyCompact(totalSblcLimit, currency, amountUnit)}`}>
                      {formatPercent(sblcPct)}
                    </span>
                    <ChevronRight className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-200 ${isBanksCollapsed ? '' : 'rotate-90'}`} />
                  </div>
                </div>

                {isBanksCollapsed ? (
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9.5px] font-bold text-[#64748b]">Total Available Balance</span>
                    <span className="text-[12px] font-black text-[#15803d]">
                      {formatCurrencyCompact(totalBalance, currency, amountUnit)}
                    </span>
                  </div>
                ) : (
                  <div className="bg-[#f8fafc] rounded-lg border border-[#f1f5f9] p-1.5 mb-0.5">
                    <table className="w-full text-[9.5px]">
                      <thead>
                        <tr className="text-[#64748b] border-b border-[#e2e8f0]">
                          <th className="pb-0.5 text-left font-bold tracking-wider">Facility</th>
                          <th className="pb-0.5 text-right font-bold tracking-wider px-1">Limit</th>
                          <th className="pb-0.5 text-right font-bold tracking-wider px-1">Used</th>
                          <th className="pb-0.5 text-right font-black tracking-wider text-[#0f766e] bg-[#EDF9F7] px-1 rounded-t">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0]">
                        <tr title="Total = LC Limit Pot + Cash Limit">
                          <td className="py-1 font-black text-[#0f172a]">Total</td>
                          <td className="py-1 text-right font-bold text-[#64748b] px-1" title={tooltipTotalLimit}>{formatCurrencyCompact(totalLimit, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-bold text-[#64748b] px-1" title={tooltipTotalUsed}>{formatCurrencyCompact(totalUsed, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-black text-[#0f766e] text-[12.5px] bg-[#EDF9F7] px-1" title={tooltipTotalBalance}>
                            {formatCurrencyCompact(totalBalance, currency, amountUnit)}
                          </td>
                        </tr>
                        <tr title="LC = LC Limit Pot - SBLC Limit">
                          <td 
                            className="py-0.5 pl-1 font-bold text-[#475569] cursor-pointer hover:text-[#1d4ed8] flex items-center gap-0.5"
                            onClick={(e) => { e.stopPropagation(); setIsLcOutstandingExpanded(!isLcOutstandingExpanded); }}
                          >
                            LC {isLcOutstandingExpanded ? '−' : '+'}
                          </td>
                          <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipLcLimit}>{formatCurrencyCompact(totalLcLimit, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-bold text-[#94a3b8] px-1" title={tooltipLcUsed}>{formatCurrencyCompact(totalLcUsed, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-[#EDF9F7] px-1" title={tooltipLcBalance}>
                            {formatCurrencyCompact(totalLcLimit - totalLcUsed, currency, amountUnit)}
                          </td>
                        </tr>
                        {isLcOutstandingExpanded && (
                          <>
                            <tr title="LC Outstanding: Open Letter of Credit Exposure">
                              <td className="py-0.5 pl-4 font-medium text-[#64748b]">LC Outstanding</td>
                              <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title="Limit = Not Applicable for individual sub-facilities">—</td>
                              <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipLcOutstanding}>{formatCurrencyCompact(totalLcOutstanding, currency, amountUnit)}</td>
                              <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-[#EDF9F7] px-1" title="Balance = Not Applicable for individual sub-facilities">—</td>
                            </tr>
                            <tr title="LC in Process: Documents submitted to bank but not yet drawn">
                              <td className="py-0.5 pl-4 font-medium text-[#64748b]">LC in Process</td>
                              <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title="Limit = Not Applicable for individual sub-facilities">—</td>
                              <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipLcInProcess}>{formatCurrencyCompact(totalLcInProcess, currency, amountUnit)}</td>
                              <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-[#EDF9F7] px-1" title="Balance = Not Applicable for individual sub-facilities">—</td>
                            </tr>
                          </>
                        )}
                        <tr title="Interchangeable = SBLC Limit + Cash Limit">
                          <td 
                            className="py-1 pl-1 font-bold text-[#475569] cursor-pointer hover:text-[#1d4ed8] flex items-center gap-0.5"
                            onClick={(e) => { e.stopPropagation(); setIsInterchangeableExpanded(!isInterchangeableExpanded); }}
                          >
                            Interchangeable {isInterchangeableExpanded ? '−' : '+'}
                          </td>
                          <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipInterchangeableLimit}>{formatCurrencyCompact(totalInterchangeableLimit, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={tooltipInterchangeableUsed}>{formatCurrencyCompact(totalSblcUsed + totalCashUsed, currency, amountUnit)}</td>
                          <td className="py-1 text-right font-bold text-[#0f766e] text-[10.5px] bg-[#EDF9F7] px-1 rounded-b" title={tooltipInterchangeableBalance}>
                            {formatCurrencyCompact(totalInterchangeableLimit - (totalSblcUsed + totalCashUsed), currency, amountUnit)}
                          </td>
                        </tr>
                        {isInterchangeableExpanded && (
                          <>
                            <tr className="bg-white/50" title="SBLC: Standby Letter of Credit">
                              <td className="py-0.5 pl-4 font-medium text-[#64748b]">SBLC</td>
                              <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={tooltipSblcLimit}>{formatCurrencyCompact(totalSblcLimit, currency, amountUnit)}</td>
                              <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={tooltipSblcUsed}>{formatCurrencyCompact(totalSblcUsed, currency, amountUnit)}</td>
                              <td className="py-0.5 text-right px-1 font-medium text-[#16a34a]" title={tooltipSblcBalance}>
                                {formatCurrencyCompact(Math.max(0, totalSblcLimit - totalSblcUsed), currency, amountUnit)}
                              </td>
                            </tr>
                            <tr className="bg-white/50" title="Cash: Cash Credit or other fungible components">
                              <td className="py-0.5 pl-4 font-medium text-[#64748b]">Cash</td>
                              <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={tooltipCashLimit}>{formatCurrencyCompact(totalCashLimit, currency, amountUnit)}</td>
                              <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={tooltipCashUsed}>{formatCurrencyCompact(totalCashUsed, currency, amountUnit)}</td>
                              <td className="py-0.5 text-right px-1 font-medium text-[#475569]" title={tooltipCashBalance}>
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
                  <div className="w-1/2 bg-[#f1f5f9] h-full rounded-full overflow-hidden" title={`LC Utilization: ${formatPercent(lcPct)}`}>
                    <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${Math.min(lcPct, 100)}%` }} />
                  </div>
                  <div className="w-1/2 bg-[#f1f5f9] h-full rounded-full overflow-hidden" title={`SBLC Utilization: ${formatPercent(sblcPct)}`}>
                    <div className="h-full bg-green-600 transition-all duration-1000" style={{ width: `${Math.min(sblcPct, 100)}%` }} />
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
              <div key={idx} className={`bg-white border border-[#e2e8f0] rounded-[10px] shadow-sm hover:shadow-md transition-all flex flex-col min-w-[320px] w-fit flex-shrink-0 ${isBanksCollapsed ? 'p-2.5' : 'p-3'}`}>
                <div className={`flex justify-between items-center cursor-pointer select-none ${isBanksCollapsed ? 'mb-0' : 'mb-1'}`} onClick={toggleBank}>
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.bar}`} />
                    <h3 className="font-bold text-[13.5px] text-[#0f172a]">{bank.bank}</h3>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100" title={`LC Utilization % = (LC Used / LC Limit) * 100. Used: ${formatCurrencyCompact(lcUsed, currency, amountUnit)} / Limit: ${formatCurrencyCompact(lcLimit, currency, amountUnit)}`}>
                      {formatPercent(bankLcPct)}
                    </span>
                    <span className="text-[10px] text-slate-300 font-bold">/</span>
                    <span className="text-[12px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-100" title={`SBLC Utilization % = (SBLC Used / SBLC Limit) * 100. Used: ${formatCurrencyCompact(sblcUsed, currency, amountUnit)} / Limit: ${formatCurrencyCompact(sblcLimit, currency, amountUnit)}`}>
                      {formatPercent(bankSblcPct)}
                    </span>
                    <ChevronRight className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-200 ${isBanksCollapsed ? '' : 'rotate-90'}`} />
                  </div>
                </div>

                {isBanksCollapsed ? (
                  /* Compact collapsed card: bank (header) + utilization% (header) + balance */
                  <div className="flex items-center justify-between mt-0.5" title={`Balance = (bank_limit.LC + bank_limit.Cash) - (LC Outstanding + LC in Process + SBLC Used + Cash Used) for ${bank.bank}`}>
                    <span className="text-[9.5px] font-bold text-[#64748b]">Balance Available</span>
                    <span className="text-[12px] font-black text-[#15803d]">
                      {formatCurrencyCompact(totalBalance, currency, amountUnit)}
                    </span>
                  </div>
                ) : (
                  /* Expanded card: full 3x3 facility grid (Total, LC, SBLC) */
                  <div className="bg-[#f8fafc] rounded-lg border border-[#f1f5f9] p-1.5 mb-0.5">
                      {(() => {
                        return (
                          <table className="w-full text-[9.5px]">
                            <thead>
                              <tr className="text-[#64748b] border-b border-[#e2e8f0]">
                                <th className="pb-0.5 text-left font-bold tracking-wider">Facility</th>
                                <th className="pb-0.5 text-right font-bold tracking-wider px-1">Limit</th>
                                <th className="pb-0.5 text-right font-bold tracking-wider px-1">Used</th>
                                <th className="pb-0.5 text-right font-black tracking-wider text-[#0f766e] bg-[#EDF9F7] px-1 rounded-t">Balance</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e2e8f0]">
                              <tr title="Total = LC Limit Pot + Cash Limit">
                                <td className="py-1 font-black text-[#0f172a]">Total</td>
                                <td className="py-1 text-right font-bold text-[#64748b] px-1" title={`Limit = bank_limit.LC + bank_limit.Cash for ${bank.bank}`}>{formatCurrencyCompact(totalLimit, currency, amountUnit)}</td>
                                <td className="py-1 text-right font-bold text-[#64748b] px-1" title={`Used = LC Outstanding + LC in Process + SBLC Used + Cash Used for ${bank.bank}`}>{formatCurrencyCompact(totalUsed, currency, amountUnit)}</td>
                                <td className="py-1 text-right font-black text-[#0f766e] text-[12.5px] bg-[#EDF9F7] px-1" title="Balance = Total Limit - Total Used">
                                  {formatCurrencyCompact(totalBalance, currency, amountUnit)}
                                </td>
                              </tr>
                              <tr title="LC = LC Limit Pot - SBLC Limit">
                                <td 
                                  className="py-0.5 pl-1 font-bold text-[#475569] cursor-pointer hover:text-[#1d4ed8] flex items-center gap-0.5"
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
                                <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-[#EDF9F7] px-1" title="Balance = LC Limit - LC Used">
                                  {formatCurrencyCompact(lcLimit - ((bank.lc_open || 0) + (bank.lc_in_process || 0)), currency, amountUnit)}
                                </td>
                              </tr>
                              {isLcOutstandingExpanded && (
                                <>
                                  <tr title="LC Outstanding: Open Letter of Credit Exposure">
                                    <td className="py-0.5 pl-4 font-medium text-[#64748b]">LC Outstanding</td>
                                    <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title="Limit = Not Applicable for individual sub-facilities">—</td>
                                    <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={isDynamicSblc ? `Used = Sum of (${colBoe} where LC.Bank Name = '${bank.bank}', LC.LC Status = 'Open', LC.Margin = 0.1)` : `Used = Sum of (${colAmt} where LC.Bank Name = '${bank.bank}', LC.LC Status = 'Open', LC.Margin = 0.1)`}>{formatCurrencyCompact(bank.lc_open || 0, currency, amountUnit)}</td>
                                    <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-[#EDF9F7] px-1" title="Balance = Not Applicable for individual sub-facilities">—</td>
                                  </tr>
                                  <tr title="LC in Process: Documents submitted to bank but not yet drawn">
                                    <td className="py-0.5 pl-4 font-medium text-[#64748b]">LC in Process</td>
                                    <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title="Limit = Not Applicable for individual sub-facilities">—</td>
                                    <td className="py-1 text-right font-semibold text-[#94a3b8] px-1" title={isDynamicSblc ? "Used = Fixed at 0 for BOI & IDBI" : `Used = Sum of (${colInProcess} where LC BG in Process.Bank Name = '${bank.bank}' and LC BG in Process.Status = 'DOC SUBMITTED TO BANK')`}>{formatCurrencyCompact(bank.lc_in_process || 0, currency, amountUnit)}</td>
                                    <td className="py-1 text-right font-bold text-[#1d4ed8] text-[10.5px] bg-[#EDF9F7] px-1" title="Balance = Not Applicable for individual sub-facilities">—</td>
                                  </tr>
                                </>
                              )}
                              <tr title="Interchangeable = SBLC Limit + Cash Limit">
                                <td 
                                  className="py-1 pl-1 font-bold text-[#475569] cursor-pointer hover:text-[#1d4ed8] flex items-center gap-0.5"
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
                                <td className="py-1 text-right font-bold text-[#0f766e] text-[10.5px] bg-[#EDF9F7] px-1 rounded-b" title="Balance = Interchangeable Limit - Interchangeable Used">
                                  {formatCurrencyCompact(((bank.cash_limit || 0) + effectiveSblcLimit) - ((bank.sblc_utilization || 0) + (bank.cash_utilization || 0)), currency, amountUnit)}
                                </td>
                              </tr>
                              {isInterchangeableExpanded && (
                                <>
                                  <tr className="bg-white/50" title="SBLC: Standby Letter of Credit">
                                    <td className="py-0.5 pl-4 font-medium text-[#64748b]">SBLC</td>
                                    <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={isDynamicSblc ? "Limit = SBLC Used (dynamically bound for BOI/IDBI)" : `Limit = bank_limit.SBLC for ${bank.bank}`}>
                                      {effectiveSblcLimit ? formatCurrencyCompact(effectiveSblcLimit, currency, amountUnit) : '—'}
                                    </td>
                                    <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={`Used = Sum of (${colSblc} where SBLC.BANK = '${bank.bank}' and (SBLC.Payment Status != 'Paid' OR SBLC.Payment Status IS NULL))`}>{formatCurrencyCompact(bank.sblc_utilization || 0, currency, amountUnit)}</td>
                                    <td className="py-0.5 text-right px-1 font-medium text-[#16a34a]" title="Balance = SBLC Limit - SBLC Used">
                                      {formatCurrencyCompact(Math.max(0, (effectiveSblcLimit || 0) - (bank.sblc_utilization || 0)), currency, amountUnit)}
                                    </td>
                                  </tr>
                                  <tr className="bg-white/50" title="Cash: Cash Credit or other fungible components">
                                    <td className="py-0.5 pl-4 font-medium text-[#64748b]">Cash</td>
                                    <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={`Limit = bank_limit.Cash for ${bank.bank}`}>
                                      {bank.cash_limit ? formatCurrencyCompact(bank.cash_limit, currency, amountUnit) : '—'}
                                    </td>
                                    <td className="py-0.5 text-right font-medium text-[#94a3b8] px-1" title={`Used = Sum of cash-specific exposures derived from ${colCash} where LC.Bank Name = '${bank.bank}' and (Product Name or Type contains 'CASH')`}>{formatCurrencyCompact(bank.cash_utilization || 0, currency, amountUnit)}</td>
                                    <td className="py-0.5 text-right px-1 font-medium text-[#475569]" title="Balance = Cash Limit - Cash Used">
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
                  <div className="w-1/2 bg-[#f1f5f9] h-full rounded-full overflow-hidden" title={`LC Utilization: ${formatPercent(bankLcPct)}`}>
                    <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${Math.min(bankLcPct, 100)}%` }} />
                  </div>
                  <div className="w-1/2 bg-[#f1f5f9] h-full rounded-full overflow-hidden" title={`SBLC Utilization: ${formatPercent(bankSblcPct)}`}>
                    <div className="h-full bg-green-600 transition-all duration-1000" style={{ width: `${Math.min(bankSblcPct, 100)}%` }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

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
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 border-b flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-[#0f172a]">BOE Pipeline Compliance</h3>
                <p className="text-[10px] text-[#64748b]">Operational tracking of Bill of Entry submission</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#64748b]">NFB Status:</span>
                <div className="flex items-center gap-0.5 bg-white border border-[#e2e8f0] rounded-lg p-0.5 shadow-sm">
                  {(['Open', 'Closed', 'All'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setBoeToggle(s)}
                      className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-md transition-all ${
                        boeToggle === s
                          ? 'bg-[#1d4ed8] text-white shadow-sm'
                          : 'text-[#64748b] hover:text-[#1d4ed8]'
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
                <thead className="bg-white">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-[#64748b] bg-white z-10">Payment</th>
                    <th className="px-3 py-2 text-left font-bold text-[#64748b] border-r border-[#e2e8f0] bg-white z-10">BOE Status</th>
                    <th className="px-3 py-2 text-right font-bold text-[#0f172a] bg-white">Total</th>
                    {sortedCmdBanksList.map((bank: string) => (
                      <th key={bank} className="px-3 py-2 text-right font-bold text-[#64748b] min-w-[80px]">{bank}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
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
                          className="bg-white hover:bg-slate-50/40 transition-colors cursor-pointer group"
                          onClick={() => toggleBoeStatus(paymentStatusGroup)}
                        >
                          <td className="px-3 py-2 font-black text-[#0f172a] bg-white group-hover:bg-slate-50/40 z-10 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              {toProperCase(paymentStatusGroup)}
                            </div>
                          </td>
                          <td className="px-3 py-2 border-r border-[#e2e8f0] bg-white group-hover:bg-slate-50/40 z-10 text-[9px] text-[#64748b] font-bold uppercase tracking-wider">
                            
                          </td>
                          <td className={`px-3 py-2 text-right font-black ${amountColorClass} bg-white group-hover:bg-slate-50/40`}>
                            {formatCurrencyCompact(groupTotal, currency, amountUnit)}
                          </td>
                          {sortedCmdBanksList.map((bank: string) => {
                            const bankTotal = rows.reduce((acc: number, row: any) => acc + (row[bank] || 0), 0);
                            return (
                              <td key={bank} className="px-3 py-2 text-right font-bold text-[#0f172a]">
                                {bankTotal > 0 ? formatCurrencyCompact(bankTotal, currency, amountUnit) : '—'}
                              </td>
                            )
                          })}
                        </tr>
                        
                        {isExpanded && [...rows].sort((a: any, b: any) => (b.boe_status || '').localeCompare(a.boe_status || '')).map((row: any, i: number) => {
                          const rowTotal = sortedCmdBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                          const statusKey = `${row.boe_status} & ${row.payment_status}`
                          return (
                            <tr key={i} className="hover:bg-slate-50/40 transition-colors group">
                              <td className="px-6 py-2 font-medium text-[#475569] bg-white group-hover:bg-slate-50/40 z-10 whitespace-nowrap">
                                {toProperCase(row.payment_status)}
                              </td>
                              <td className="px-3 py-2 flex items-center gap-1.5 border-r border-[#e2e8f0] bg-white group-hover:bg-slate-50/40 z-10 whitespace-nowrap">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: BOE_COLOR_MAP[statusKey] || '#6b7280' }} />
                                <span className="font-medium text-[#0f172a]">{toProperCase(row.boe_status)}</span>
                              </td>
                              <td
                                className={`px-3 py-2 text-right font-bold ${amountColorClass} bg-white group-hover:bg-slate-50/40 ${rowTotal > 0 ? 'cursor-pointer hover:underline' : ''}`}
                                onClick={() => { if (rowTotal > 0) handleBoeClick(row.boe_status, row.payment_status, 'Total') }}
                              >
                                {formatCurrencyCompact(rowTotal, currency, amountUnit)}
                              </td>
                              {sortedCmdBanksList.map((bank: string) => (
                                <td
                                  key={bank}
                                  className={`px-3 py-2 text-right font-semibold ${row[bank] > 0 ? `${amountColorClass} cursor-pointer hover:underline` : 'text-[#475569]'}`}
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
                  <tr className="bg-white font-bold border-t-2 border-[#e2e8f0]">
                    <td colSpan={2} className="px-3 py-2 text-left text-[#0f172a] border-r border-[#e2e8f0] sticky left-0 bg-white z-10 uppercase text-[9px]">Total</td>
                    <td className={`px-3 py-2 text-right ${amountColorClass} text-[11px]`}>
                      {formatCurrencyCompact((boe_status_bank_pivot || []).reduce((acc: number, row: any) => acc + sortedCmdBanksList.reduce((acc2: number, b: string) => acc2 + (row[b] || 0), 0), 0), currency, amountUnit)}
                    </td>
                    {sortedCmdBanksList.map((bank: string) => {
                      const colTotal = (boe_status_bank_pivot || []).reduce((acc: number, row: any) => acc + (row[bank] || 0), 0)
                      return (
                        <td key={bank} className="px-3 py-2 text-right text-[#0f172a]">
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
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-[#0f172a]">Product-wise BOE</h3>
                <p className="text-[10px] text-[#64748b] mt-0.5">
                  Bifurcation of outstanding Bill of Entry compliance value by product categories across banks.
                </p>
              </div>
              <div className="flex items-center gap-0.5 bg-white border border-[#e2e8f0] rounded-lg p-0.5 shadow-sm">
                {(['Unpaid', 'Paid', 'All'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setPaymentStatus(s)}
                    className={`px-2 py-0.5 text-[8.5px] font-bold uppercase rounded-md transition-all ${
                      paymentStatus === s
                        ? 'bg-[#1d4ed8] text-white shadow-sm'
                        : 'text-[#64748b] hover:text-[#1d4ed8]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10.5px]">
                <thead className="bg-white">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold text-[#64748b] border-r border-[#e2e8f0] sticky left-0 bg-white z-10">Product Type</th>
                    <th className="px-4 py-2 text-right font-bold text-[#0f172a] bg-white">Total</th>
                    {sortedCmdBanksList.map((bank: string) => (
                      <th key={bank} className="px-4 py-2 text-right font-bold text-[#64748b] min-w-[80px]">{bank}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {Object.entries(groupedProducts).map(([type, products]) => {
                    const isExpanded = expandedTypes.has(type)
                    const typeTotal = sortedCmdBanksList.reduce((acc, b) => acc + products.reduce((pAcc, p) => pAcc + (p[b] || 0), 0), 0)
                    
                    return (
                      <React.Fragment key={type}>
                        {/* Type Summary Row */}
                        <tr 
                          className="bg-white hover:bg-slate-50/40 transition-colors cursor-pointer group"
                          onClick={() => toggleType(type)}
                        >
                          <td className="px-4 py-2 border-r border-[#e2e8f0] sticky left-0 bg-white group-hover:bg-slate-50/40 z-10">
                            <div className="flex items-center gap-1.5">
                              <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              <span className="font-black text-[#0f172a] tracking-wide">{type}</span>
                            </div>
                          </td>
                          <td className={`px-4 py-2 text-right font-black ${amountColorClass} bg-white group-hover:bg-slate-50/40`}>
                            {formatCurrencyCompact(typeTotal, currency, amountUnit)}
                          </td>
                          {sortedCmdBanksList.map((bank: string) => {
                            const bankTotal = products.reduce((acc, p) => acc + (p[bank] || 0), 0)
                            return (
                              <td key={bank} className="px-4 py-2 text-right font-bold text-[#0f172a]">
                                {bankTotal > 0 ? formatCurrencyCompact(bankTotal, currency, amountUnit) : '—'}
                              </td>
                            )
                          })}
                        </tr>

                        {/* Individual Product Rows */}
                        {isExpanded && products.map((row: any, i: number) => {
                          const rowTotal = sortedCmdBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                          return (
                            <tr key={`${type}-${i}`} className="hover:bg-slate-50/40 transition-colors group">
                              <td className="px-6 py-1.5 font-medium text-[#475569] border-r border-[#e2e8f0] sticky left-0 bg-white group-hover:bg-slate-50/40 z-10 truncate max-w-[180px]" title={row.product}>
                                {row.product}
                              </td>
                              <td className="px-4 py-1.5 text-right font-bold text-[#64748b] bg-white group-hover:bg-slate-50/40">
                                {formatCurrencyCompact(rowTotal, currency, amountUnit)}
                              </td>
                              {sortedCmdBanksList.map((bank: string) => (
                                <td key={bank} className="px-4 py-1.5 text-right font-semibold text-[#64748b]">
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
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-1.5 border-b flex items-center justify-between bg-white">
              <div>
                <h3 className="text-[12px] font-bold text-[#0f172a]">Margin-wise Exposure</h3>
                <p className="text-[9px] text-[#64748b]">Open · Sum of Amount · all margin bands</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-white">
                    <th className="px-3 py-1.5 text-left font-bold text-[#64748b] border-r border-[#e2e8f0] sticky left-0 bg-white z-10">Margin</th>
                    <th className="px-3 py-1.5 text-right font-bold text-[#0f172a] bg-white">Total</th>
                    {sortedBanksList.map((bank: string) => (
                      <th key={bank} className="px-3 py-1.5 text-right font-bold text-[#64748b] min-w-[100px]">{bank}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {(utilData.margin_bank_pivot || []).map((row: any, i: number) => {
                    const marginFraction = Number(row.margin)
                    const marginPct = +(marginFraction * 100).toFixed(2)
                    const rowTotal = sortedBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                    return (
                      <tr key={i} className="hover:bg-slate-50/40 transition-colors group">
                        <td className="px-3 py-1.5 font-bold text-[#0f172a] border-r border-[#e2e8f0] sticky left-0 bg-white group-hover:bg-slate-50/40 z-10">
                          {marginPct}%
                        </td>
                        <td
                          className={`px-3 py-1.5 text-right font-bold ${amountColorClass} cursor-pointer hover:underline bg-white group-hover:bg-slate-50/40`}
                          onClick={() => handleMarginClick(marginFraction, 'Total')}
                        >
                          {formatCurrencyCompact(rowTotal, currency, amountUnit)}
                        </td>
                        {sortedBanksList.map((bank: string) => (
                          <td
                            key={bank}
                            className={`px-3 py-1.5 text-right ${row[bank] > 0 ? `${amountColorClass} cursor-pointer hover:underline` : 'text-[#475569]'}`}
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
