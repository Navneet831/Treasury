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
}> = ({ label, value, sub, valueColor = '#0f172a' }) => (
  <div className="flex flex-col min-w-0">
    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#64748b] mb-1.5">{label}</span>
    <span className="text-[19px] font-semibold tracking-tight leading-none mb-1 truncate" style={{ color: valueColor }}>
      {value}
    </span>
    {sub && <span className="text-[11px] text-[#94a3b8] truncate">{sub}</span>}
  </div>
)

const LimitUtilization: React.FC = () => {
  const { currency, fy } = useStore()
  const [utilData, setUtilData] = useState<any>(null)
  const [cmdData, setCmdData] = useState<any>(null)
  const [actions, setActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [util, cmd, acts] = await Promise.all([
        getLimitUtilisation(currency, fy),
        getCommandData(currency, fy),
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
  }, [currency, fy])

  useEffect(() => { fetchData() }, [fetchData])

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

  const { bank_utilization: banks = [], portfolio_summary: summary = {}, margin_bank_pivot = [], banks_list = [] } = utilData
  const {
    summary: cmdSummary = {},
    boe_status_wise = [],
    product_unpaid_pivot = [],
    currencies_list = [],
    boe_status_bank_pivot = [],
    banks_list: cmdBanksList = []
  } = cmdData

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
    <div className="bg-[#f8fafc] min-h-screen p-6 md:p-8 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-5">
        
        {/* ── Page Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-semibold text-[#0f172a] tracking-tight">Limit Utilization Monitor</h1>
            <p className="text-[13px] text-[#64748b] mt-0.5">
              Consolidated bank-wise LC & SBLC facility usage with Interchangeability limits
            </p>
          </div>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-1.5 border bg-white rounded-lg text-xs font-bold hover:bg-[#f1f5f9] transition-colors shadow-sm">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* ── [TOP ELEMENT] Bank Quick Cards (Three-Column Focus) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {banks.map((bank: any, idx: number) => {
            const status = getStatusColor(bank.utilization_pct)
            return (
              <div key={idx} className="bg-white border border-[#e2e8f0] rounded-[10px] p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-[14px] text-[#0f172a] truncate">{bank.bank}</h3>
                  <span className={`text-[10px] font-black uppercase ${status.text}`}>{formatPercent(bank.utilization_pct)}</span>
                </div>

                {/* 3x3 Data Grid: Total, LC, SBLC */}
                <div className="bg-[#f8fafc] rounded-lg border border-[#f1f5f9] p-2 mb-3">
                  <table className="w-full text-[9.5px]">
                    <thead>
                      <tr className="text-[#64748b] border-b border-[#e2e8f0]">
                        <th className="pb-1.5 text-left font-bold uppercase tracking-wider">Facility</th>
                        <th className="pb-1.5 text-right font-bold uppercase tracking-wider">Limit</th>
                        <th className="pb-1.5 text-right font-bold uppercase tracking-wider">Utilized</th>
                        <th className="pb-1.5 text-right font-black uppercase tracking-wider text-[#166534] bg-[#dcfce7] px-2 rounded-t">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      <tr>
                        <td className="py-1.5 font-black text-[#0f172a]">Total</td>
                        <td className="py-1.5 text-right font-bold text-[#0f172a]">{formatCurrencyCompact(bank.interchangeability_limit, currency)}</td>
                        <td className="py-1.5 text-right font-bold text-[#0f172a]">{formatCurrencyCompact((bank.used_limit || 0) + (bank.sblc_utilization || 0), currency)}</td>
                        <td className="py-1.5 text-right font-black text-[#15803d] text-[13px] bg-[#dcfce7] px-2">{formatCurrencyCompact(bank.available_limit, currency)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-bold text-[#475569]">LC</td>
                        <td className="py-1.5 text-right font-semibold text-[#64748b]">{formatCurrencyCompact(bank.interchangeability_limit, currency)}</td>
                        <td className="py-1.5 text-right font-semibold text-[#475569]">{formatCurrencyCompact(bank.used_limit || 0, currency)}</td>
                        <td className="py-1.5 text-right font-bold text-[#16a34a] text-[11px] bg-[#dcfce7] px-2">{formatCurrencyCompact(bank.available_limit, currency)}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 font-bold text-[#475569]">SBLC</td>
                        <td className="py-1.5 text-right font-semibold text-[#64748b]">{formatCurrencyCompact(bank.interchangeability_limit, currency)}</td>
                        <td className="py-1.5 text-right font-semibold text-[#1d4ed8]">{formatCurrencyCompact(bank.sblc_utilization || 0, currency)}</td>
                        <td className="py-1.5 text-right font-bold text-[#16a34a] text-[11px] bg-[#dcfce7] px-2 rounded-b">{formatCurrencyCompact(bank.available_limit, currency)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="w-full bg-[#f1f5f9] h-1.5 rounded-full overflow-hidden mt-auto">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${status.bar}`}
                    style={{ width: `${Math.min(bank.utilization_pct || 0, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* ── [ACTION CENTER ELEMENT] Critical Alert Banner ── */}
        {criticalActions.length > 0 ? (
          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-[10px] px-5 py-3.5 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-[#dc2626] mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#991b1b]">
                {criticalActions.length} item{criticalActions.length > 1 ? 's require' : ' requires'} immediate attention
              </p>
              <p className="text-[12px] text-[#b91c1c] mt-0.5 leading-relaxed">
                {criticalActions[0]?.message}
                {criticalActions.length > 1 && ` · +${criticalActions.length - 1} more`}
              </p>
            </div>
            <button className="text-[12px] font-bold text-[#dc2626] flex items-center gap-1 flex-shrink-0 hover:text-[#991b1b] transition-colors">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="bg-[#f0fdf4] border border-[#bbf7d0] rounded-[10px] px-5 py-3 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#16a34a] flex-shrink-0" />
            <span className="text-[13px] font-medium text-[#166534]">No critical alerts at this time. Treasury in good standing.</span>
          </div>
        )}

        {/* ── [ACTION CENTER ELEMENT] KPI Strip ── */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] px-6 py-5 flex flex-wrap gap-6 items-center shadow-sm">
          <Metric
            label="Portfolio Utilized"
            value={formatPercent(overallPct)}
            sub={`of ${formatCurrencyCompact(summary.total_limit, currency)} Total`}
            valueColor={utilColor}
          />
          <Divider />
          <Metric
            label="Available Headroom"
            value={formatCurrencyCompact(summary.total_available, currency)}
            sub="Ready to deploy"
            valueColor={overallPct > 90 ? '#dc2626' : overallPct > 75 ? '#d97706' : '#0f172a'}
          />
          <Divider />
          <Metric
            label="SBLC Outstanding"
            value={formatCurrencyCompact(summary.total_sblc || 0, currency)}
            sub="Interchangeability Usage"
            valueColor="#1d4ed8"
          />
          <Divider />
          <Metric
            label="Overdue Payments"
            value={cmdSummary.overdue_count > 0 ? formatCurrencyCompact(cmdSummary.overdue_amount, currency) : '—'}
            sub={cmdSummary.overdue_count > 0 ? `${cmdSummary.overdue_count} LC overdues` : 'No overdues ✓'}
            valueColor={cmdSummary.overdue_count > 0 ? '#dc2626' : '#16a34a'}
          />
          <Divider />
          <Metric
            label="Frozen Capital"
            value={formatCurrencyCompact(cmdSummary.working_capital_frozen || 0, currency)}
            sub="In Margin FDs"
          />
        </div>

        {/* ── Main Data Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* BOE Pipeline Table (Bifurcated by Bank) */}
          <div className="bg-white border border-[#e2e8f0] rounded-[12px] shadow-sm overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-[#0f172a]">BOE Pipeline Compliance</h3>
                <p className="text-[11px] text-[#64748b]">Operational tracking of Bill of Entry submission (Bank-wise amounts)</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-[#64748b] uppercase bg-[#f8fafc] z-10">BOE Status</th>
                    <th className="px-4 py-3 text-left font-bold text-[#64748b] uppercase border-r border-[#e2e8f0] bg-[#f8fafc] z-10">Payment Status</th>
                    {cmdBanksList.map((bank: string) => (
                      <th key={bank} className="px-4 py-3 text-right font-bold text-[#64748b] uppercase min-w-[90px]">{bank}</th>
                    ))}
                    <th className="px-4 py-3 text-right font-bold text-[#0f172a] uppercase bg-slate-100">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {boe_status_bank_pivot.map((row: any, i: number) => {
                    const rowTotal = cmdBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                    const statusKey = `${row.boe_status} & ${row.payment_status}`
                    return (
                      <tr key={i} className="hover:bg-[#f8fafc] transition-colors group">
                        <td className="px-4 py-3 flex items-center gap-2 bg-white group-hover:bg-[#f8fafc] z-10 whitespace-nowrap">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BOE_COLOR_MAP[statusKey] || '#6b7280' }} />
                          <span className="font-medium text-[#0f172a]">{row.boe_status}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[#475569] border-r border-[#e2e8f0] bg-white group-hover:bg-[#f8fafc] z-10 whitespace-nowrap">
                          {row.payment_status}
                        </td>
                        {cmdBanksList.map((bank: string) => (
                          <td key={bank} className="px-4 py-3 text-right font-semibold text-[#475569]">
                            {row[bank] > 0 ? formatCurrencyCompact(row[bank], currency) : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-bold text-[#1d4ed8] bg-slate-50">
                          {formatCurrencyCompact(rowTotal, currency)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-[#e2e8f0]">
                    <td colSpan={2} className="px-4 py-3 text-left uppercase text-[#0f172a] border-r border-[#e2e8f0] sticky left-0 bg-slate-100 z-10">Grand Total</td>
                    {cmdBanksList.map((bank: string) => {
                      const colTotal = boe_status_bank_pivot.reduce((acc: number, row: any) => acc + (row[bank] || 0), 0)
                      return (
                        <td key={bank} className="px-4 py-3 text-right text-[#0f172a]">
                          {formatCurrencyCompact(colTotal, currency)}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right text-[#1d4ed8] text-[13px]">
                      {formatCurrencyCompact(boe_status_bank_pivot.reduce((acc: number, row: any) => acc + cmdBanksList.reduce((acc2: number, b: string) => acc2 + (row[b] || 0), 0), 0), currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>

            </div>
          </div>

          {/* Product-wise Unpaid Bills Pivot Table */}
          <div className="bg-white border border-[#e2e8f0] rounded-[12px] shadow-sm overflow-hidden flex flex-col mt-5">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-[#0f172a]">Product-wise BOE Unpaid</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold text-[#64748b] uppercase border-r border-[#e2e8f0] sticky left-0 bg-[#f8fafc] z-10">Product Name</th>
                    {cmdBanksList.map((bank: string) => (
                      <th key={bank} className="px-5 py-3 text-right font-bold text-[#64748b] uppercase min-w-[90px]">{bank}</th>
                    ))}
                    <th className="px-5 py-3 text-right font-bold text-[#0f172a] uppercase bg-slate-100">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {product_unpaid_pivot.map((row: any, i: number) => {
                    const rowTotal = cmdBanksList.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                    return (
                      <tr key={i} className="hover:bg-[#f8fafc] transition-colors group">
                        <td className="px-5 py-3 font-bold text-[#0f172a] border-r border-[#e2e8f0] sticky left-0 bg-white group-hover:bg-[#f8fafc] z-10 truncate max-w-[200px]" title={row.product}>{row.product}</td>
                        {cmdBanksList.map((bank: string) => (
                          <td key={bank} className="px-5 py-3 text-right font-semibold text-[#475569]">
                            {row[bank] > 0 ? formatCurrencyCompact(row[bank], currency) : '—'}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-right font-bold text-[#1d4ed8] bg-slate-50">
                          {formatCurrencyCompact(rowTotal, currency)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* BOE Margin-wise × Bank-wise Pivot Table */}
          <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-[12px] shadow-sm overflow-hidden flex flex-col mt-5">
            <div className="px-5 py-4 border-b flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-[14px] font-bold text-[#0f172a]">Margin-wise BOE Unpaid</h3>
              </div>
              <FileText className="w-4 h-4 text-[#1d4ed8]" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    <th className="px-4 py-3 text-left font-bold text-[#64748b] uppercase border-r border-[#e2e8f0] sticky left-0 bg-[#f8fafc] z-10">Margin %</th>
                    {banks_list.map((bank: string) => (
                      <th key={bank} className="px-4 py-3 text-right font-bold text-[#64748b] uppercase min-w-[120px]">{bank}</th>
                    ))}
                    <th className="px-4 py-3 text-right font-bold text-[#0f172a] uppercase bg-slate-100">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {(utilData.boe_margin_pivot || []).map((row: any, i: number) => {
                    const rowTotal = banks_list.reduce((acc: number, b: string) => acc + (row[b] || 0), 0)
                    return (
                      <tr key={i} className="hover:bg-[#f8fafc] transition-colors group">
                        <td className="px-4 py-3 font-bold text-[#0f172a] border-r border-[#e2e8f0] sticky left-0 bg-white group-hover:bg-[#f8fafc] z-10">
                          {row.margin}%
                        </td>
                        {banks_list.map((bank: string) => (
                          <td key={bank} className="px-4 py-3 text-right text-[#475569]">
                            {row[bank] > 0 ? formatCurrencyCompact(row[bank], currency) : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-bold text-[#0f172a] bg-slate-50">
                          {formatCurrencyCompact(rowTotal, currency)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

export default LimitUtilization
