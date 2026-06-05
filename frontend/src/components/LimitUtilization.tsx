import React, { useEffect, useState, useCallback } from 'react'
import { useStore } from '../store'
import { formatCurrencyCompact, formatPercent } from '../utils'
import { Gauge, RefreshCw, Clock } from 'lucide-react'

const API_BASE = 'http://localhost:8000/api/v1'

const LimitUtilization: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/limit-utilization?currency=${currency}&fy=${fy}`)
      const result = await res.json()
      setData(result)
    } catch (e) {
      console.error('Limit utilization error:', e)
    } finally {
      setLoading(false)
    }
  }, [currency, fy])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { bank_utilization: banks = [], portfolio_summary: summary = {} } = data

  const getStatusColor = (pct: number) => {
    if (pct >= 90) return { bar: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Critical' }
    if (pct >= 75) return { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', label: 'High' }
    if (pct >= 50) return { bar: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-100', label: 'Moderate' }
    return { bar: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50 border-green-100', label: 'Safe' }
  }

  const getExhaustionLabel = (days: number) => {
    if (days === 0) return { text: 'Exhausted', color: 'text-red-700' }
    if (days < 15) return { text: `${days}d — Critical`, color: 'text-red-700' }
    if (days < 30) return { text: `${days}d — Warning`, color: 'text-orange-600' }
    if (days < 60) return { text: `${days}d`, color: 'text-yellow-600' }
    if (days >= 999) return { text: 'Far future', color: 'text-green-600' }
    return { text: `${days}d`, color: 'text-green-600' }
  }

  const overallPct = summary.overall_utilization_pct || 0
  const overallStatus = getStatusColor(overallPct)

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Gauge className="w-6 h-6 text-primary" />
            Limit Utilization Monitor
          </h2>
          <p className="text-sm text-muted-foreground">Bank-wise LC facility usage and predicted exhaustion dates</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-bold hover:bg-muted transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Portfolio Summary */}
      <div className={`p-6 rounded-xl border ${overallStatus.bg}`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Portfolio Utilization</p>
            <p className={`text-4xl font-black ${overallStatus.text}`}>{formatPercent(overallPct)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Limit</p>
            <p className="text-xl font-black">{formatCurrencyCompact(summary.total_limit, currency)}</p>
            <p className="text-xs text-muted-foreground mt-1">Available</p>
            <p className="text-lg font-bold text-green-700">{formatCurrencyCompact(summary.total_available, currency)}</p>
          </div>
        </div>
        <div className="w-full bg-white/50 h-4 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${overallStatus.bar}`}
            style={{ width: `${Math.min(overallPct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-2">
          <span className="font-bold">Used: {formatCurrencyCompact(summary.total_used, currency)}</span>
          <span className={`font-bold ${overallStatus.text}`}>Status: {overallStatus.label}</span>
        </div>
      </div>

      {/* Bank Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banks.map((bank: any, idx: number) => {
          const status = getStatusColor(bank.utilization_pct)
          const exhaust = getExhaustionLabel(bank.days_to_exhaustion)

          return (
            <div key={idx} className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-base">{bank.bank}</h3>
                  <p className="text-xs text-muted-foreground">{bank.lc_count} open LCs</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${status.bg} ${status.text}`}>
                  {status.label}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs font-bold">
                  <span>Limit Usage</span>
                  <span className={status.text}>{formatPercent(bank.utilization_pct)}</span>
                </div>
                <div className="w-full bg-muted h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${status.bar}`}
                    style={{ width: `${Math.min(bank.utilization_pct || 0, 100)}%` }}
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Used</p>
                  <p className="text-sm font-black mt-0.5">{formatCurrencyCompact(bank.used_limit, currency)}</p>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Available</p>
                  <p className="text-sm font-black mt-0.5 text-green-700">{formatCurrencyCompact(bank.available_limit, currency)}</p>
                </div>
                <div className="bg-muted/30 p-3 rounded-lg">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">Max Limit</p>
                  <p className="text-sm font-black mt-0.5">{formatCurrencyCompact(bank.max_limit, currency)}</p>
                </div>
              </div>

              {/* Exhaustion Forecast */}
              <div className="mt-4 flex items-center gap-2 pt-3 border-t">
                <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <p className="text-xs text-muted-foreground">Exhaustion forecast:</p>
                <p className={`text-xs font-black ${exhaust.color}`}>{exhaust.text}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Limit Exhaustion Risk Summary</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/30">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Bank</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Total Limit</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Used</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Available</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Utilization</th>
              <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase">Days to Full</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Risk Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-muted/30">
            {banks.map((bank: any, i: number) => {
              const status = getStatusColor(bank.utilization_pct)
              const exhaust = getExhaustionLabel(bank.days_to_exhaustion)
              return (
                <tr key={i} className="hover:bg-muted/10 transition-colors">
                  <td className="px-5 py-3 font-bold">{bank.bank}</td>
                  <td className="px-5 py-3 text-right">{formatCurrencyCompact(bank.max_limit, currency)}</td>
                  <td className="px-5 py-3 text-right font-bold">{formatCurrencyCompact(bank.used_limit, currency)}</td>
                  <td className="px-5 py-3 text-right text-green-700">{formatCurrencyCompact(bank.available_limit, currency)}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-bold ${status.text}`}>{formatPercent(bank.utilization_pct)}</span>
                  </td>
                  <td className={`px-5 py-3 text-right font-bold ${exhaust.color}`}>{exhaust.text}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default LimitUtilization
