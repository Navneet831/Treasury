// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { getCommandData, getTreasuryActions } from '../api'
import { useStore } from '../store'
import { formatCurrencyCompact, formatPercent } from '../utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import { AlertTriangle, Shield, ChevronRight, CheckCircle2 } from 'lucide-react'

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

const Divider = () => <div className="w-px h-10 bg-[#e2e8f0] flex-shrink-0" />

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

const TreasuryCommand: React.FC = () => {
  const { currency, fy, amountUnit } = useStore()
  const [data, setData] = useState<any>(null)
  const [actions, setActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([getCommandData(currency, fy), getTreasuryActions()])
      .then(([cmd, acts]) => {
        setData(cmd)
        setActions(Array.isArray(acts) ? acts : [])
      })
      .catch((e) => console.error('Command data error', e))
      .finally(() => setLoading(false))
  }, [currency, fy])

  if (loading) {
    return (
      <div className="p-8 space-y-5 animate-pulse bg-[#f8fafc] min-h-screen">
        <div className="h-9 w-72 bg-[#e2e8f0] rounded-lg" />
        <div className="h-12 bg-[#e2e8f0] rounded-xl" />
        <div className="h-24 bg-[#e2e8f0] rounded-xl" />
        <div className="h-[360px] bg-[#e2e8f0] rounded-xl" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-[#64748b] bg-[#f8fafc] min-h-screen">
        No data available. Verify the backend connection.
      </div>
    )
  }

  const {
    summary = {},
    bank_wise = [],
    margin_wise = [],
    boe_status_wise = [],
    hedging_wise = [],
    bank_limit_summary = [],
  } = data

  const criticalActions = actions.filter((a: any) => Number(a.priority) <= 2)
  const utilPct = summary.limit_utilization_pct || 0
  const utilColor = getUtilColor(utilPct)
  const headroomPct = summary.total_nfb_limit > 0
    ? summary.available_balance / summary.total_nfb_limit
    : 1

  const totalHedged = hedging_wise.find((h: any) => h.type === 'Hedged')?.value || 0
  const totalUnhedged = hedging_wise.find((h: any) => h.type === 'Unhedged')?.value || 0
  const totalHedgeable = totalHedged + totalUnhedged
  const hedgePct = totalHedgeable > 0 ? (totalHedged / totalHedgeable * 100) : 0
  const unhedgedPct = 100 - hedgePct

  return (
    <div className="bg-[#f8fafc] min-h-screen p-6 md:p-8 font-sans">
      <div className="max-w-[1440px] mx-auto space-y-5">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-semibold text-[#0f172a] tracking-tight">Treasury Command</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-[13px] text-[#64748b]">
                Consolidated liquidity &amp; limit intelligence · FY {fy === 'All' ? 'All Years' : fy}
              </p>
              <span className="text-[11px] font-bold text-[#64748b] bg-white px-2 py-1 rounded border border-[#e2e8f0] shadow-sm">
                Amount in Cr
              </span>
            </div>
          </div>
          {criticalActions.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#fef2f2] border border-[#fecaca] rounded-full px-3 py-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#dc2626] animate-pulse" />
              <span className="text-[12px] font-bold text-[#dc2626]">
                {criticalActions.length} Critical Action{criticalActions.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* ── Critical Alert Banner ── */}
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

        {/* ── KPI Strip — CFO Priority Order ── */}
        <div className="bg-white border border-[#e2e8f0] rounded-[12px] px-6 py-5 flex flex-wrap gap-6 items-center shadow-sm">
          {/* 1. Utilization — most critical single number */}
          <Metric
            label="Limit Utilized"
            value={formatPercent(utilPct)}
            sub={`of ${formatCurrencyCompact(summary.total_nfb_limit, currency, amountUnit)} NFB`}
            valueColor={utilColor}
            formula="Utilization % = (Total NFB Used / Total NFB Limit) * 100"
          />
          <Divider />
          {/* 2. Headroom */}
          <Metric
            label="Available Headroom"
            value={formatCurrencyCompact(summary.available_balance, currency, amountUnit)}
            sub="Ready to deploy"
            valueColor={headroomPct < 0.1 ? '#dc2626' : headroomPct < 0.2 ? '#d97706' : '#0f172a'}
            formula="Headroom = Total NFB Limit - Current NFB Utilization"
          />
          <Divider />
          {/* 3. Overdue — ACTION REQUIRED */}
          <Metric
            label="Overdue Payments"
            value={summary.overdue_count > 0
              ? formatCurrencyCompact(summary.overdue_amount, currency, amountUnit)
              : '—'}
            sub={summary.overdue_count > 0
              ? `${summary.overdue_count} LC${summary.overdue_count > 1 ? 's' : ''} past due date`
              : 'No overdues ✓'}
            valueColor={summary.overdue_count > 0 ? '#dc2626' : '#16a34a'}
            formula="Sum of all Bills of Entry where Payment Due Date has passed"
          />
          <Divider />
          {/* 4. Due this week */}
          <Metric
            label="Due in 7 Days"
            value={summary.due_7d_count > 0
              ? formatCurrencyCompact(summary.due_7d_amount, currency, amountUnit)
              : '—'}
            sub={summary.due_7d_count > 0
              ? `${summary.due_7d_count} payment${summary.due_7d_count > 1 ? 's' : ''} pending`
              : 'Clear this week'}
            valueColor={summary.due_7d_count > 0 ? '#d97706' : '#64748b'}
            formula="Aggregate amount of LC/BOE payments scheduled within next 7 days"
          />
          <Divider />
          {/* 5. Frozen capital */}
          <Metric
            label="Frozen Capital"
            value={formatCurrencyCompact(summary.working_capital_frozen, currency, amountUnit)}
            sub="Locked in Margin FDs"
            formula="Working capital blocked as Margin in Fixed Deposits against LC facilities"
          />
          <Divider />
          {/* 6. SBLC */}
          <Metric
            label="SBLC Portfolio"
            value={formatCurrencyCompact(summary.sblc_outstanding, currency, amountUnit)}
            sub={summary.lc_in_process > 0
              ? `${formatCurrencyCompact(summary.lc_in_process, currency, amountUnit)} in process`
              : 'Standby exposure'}
            formula="Total exposure of active Standby Letters of Credit"
          />
        </div>

        {/* ── Main Grid: Charts & Lists ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Bank Wise List — "show all banks one below another" */}
          <div className="lg:col-span-2 bg-white border border-[#e2e8f0] rounded-[12px] p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-[16px] font-bold text-[#0f172a]">Bank-wise Limits & Exposure</h2>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">Consolidated view of NFB limits and utilization</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#f1f5f9]">
                    <th className="py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Bank</th>
                    <th className="py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748b] text-right">Total Limit</th>
                    <th className="py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748b] text-right">LC Utilized</th>
                    <th className="py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748b] text-right">SBLC</th>
                    <th className="py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748b] text-right">Available</th>
                    <th className="py-3 text-[10px] font-bold uppercase tracking-wider text-[#64748b] text-right">Util %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {bank_limit_summary.map((b: any, idx: number) => (
                    <tr key={idx} className="hover:bg-[#f8fafc] transition-colors group">
                      <td className="py-4">
                        <span className="text-[13px] font-bold text-[#0f172a] group-hover:text-[#1d4ed8] transition-colors">{b.bank}</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-[13px] font-medium text-[#475569]">{formatCurrencyCompact(b.total_limit, currency, amountUnit)}</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-[13px] font-semibold text-[#1d4ed8]">{formatCurrencyCompact(b.lc_utilized, currency, amountUnit)}</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className="text-[13px] font-medium text-[#64748b]">{formatCurrencyCompact(b.sblc, currency, amountUnit)}</span>
                      </td>
                      <td className="py-4 text-right">
                        <span className={`text-[13px] font-bold ${b.headroom < 10000000 ? 'text-[#dc2626]' : 'text-[#059669]'}`}>
                          {formatCurrencyCompact(b.headroom, currency, amountUnit)}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-[12px] font-bold ${b.utilization_pct > 90 ? 'text-[#dc2626]' : 'text-[#0f172a]'}`}>
                            {b.utilization_pct}%
                          </span>
                          <div className="w-16 h-1 bg-[#f1f5f9] rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${b.utilization_pct > 90 ? 'bg-[#dc2626]' : b.utilization_pct > 70 ? 'bg-[#d97706]' : 'bg-[#16a34a]'}`}
                              style={{ width: `${Math.min(b.utilization_pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5 flex flex-col">
            {/* BOE Compliance — semantic colors */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-[12px] p-5 flex-1 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[14px] font-semibold text-white">BOE Pipeline</h2>
                <span className="text-[11px] text-[#64748b]">Compliance</span>
              </div>
              <p className="text-[11px] text-[#475569] mb-3">
                Green = received &amp; paid · Amber = unpaid · Red = not received
              </p>
              <div className="h-[165px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={boe_status_wise}
                      dataKey="value"
                      nameKey="boe_status"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={66}
                      stroke="none"
                    >
                      {boe_status_wise.map((entry: any, idx: number) => (
                        <Cell
                          key={`boe-${idx}`}
                          fill={BOE_COLOR_MAP[entry.boe_status] ?? '#6b7280'}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: '8px',
                        border: '1px solid #1e293b',
                        backgroundColor: '#0f172a',
                        fontSize: '12px',
                        color: '#fff',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      iconSize={7}
                      wrapperStyle={{ fontSize: '10px', color: '#94a3b8' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Hedge Coverage */}
            <div className="bg-white border border-[#e2e8f0] rounded-[12px] p-5 flex-1 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0f172a]">Hedge Coverage</h3>
                  <p className="text-[11px] text-[#94a3b8] mt-0.5">FX risk management</p>
                </div>
                <Shield className="w-4 h-4 text-[#94a3b8]" />
              </div>

              {/* Big coverage % */}
              <div className="flex items-baseline gap-1.5 mb-4">
                <span
                  className="text-[30px] font-semibold leading-none"
                  style={{ color: hedgePct >= 70 ? '#16a34a' : hedgePct >= 50 ? '#d97706' : '#dc2626' }}
                >
                  {hedgePct.toFixed(1)}%
                </span>
                <span className="text-[13px] text-[#64748b]">hedged</span>
              </div>

              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-[#64748b]">Hedged</span>
                    <span className="font-semibold text-[#16a34a]">{formatCurrencyCompact(totalHedged, currency, amountUnit)}</span>
                  </div>
                  <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#16a34a] rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(hedgePct, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-[#64748b]">Unhedged</span>
                    <span className={`font-semibold ${totalUnhedged > 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                      {formatCurrencyCompact(totalUnhedged, currency, amountUnit)}
                    </span>
                  </div>
                  <div className="w-full bg-[#f1f5f9] h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#dc2626] rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(unhedgedPct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {unhedgedPct > 30 && (
                <div className="mt-3 bg-[#fef2f2] border border-[#fecaca] rounded-lg px-3 py-2 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#dc2626] flex-shrink-0" />
                  <span className="text-[11px] text-[#991b1b] font-medium">
                    Unhedged exceeds 30% policy threshold
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Margin Structure ── */}
        {margin_wise.length > 0 && (
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#64748b] mb-3">
              Margin Structure · Capital tied per bucket
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {margin_wise.slice(0, 4).map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="bg-white border border-[#e2e8f0] rounded-[10px] p-4 shadow-sm hover:border-[#cbd5e1] transition-colors"
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] mb-2">
                    {item.margin_pct}% Margin
                  </p>
                  <p className="text-[22px] font-semibold text-[#0f172a] tracking-tight">
                    {formatCurrencyCompact(item.value, currency, amountUnit)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default TreasuryCommand
