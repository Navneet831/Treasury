// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react'
import { useStore } from '../../store'
import { formatCurrencyCompact, formatPercent } from '../../utils'
import { TrendingUp, RefreshCw } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts'
import { getTrendAnalysis, getCohortAnalysis } from '../../api'

const TrendAnalysis: React.FC = () => {
  const { currency, fy } = useStore()
  const [trendData, setTrendData] = useState<any>(null)
  const [cohortData, setCohortData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'trend' | 'cohort'>('trend')

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [trend, cohort] = await Promise.all([
        getTrendAnalysis(currency, fy),
        getCohortAnalysis(currency, fy),
      ])
      setTrendData(trend)
      setCohortData(Array.isArray(cohort) ? cohort : [])
    } catch (e) {
      console.error('Trend analysis error:', e)
    } finally {
      setLoading(false)
    }
  }, [currency, fy])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="bg-white border rounded-xl h-64 animate-pulse" />
      </div>
    )
  }

  const openingTrend = (trendData?.monthly_opening_trend || []).map((d: any) => ({
    month: String(d.month || '').slice(0, 7),
    opened: d.opened_value,
    closed: d.closed_value,
    net: d.net_exposure,
    count: d.opened_count,
  }))

  const dueTrend = (trendData?.monthly_due_trend || []).map((d: any) => ({
    month: String(d.month || '').slice(0, 7),
    due: d.due_value,
    count: d.due_count,
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border rounded-xl shadow-xl p-4 text-sm">
          <p className="font-bold mb-2">{label}</p>
          {payload.map((p: any, i: number) => (
            <div key={i} className="flex justify-between gap-6 mb-1">
              <span className="text-muted-foreground">{p.name}</span>
              <span className="font-bold" style={{ color: p.color }}>{formatCurrencyCompact(p.value, currency)}</span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            Trend & Cohort Analysis
          </h2>
          <p className="text-sm text-muted-foreground">Monthly LC opening/closure trends and performance cohorts</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-muted p-1 rounded-lg">
            {(['trend', 'cohort'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-md text-sm font-bold capitalize transition-all ${
                  activeTab === tab ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'trend' ? 'Monthly Trend' : 'Cohort Analysis'}
              </button>
            ))}
          </div>
          <button onClick={fetchData} className="p-2 border rounded-lg hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {activeTab === 'trend' && (
        <div className="space-y-8">
          {/* Opening vs Closing Trend */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">
              Monthly LC Opening & Closure Value
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={openingTrend} margin={{ top: 5, right: 30, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCurrencyCompact(v, currency)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={75} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="opened" name="LC Opened" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={16} />
                  <Bar dataKey="closed" name="LC Closed" fill="#94a3b8" radius={[3, 3, 0, 0]} barSize={16} />
                  <Line type="monotone" dataKey="net" name="Net Exposure" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Due Payments Trend */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">
              Monthly Payment Due Trend
            </h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dueTrend} margin={{ top: 5, right: 30, bottom: 5, left: 20 }}>
                  <defs>
                    <linearGradient id="dueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => formatCurrencyCompact(v, currency)} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={75} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="due" name="Due Payments" stroke="#f97316" fill="url(#dueFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cohort' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">LC Performance by Opening Month Cohort</h3>
            <p className="text-xs text-muted-foreground mt-1">Track lifecycle completion rates for each batch of LCs opened in a given month</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Cohort Month</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Total LCs</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Value</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Closed</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Closure Rate</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Paid</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Payment Rate</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Pending BOE</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Avg Age (Days)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/30">
                {cohortData.map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3 font-bold">{String(c.cohort_month || '').slice(0, 7)}</td>
                    <td className="px-5 py-3 text-right">{c.total_lcs}</td>
                    <td className="px-5 py-3 text-right font-bold">{formatCurrencyCompact(c.total_value, currency)}</td>
                    <td className="px-5 py-3 text-right">{c.closed_count}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.closure_rate_pct >= 80 ? 'bg-green-100 text-green-700' :
                        c.closure_rate_pct >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>{formatPercent(c.closure_rate_pct)}</span>
                    </td>
                    <td className="px-5 py-3 text-right">{c.paid_count}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.payment_rate_pct >= 80 ? 'bg-blue-100 text-blue-700' :
                        c.payment_rate_pct >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>{formatPercent(c.payment_rate_pct)}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-orange-600">{formatCurrencyCompact(c.pending_boe_value, 'INR')}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{c.avg_age_days ? Math.round(c.avg_age_days) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default TrendAnalysis
