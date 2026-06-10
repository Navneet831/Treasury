// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react'
import { useStore } from '../../store'
import { formatCurrencyCompact } from '../../utils'
import { RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { getHedgeCoverage } from '../../api'

const HEDGED_COLOR   = '#059669'  // emerald — safe, controlled
const UNHEDGED_COLOR = '#dc2626'  // red — open FX risk

const TYPE_LABEL: Record<string, string> = {
  'Raw Material': 'Raw Material',
  'CAPEX':        'CAPEX',
  'Spares':       'Spares',
  'Unknown':      'Unknown',
}

const HedgeCoverage: React.FC = () => {
  const { currency, fy } = useStore()
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const result = await getHedgeCoverage(currency, fy)
      setData(result)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [currency, fy])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) return (
    <div className="p-6 space-y-4">
      {[120, 90, 72, 60].map((w, i) => (
        <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-lg" style={{ width: `${w}%` }} />
      ))}
    </div>
  )

  if (error || !data) return (
    <div className="p-6 text-sm text-slate-500 italic">Failed to load hedge coverage data.</div>
  )

  const { summary, products } = data
  const chartData = products.map((p: any) => ({
    name: p.product.length > 20 ? p.product.slice(0, 20) + '…' : p.product,
    fullName: p.product,
    hedged:   p.hedge_status === 'Hedged'   ? p.unpaid_inr : 0,
    unhedged: p.hedge_status === 'Unhedged' ? p.unpaid_inr : 0,
    type: p.type,
  }))

  return (
    <div className="p-5 space-y-5 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-[#0f172a] tracking-tight">Hedge Coverage</h2>
          <p className="text-[11px] text-[#64748b] mt-0.5">
            Unpaid bills bifurcated by hedge status — CAPEX: Hedged · Raw Material / Spares: Unhedged
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-1.5 border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] transition-colors text-[#64748b]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Total Unpaid</p>
          <p className="text-xl font-black text-[#0f172a] mt-1">{formatCurrencyCompact(summary.total_unpaid, currency)}</p>
          <p className="text-[10px] text-[#94a3b8] mt-0.5">{products.length} products</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Hedged (CAPEX)</p>
          </div>
          <p className="text-xl font-black text-emerald-900">{formatCurrencyCompact(summary.hedged, currency)}</p>
          <p className="text-[10px] text-emerald-600 mt-0.5">{summary.hedge_pct}% of total</p>
        </div>

        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
            <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest">Unhedged</p>
          </div>
          <p className="text-xl font-black text-red-900">{formatCurrencyCompact(summary.unhedged, currency)}</p>
          <p className="text-[10px] text-red-600 mt-0.5">{summary.unhedged_pct}% exposed</p>
        </div>

        {/* Coverage bar */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 flex flex-col justify-between">
          <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-widest">Coverage Ratio</p>
          <div>
            <div className="flex items-end justify-between mb-1">
              <span className="text-xl font-black text-[#0f172a]">{summary.hedge_pct}%</span>
              <span className="text-[10px] text-[#94a3b8]">hedged</span>
            </div>
            <div className="h-2 rounded-full bg-red-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${summary.hedge_pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stacked bar chart — per product */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-5">
        <h3 className="text-[11px] font-black text-[#64748b] uppercase tracking-widest mb-4">
          Unpaid Exposure by Product
        </h3>
        <div style={{ height: Math.max(260, products.length * 36) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 8, right: 40, top: 4, bottom: 4 }}
              barSize={18}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis
                type="number"
                tickFormatter={(v) => formatCurrencyCompact(v, currency)}
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                dataKey="name"
                type="category"
                width={150}
                tick={{ fontSize: 10, fill: '#334155', fontWeight: 600 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const item = chartData.find((d: any) => d.name === label)
                  return (
                    <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-3 text-[11px]">
                      <p className="font-black text-[#0f172a] mb-2">{item?.fullName ?? label}</p>
                      <p className="text-[#64748b]">Type: <span className="font-bold text-[#0f172a]">{item?.type}</span></p>
                      {payload.map((p: any) => (
                        <p key={p.dataKey} style={{ color: p.fill }} className="font-bold mt-1">
                          {p.name}: {formatCurrencyCompact(p.value, currency)}
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
              />
              <Bar dataKey="hedged"   name="Hedged (CAPEX)"   stackId="a" fill={HEDGED_COLOR}   radius={[0,0,0,0]} />
              <Bar dataKey="unhedged" name="Unhedged"         stackId="a" fill={UNHEDGED_COLOR}  radius={[0,3,3,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Per-product table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#f1f5f9] flex items-center justify-between">
          <span className="text-[11px] font-black text-[#64748b] uppercase tracking-widest">Product-wise Breakdown</span>
          <span className="text-[10px] text-[#94a3b8]">Unpaid bills only · BOE Bill Amt (fallback LC Amt)</span>
        </div>
        <table className="w-full" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '14%' }} />
            <col style={{ width: '8%'  }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr className="bg-[#f8fafc] border-b border-[#f1f5f9]">
              {['Product', 'Type', 'Hedge Status', 'LCs', 'Unpaid (INR)', 'Unpaid (FC)'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[9px] font-black text-[#94a3b8] uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f8fafc]">
            {products.map((p: any, i: number) => {
              const isHedged = p.hedge_status === 'Hedged'
              return (
                <tr key={i} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-[12px] font-semibold text-[#0f172a] block truncate" title={p.product}>
                      {p.product}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-[#64748b]">{TYPE_LABEL[p.type] ?? p.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        background: isHedged ? '#d1fae5' : '#fee2e2',
                        color:      isHedged ? '#065f46' : '#991b1b',
                      }}
                    >
                      {isHedged
                        ? <ShieldCheck className="w-3 h-3" />
                        : <ShieldAlert className="w-3 h-3" />
                      }
                      {p.hedge_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] font-bold text-[#0f172a]">{p.lc_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className="text-[12px] font-black"
                      style={{ color: isHedged ? HEDGED_COLOR : UNHEDGED_COLOR }}
                    >
                      {formatCurrencyCompact(p.unpaid_inr, 'INR')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#64748b] font-semibold">
                    {p.unpaid_fc > 0
                      ? `${p.currency} ${(p.unpaid_fc / 1_000_000).toFixed(2)}M`
                      : '—'
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="bg-[#f8fafc] border-t border-[#e2e8f0]">
              <td className="px-4 py-3 text-[11px] font-black text-[#0f172a]">Total</td>
              <td />
              <td />
              <td className="px-4 py-3 text-[11px] font-black text-[#0f172a]">
                {products.reduce((s: number, p: any) => s + p.lc_count, 0)}
              </td>
              <td className="px-4 py-3">
                <span className="text-[12px] font-black text-[#0f172a]">
                  {formatCurrencyCompact(summary.total_unpaid, 'INR')}
                </span>
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  )
}

export default HedgeCoverage
