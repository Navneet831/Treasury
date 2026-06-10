// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react'
import { useStore } from '../../store'
import { formatCurrencyCompact } from '../../utils'
import { Globe, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
const API_BASE = isDev ? 'http://127.0.0.1:8001/api/v1' : '/api/v1'

const CURRENCY_COLORS: Record<string, string> = {
  USD: '#3b82f6',
  EUR: '#8b5cf6',
  AED: '#10b981',
  CNY: '#ef4444',
  GBP: '#f59e0b',
  JPY: '#ec4899',
  SGD: '#06b6d4',
}

const FXExposure: React.FC = () => {
  const { fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [scenario, setScenario] = useState(1)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/fx-exposure?fy=${fy}`)
      const result = await res.json()
      setData(result)
    } catch (e) {
      console.error('FX exposure error:', e)
    } finally {
      setLoading(false)
    }
  }, [fy])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const breakdown = data.breakdown?.filter((b: any) => b.currency !== 'INR') || []
  const pieData = breakdown.map((b: any) => ({
    name: b.currency,
    value: b.exposure_inr || 0
  }))

  const impactAmount = data.total_fc_exposure_inr * (scenario / 100)

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            FX Exposure Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">Currency-wise open exposure and INR depreciation impact analysis</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-bold hover:bg-muted transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Total FC Exposure (INR)</p>
          <p className="text-3xl font-black">{formatCurrencyCompact(data.total_fc_exposure_inr, 'INR')}</p>
          <p className="text-xs text-muted-foreground mt-2">Across all foreign currencies</p>
        </div>
        <div className="bg-orange-50 border-orange-200 border p-6 rounded-xl shadow-sm">
          <p className="text-xs font-bold text-orange-700 uppercase tracking-wider mb-2">1% Depreciation Impact</p>
          <p className="text-3xl font-black text-orange-900">{formatCurrencyCompact(data.var_1pct_depreciation, 'INR')}</p>
          <p className="text-xs text-orange-600 mt-2">If INR weakens by 1% today</p>
        </div>
        <div className="bg-red-50 border-red-200 border p-6 rounded-xl shadow-sm">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">5% Depreciation Impact</p>
          <p className="text-3xl font-black text-red-900">{formatCurrencyCompact(data.var_5pct_depreciation, 'INR')}</p>
          <p className="text-xs text-red-600 mt-2">Moderate INR stress scenario</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Currency Breakdown Chart */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Exposure by Currency (INR equivalent)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={breakdown} layout="vertical" margin={{ left: 40, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => formatCurrencyCompact(v, 'INR')} tick={{ fontSize: 10 }} />
                <YAxis dataKey="currency" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <Tooltip
                  formatter={(val: any, _name: any) => [formatCurrencyCompact(val, 'INR'), 'INR Exposure']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="exposure_inr" radius={[0, 4, 4, 0]} barSize={24}>
                  {breakdown.map((b: any, i: number) => (
                    <Cell key={i} fill={CURRENCY_COLORS[b.currency] || '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Currency Concentration</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry: any, i: number) => (
                    <Cell key={i} fill={CURRENCY_COLORS[entry.name] || '#6366f1'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => formatCurrencyCompact(v, 'INR')} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Depreciation Stress Simulator */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">INR Depreciation Stress Simulator</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-6">Slide to simulate: if INR depreciates by X%, additional outflow required</p>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold w-12">1%</span>
            <input
              type="range"
              min={1}
              max={20}
              value={scenario}
              onChange={(e) => setScenario(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-sm font-bold w-12 text-right">{scenario}%</span>
          </div>

          <div className={`p-5 rounded-xl border ${scenario > 10 ? 'bg-red-50 border-red-200' : scenario > 5 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
            <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${scenario > 10 ? 'text-red-700' : scenario > 5 ? 'text-orange-700' : 'text-blue-700'}`}>
              At {scenario}% INR depreciation — additional INR outflow
            </p>
            <p className={`text-4xl font-black ${scenario > 10 ? 'text-red-900' : scenario > 5 ? 'text-orange-900' : 'text-blue-900'}`}>
              {formatCurrencyCompact(impactAmount, 'INR')}
            </p>
          </div>
        </div>
      </div>

      {/* Currency Details Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Currency Exposure Detail</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Currency</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">LC Count</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">FC Amount</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">INR Equivalent</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Avg Rate</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">1% Impact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted/30">
            {breakdown.map((b: any, i: number) => (
              <tr key={i} className="hover:bg-muted/10 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CURRENCY_COLORS[b.currency] || '#6366f1' }} />
                    <span className="font-black text-base">{b.currency}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right">{b.lc_count}</td>
                <td className="px-5 py-3 text-right font-bold">{b.exposure_fc?.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                <td className="px-5 py-3 text-right font-black">{formatCurrencyCompact(b.exposure_inr, 'INR')}</td>
                <td className="px-5 py-3 text-right text-muted-foreground">{b.avg_rate?.toFixed(2) || '—'}</td>
                <td className="px-5 py-3 text-right text-orange-600 font-bold">{formatCurrencyCompact(b.depreciation_1pct_impact, 'INR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default FXExposure
