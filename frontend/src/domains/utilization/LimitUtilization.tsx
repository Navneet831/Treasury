// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react'
import { getLimitUtilisation, getCommandData, getTreasuryActions } from '../../api'
import { useStore } from '../../store'
import { formatCurrencyCompact, formatPercent } from '../../utils'
import { 
  Gauge, RefreshCw, Clock, AlertTriangle, Shield, 
  ChevronRight, CheckCircle2, TrendingUp, Building2,
  FileText, CreditCard, Activity, Wallet, ShieldCheck,
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

const Divider = () => <div className="w-px h-10 bg-[#e2e8f0] flex-shrink-0 hidden md:block" />

const Metric: React.FC<{
  label: string
  value: string | number
  sub?: string
  valueColor?: string
  formula?: string
}> = ({ label, value, sub, valueColor = '#0f172a', formula }) => (
  <div className="flex flex-col min-w-0" title={formula}>
    <span className="text-[10px] font-bold text-[#64748b] mb-1.5">{label}</span>
    <span className="text-[19px] font-semibold tracking-tight leading-none mb-1 truncate" style={{ color: valueColor }}>
      {value}
    </span>
    {sub && <span className="text-[11px] text-[#94a3b8] truncate">{sub}</span>}
  </div>
)

const LimitUtilization: React.FC = () => {
  const { currency, fy, asOnDate, amountUnit, setAmountUnit } = useStore()
  const [utilData, setUtilData] = useState<any>(null)
  const [cmdData, setCmdData] = useState<any>(null)
  const [actions, setActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Unpaid'>('Unpaid')
  const [isBanksCollapsed, setIsBanksCollapsed] = useState(false)
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())
  const [isInterchangeableExpanded, setIsInterchangeableExpanded] = useState(true)

  const toggleBank = () => {
    setIsBanksCollapsed(!isBanksCollapsed)
  }

  const toggleType = (type: string) => {
    const next = new Set(expandedTypes)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    setExpandedTypes(next)
  }

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [util, cmd, acts] = await Promise.all([
        getLimitUtilisation(currency, fy, paymentStatus),
        getCommandData(currency, fy, paymentStatus),
        getTreasuryActions()
      ])
      setUtilData(util)
      setCmdData(cmd)
      setActions(Array.isArray(acts) ? acts : [])
    } catch (e) {
      console.error('Data fetch error:', e)
    } finally {
      setLoading(false)
    }
  }, [currency, fy, paymentStatus])

  useEffect(() => { fetchData() }, [fetchData])

  // Listen for global Refresh button in Header
  useEffect(() => {
    window.addEventListener('app-refresh', fetchData)
    return () => window.removeEventListener('app-refresh', fetchData)
  }, [fetchData])

  if (loading) {
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

  // Sort banks: SBI first
  banks = [...banks].sort((a, b) => {
    if (a.bank === 'SBI') return -1
    if (b.bank === 'SBI') return 1
    return a.bank.localeCompare(b.bank)
  })

  const reorderBanksList = (list: string[]) => {
    return [...list].sort((a, b) => {
      if (a === 'SBI') return -1
      if (b === 'SBI') return 1
      return a.localeCompare(b)
    })
  }

  const sortedCmdBanksList = reorderBanksList(cmdBanksList)
  const sortedBanksList = reorderBanksList(banks_list)

  const toProperCase = (str: string) => {
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }

  const groupedProducts: Record<string, any[]> = {}
  product_unpaid_pivot.forEach((row: any) => {
    const t = toProperCase(row.type || 'Unknown')
    if (!groupedProducts[t]) groupedProducts[t] = []
    groupedProducts[t].push(row)
  })

  const criticalActions = actions.filter((a: any) => Number(a.priority) <= 2)
  const overallPct = summary.overall_utilization_pct || 0
  const utilColor = getUtilColor(overallPct)
  
  const getStatusColor = (pct: number) => {
    if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Critical' }
    if (pct >= 75) return { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'High' }
    if (pct >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100', label: 'Moderate' }
    return { bar: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-100', label: 'Safe' }
  }

  return (
    <div className="bg-[#f8fafc] min-h-screen p-4 md:p-5 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-3">
        
        {/* ── Page Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[20px] font-semibold text-[#0f172a] tracking-tight leading-tight">Limit Utilization Monitor</h1>
            <p className="text-[12px] text-[#64748b] mt-0.5">
              Consolidated bank-wise LC & Interchangeable facility usage
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAmountUnit(amountUnit === 'Absolute' ? 'Cr' : 'Absolute')}
              className={`px-3 py-1 text-[10px] font-bold rounded-md border transition-all ${
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
        <div className="flex flex-nowrap gap-4 overflow-x-auto pb-4 custom-scrollbar-horizontal items-start">
          {banks.map((bank: any, idx: number) => {
            const status = getStatusColor(bank.utilization_pct)
            return (
              <div key={idx} className={`bg-white border border-[#e2e8f0] rounded-[10px] shadow-sm hover:shadow-md transition-all flex flex-col min-w-[320px] w-fit flex-shrink-0 ${isBanksCollapsed ? 'p-2.5' : 'p-3'}`}>
                <div className={`flex justify-between items-center cursor-pointer select-none ${isBanksCollapsed ? 'mb-0' : 'mb-1'}`} onClick={toggleBank}>
                  <div className="flex items-center gap-2 flex-1">
                    <div className={`w-1.5 h-1.5 rounded-full ${status.bar}`} />
                    <h3 className="font-bold text-[13.5px] text-[#0f172a]">{bank.bank}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[12.5px] font-black ${status.text}`}>{formatPercent(bank.utilization_pct)}</span>
                    <ChevronRight className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform duration-200 ${isBanksCollapsed ? '' : 'rotate-90'}`} />
                  </div>
                </div>

                {isBanksCollapsed ? (
                  /* Compact collapsed card: bank (header) + utilization% (header) + balance */
                  <div className="flex items-center justify-between mt-0.5" title={`Available Limit: Total Limit - Utilized LC - Utilized SBLC`}>
                    <span className="text-[9.5px] font-bold text-[#64748b]">Balance Available</span>
                    <span className="text-[12px] font-black text-[#15803d]">{formatCurrencyCompact(bank.available_limit, currency, amountUnit)}</span>
                  </div>
                ) : (
                  /* Expanded card: full 3x3 facility grid (Total, LC, SBLC) */
                  <div className="bg-[#f8fafc] rounded-lg border border-[#f1f5f9] p-1.5 mb-0.5">
                      <table className="w-full text-[9.5px]">
                        <thead>
                          <tr className="text-[#64748b] border-b border-[#e2e8f0]">
                            <th className="pb-0.5 text-left font-bold tracking-wider">Facility</th>
                            <th className="pb-0.5 text-right font-bold tracking-wider px-1">Limit</th>
                            <th className="pb-0.5 text-right font-bold tracking-wider px-1">Used</th>
                            <th className="pb-0.5 text-right font-black tracking-wider text-[#166534] bg-[#dcfce7] px-1 rounded-t min-w-[80px]">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e2e8f0]">
                          <tr title="Total = LC + Interchangeable (SBLC/Cash)">
                            <td className="py-1 font-black text-[#0f172a]">Total</td>
                            <td className="py-1 text-right font-bold text-[#0f172a] px-1">{formatCurrencyCompact(bank.interchangeability_limit, currency, amountUnit)}</td>
                            <td className="py-1 text-right font-bold text-[#0f172a] px-1">{formatCurrencyCompact((bank.used_limit || 0) + ((bank.sblc_utilization || 0) + (bank.cash_utilization || 0)) * 0.9, currency, amountUnit)}</td>
                            <td className="py-1 text-right font-black text-[#15803d] text-[12.5px] bg-[#dcfce7] px-1">{formatCurrencyCompact(bank.available_limit, currency, amountUnit)}</td>
                          </tr>
                          <tr title="LC facility utilization">
                            <td className="py-1 font-bold text-[#475569]">LC</td>
                            <td className="py-1 text-right font-semibold text-[#64748b] px-1">{formatCurrencyCompact(bank.interchangeability_limit, currency, amountUnit)}</td>
                            <td className="py-1 text-right font-semibold text-[#475569] px-1">{formatCurrencyCompact(bank.used_limit || 0, currency, amountUnit)}</td>
                            <td className="py-1 text-right font-bold text-[#16a34a] text-[10.5px] bg-[#dcfce7] px-1">{formatCurrencyCompact(bank.available_limit, currency, amountUnit)}</td>
                          </tr>
                          <tr title="Interchangeable facility (SBLC + Cash) net of 10% margin">
                            <td 
                              className="py-1 font-bold text-[#475569] cursor-pointer hover:text-[#1d4ed8] flex items-center gap-0.5"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsInterchangeableExpanded(!isInterchangeableExpanded);
                              }}
                            >
                              Interchangeable
                              <span className="text-[9px] font-black">{isInterchangeableExpanded ? '−' : '+'}</span>
                            </td>
                            <td className="py-1 text-right font-semibold text-[#64748b] px-1">{formatCurrencyCompact(bank.interchangeability_limit, currency, amountUnit)}</td>
                            <td className="py-1 text-right font-semibold text-[#1d4ed8] px-1">{formatCurrencyCompact(((bank.sblc_utilization || 0) + (bank.cash_utilization || 0)) * 0.9, currency, amountUnit)}</td>
                            <td className="py-1 text-right font-bold text-[#16a34a] text-[10.5px] bg-[#dcfce7] px-1 rounded-b">{formatCurrencyCompact(bank.available_limit, currency, amountUnit)}</td>
                          </tr>
                          {isInterchangeableExpanded && (
                            <>
                              <tr className="bg-white/50" title="Standby Letter of Credit usage (net of 10% margin)">
                                <td className="py-0.5 pl-3 font-medium text-[#64748b]">SBLC</td>
                                <td className="py-0.5 text-right text-[#94a3b8] px-1">—</td>
                                <td className="py-0.5 text-right font-medium text-[#475569] px-1">{formatCurrencyCompact((bank.sblc_utilization || 0) * 0.9, currency, amountUnit)}</td>
                                <td className="py-0.5 text-right px-1">—</td>
                              </tr>
                              <tr className="bg-white/50" title="Cash credit or other fungible components (net of 10% margin)">
                                <td className="py-0.5 pl-3 font-medium text-[#64748b]">Cash</td>
                                <td className="py-0.5 text-right text-[#94a3b8] px-1">—</td>
                                <td className="py-0.5 text-right font-medium text-[#475569] px-1">{formatCurrencyCompact((bank.cash_utilization || 0) * 0.9, currency, amountUnit)}</td>
                                <td className="py-0.5 text-right px-1">—</td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                  </div>
                )}

                <div className="w-full bg-[#f1f5f9] h-1 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${status.bar}`}
                    style={{ width: `${Math.min(bank.utilization_pct || 0, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* ── [ACTION CENTER ELEMENT] Alert Banner ── */}
        {criticalActions.length > 0 ? (
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-[8px] px-4 py-2 flex items-center gap-3">
            <AlertTriangle className="w-3.5 h-3.5 text-[#dc2626] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#991b1b]">
                {criticalActions.length} item{criticalActions.length > 1 ? 's require' : ' requires'} attention
              </p>
            </div>
            <button 
              onClick={() => {
                window.location.href = window.location.pathname + '?view=risk';
              }}
              className="text-[11px] font-bold text-[#dc2626] flex items-center gap-1 flex-shrink-0 hover:text-[#991b1b] transition-colors"
            >
              View <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[8px] px-4 py-1.5 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16a34a] flex-shrink-0" />
            <span className="text-[12px] font-medium text-[#166534]">Treasury in good standing.</span>
          </div>
        )}

        {/* ── [ACTION CENTER ELEMENT] KPI Strip ── */}
        <div className="bg-white border border-[#e2e8f0] rounded-[10px] px-4 py-3 flex flex-wrap gap-4 items-center shadow-sm">
          <Metric
            label="Utilized"
            value={formatPercent(overallPct)}
            sub={`of ${formatCurrencyCompact(summary.total_limit, currency, amountUnit)}`}
            valueColor={utilColor}
            formula="Utilization % = (Total Used / Total Limit) * 100"
          />
          <Divider />
          <Metric
            label="Headroom"
            value={formatCurrencyCompact(summary.total_available, currency, amountUnit)}
            sub="Ready"
            valueColor={overallPct > 90 ? '#dc2626' : overallPct > 75 ? '#d97706' : '#0f172a'}
            formula="Headroom = Total Limit - Current Utilization"
          />
          <Divider />
          <Metric
            label="Interchangeable"
            value={formatCurrencyCompact((summary.total_sblc || 0) * 0.9, currency, amountUnit)}
            sub="Exposure"
            valueColor="#1d4ed8"
            formula="Total (SBLC + Cash) usage net of 10% margin"
          />
          <Divider />
          <Metric
            label="Overdue"
            value={cmdSummary.overdue_count > 0 ? formatCurrencyCompact(cmdSummary.overdue_amount, currency, amountUnit) : '—'}
            sub={cmdSummary.overdue_count > 0 ? `${cmdSummary.overdue_count} LCs` : 'None ✓'}
            valueColor={cmdSummary.overdue_count > 0 ? '#dc2626' : '#16a34a'}
            formula="Sum of all Bills of Entry where Payment Date < Current Date"
          />
          <Divider />
          <Metric
            label="Frozen"
            value={formatCurrencyCompact(cmdSummary.working_capital_frozen || 0, currency, amountUnit)}
            sub="Margin FDs"
            formula="Working Capital tied up in Margin Fixed Deposits against LCs"
          />
        </div>

        {/* ── Main Data Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          
          {/* BOE Pipeline Table (Bifurcated by Bank) */}
          <div className="bg-white border border-[#e2e8f0] rounded-[10px] shadow-sm overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 border-b flex items-center justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-[#0f172a]">BOE Pipeline Compliance</h3>
                <p className="text-[10px] text-[#64748b]">Operational tracking of Bill of Entry submission</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-[#64748b] bg-[#f8fafc] z-10">Payment</th>
                    <th className="px-3 py-2 text-left font-bold text-[#64748b] border-r border-[#e2e8f0] bg-[#f8fafc] z-10">BOE Status</th>
                    <th className="px-3 py-2 text-right font-bold text-[#0f172a] bg-slate-100">Total</th>
                    {sortedCmdBanksList.map((bank: string) => (
                      <th key={bank} className="px-3 py-2 text-right font-bold text-[#64748b] min-w-[80px]">{bank}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {[...boe_status_bank_pivot].sort((a: any, b: any) =>
                    b.boe_status.localeCompare(a.boe_status) || b.payment_status.localeCompare(a.payment_status)
                  ).map((row: any, i: number) => {
                    const rowTotal = sortedCmdBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                    const statusKey = `${row.boe_status} & ${row.payment_status}`
                    return (
                      <tr key={i} className="hover:bg-[#f8fafc] transition-colors group">
                        <td className="px-3 py-2 font-medium text-[#475569] bg-white group-hover:bg-[#f8fafc] z-10 whitespace-nowrap">
                          {toProperCase(row.payment_status)}
                        </td>
                        <td className="px-3 py-2 flex items-center gap-1.5 border-r border-[#e2e8f0] bg-white group-hover:bg-[#f8fafc] z-10 whitespace-nowrap">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: BOE_COLOR_MAP[statusKey] || '#6b7280' }} />
                          <span className="font-medium text-[#0f172a]">{toProperCase(row.boe_status)}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[#1d4ed8] bg-slate-50">
                          {formatCurrencyCompact(rowTotal, currency, amountUnit)}
                        </td>
                        {sortedCmdBanksList.map((bank: string) => (
                          <td key={bank} className="px-3 py-2 text-right font-semibold text-[#475569]">
                            {row[bank] > 0 ? formatCurrencyCompact(row[bank], currency, amountUnit) : '—'}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-[#e2e8f0]">
                    <td colSpan={2} className="px-3 py-2 text-left text-[#0f172a] border-r border-[#e2e8f0] sticky left-0 bg-slate-100 z-10 uppercase text-[9px]">Total</td>
                    <td className="px-3 py-2 text-right text-[#1d4ed8] text-[11px]">
                      {formatCurrencyCompact(boe_status_bank_pivot.reduce((acc: number, row: any) => acc + sortedCmdBanksList.reduce((acc2: number, b: string) => acc2 + (row[b] || 0), 0), 0), currency, amountUnit)}
                    </td>
                    {sortedCmdBanksList.map((bank: string) => {
                      const colTotal = boe_status_bank_pivot.reduce((acc: number, row: any) => acc + (row[bank] || 0), 0)
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
              </div>
              <div className="flex items-center gap-0.5 bg-white border border-[#e2e8f0] rounded-lg p-0.5 shadow-sm">
                {(['Unpaid', 'Paid'] as const).map((s) => (
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
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="px-4 py-2 text-left font-bold text-[#64748b] border-r border-[#e2e8f0] sticky left-0 bg-[#f8fafc] z-10">Product Type</th>
                    <th className="px-4 py-2 text-right font-bold text-[#0f172a] bg-slate-100">Total</th>
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
                          className="bg-slate-50/50 hover:bg-slate-100 transition-colors cursor-pointer group"
                          onClick={() => toggleType(type)}
                        >
                          <td className="px-4 py-2 border-r border-[#e2e8f0] sticky left-0 bg-slate-50 group-hover:bg-slate-100 z-10">
                            <div className="flex items-center gap-1.5">
                              <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                              <span className="font-black text-[#0f172a] tracking-wide">{type}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-black text-[#1d4ed8] bg-slate-100/50">
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
                            <tr key={`${type}-${i}`} className="hover:bg-[#f8fafc] transition-colors group">
                              <td className="px-6 py-1.5 font-medium text-[#475569] border-r border-[#e2e8f0] sticky left-0 bg-white group-hover:bg-[#f8fafc] z-10 truncate max-w-[180px]" title={row.product}>
                                {row.product}
                              </td>
                              <td className="px-4 py-1.5 text-right font-bold text-[#64748b] bg-slate-50/30">
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
            <div className="px-4 py-1.5 border-b flex items-center justify-between bg-slate-50">
              <h3 className="text-[12px] font-bold text-[#0f172a]">Margin-wise BOE</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="px-3 py-1.5 text-left font-bold text-[#64748b] border-r border-[#e2e8f0] sticky left-0 bg-[#f8fafc] z-10">Margin</th>
                    <th className="px-3 py-1.5 text-right font-bold text-[#0f172a] bg-slate-100">Total</th>
                    {sortedBanksList.map((bank: string) => (
                      <th key={bank} className="px-3 py-1.5 text-right font-bold text-[#64748b] min-w-[100px]">{bank}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {(utilData.boe_margin_pivot || []).map((row: any, i: number) => {
                    const rowTotal = sortedBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                    return (
                      <tr key={i} className="hover:bg-[#f8fafc] transition-colors group">
                        <td className="px-3 py-1.5 font-bold text-[#0f172a] border-r border-[#e2e8f0] sticky left-0 bg-white group-hover:bg-[#f8fafc] z-10">
                          {row.margin}%
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-[#0f172a] bg-slate-50">
                          {formatCurrencyCompact(rowTotal, currency, amountUnit)}
                        </td>
                        {sortedBanksList.map((bank: string) => (
                          <td key={bank} className="px-3 py-1.5 text-right text-[#475569]">
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

      </div>
    </div>
  )
}

export default LimitUtilization
