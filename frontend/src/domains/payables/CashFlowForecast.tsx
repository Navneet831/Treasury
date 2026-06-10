// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react'
import { getCashFlowForecast } from '../../api'
import { useStore } from '../../store'
import { formatCurrencyCompact } from '../../utils'
import { RefreshCw, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react'
import {
  ComposedChart,
  Bar,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine
} from 'recharts'

const CashFlowForecast: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getCashFlowForecast(currency, fy)
      setData(result)
    } catch (err) {
      console.error('Error fetching cash flow forecast:', err)
    } finally {
      setLoading(false)
    }
  }, [currency, fy])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="p-8 space-y-8">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="bg-white border rounded-xl p-6 shadow-sm h-[450px] animate-pulse" />
      </div>
    )
  }

  const totalForecast = data.reduce((sum, d) => sum + (d.monthly_value || 0), 0)
  const maxMonth = data.reduce((max, d) => (d.monthly_value || 0) > (max.monthly_value || 0) ? d : max, data[0] || {})
  const avgMonthly = data.length > 0 ? totalForecast / data.length : 0

  // Format for chart tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border rounded-xl shadow-xl p-4 text-sm">
          <p className="font-bold text-base mb-2">{label}</p>
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
    <div className="p-8 space-y-8 animate-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
          <p className="text-sm text-muted-foreground">Payment obligations with 95% statistical confidence intervals</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-bold hover:bg-muted transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Forecast</p>
          </div>
          <p className="text-2xl font-black">{formatCurrencyCompact(totalForecast, currency)}</p>
          <p className="text-xs text-muted-foreground mt-1">Next {data.length} months</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Peak Month</p>
          </div>
          <p className="text-2xl font-black">{maxMonth?.month || 'N/A'}</p>
          <p className="text-xs text-muted-foreground mt-1">{formatCurrencyCompact(maxMonth?.monthly_value, currency)} due</p>
        </div>
        <div className="bg-white p-5 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg Monthly</p>
          </div>
          <p className="text-2xl font-black">{formatCurrencyCompact(avgMonthly, currency)}</p>
          <p className="text-xs text-muted-foreground mt-1">Planning baseline</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">
          12-Month Payment Projection with 95% Confidence Interval
        </h3>
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v) => formatCurrencyCompact(v, currency)}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10 }}
                width={80}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="top" align="right" height={36} iconType="circle" />

              {/* Confidence interval band */}
              <Area
                dataKey="confidence_upper"
                fill="#bfdbfe"
                stroke="transparent"
                name="Upper CI (95%)"
                fillOpacity={0.4}
              />
              <Area
                dataKey="confidence_lower"
                fill="#ffffff"
                stroke="transparent"
                name="Lower CI (95%)"
                fillOpacity={1}
              />

              <Bar dataKey="monthly_value" name="Expected Payment" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={28} />
              <Line
                type="monotone"
                dataKey="cumulative_value"
                name="Cumulative Exposure"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#3b82f6' }}
                yAxisId={0}
              />
              <Line
                type="monotone"
                dataKey="confidence_upper"
                name="Upper CI"
                stroke="#f87171"
                strokeDasharray="5 3"
                dot={false}
                strokeWidth={1.5}
              />
              <Line
                type="monotone"
                dataKey="confidence_lower"
                name="Lower CI"
                stroke="#4ade80"
                strokeDasharray="5 3"
                dot={false}
                strokeWidth={1.5}
              />
              <ReferenceLine y={avgMonthly} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Avg', position: 'right', fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center italic">
          Confidence intervals derived from historical monthly payment variance (σ × 1.645 = 95% CI)
        </p>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-5 border-b">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Monthly Forecast Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Month</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Expected</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Lower CI</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Upper CI</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Cumulative</th>
                <th className="px-5 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Relative Load</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/50">
              {data.map((item, idx) => {
                const pct = maxMonth?.monthly_value > 0 ? (item.monthly_value / maxMonth.monthly_value) * 100 : 0
                return (
                  <tr key={idx} className="hover:bg-muted/10 transition-colors">
                    <td className="px-5 py-3 font-bold">{item.month}</td>
                    <td className="px-5 py-3 text-right font-black">{formatCurrencyCompact(item.monthly_value, currency)}</td>
                    <td className="px-5 py-3 text-right text-green-700">{formatCurrencyCompact(item.confidence_lower, currency)}</td>
                    <td className="px-5 py-3 text-right text-red-700">{formatCurrencyCompact(item.confidence_upper, currency)}</td>
                    <td className="px-5 py-3 text-right text-blue-700 font-bold">{formatCurrencyCompact(item.cumulative_value, currency)}</td>
                    <td className="px-5 py-3">
                      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-orange-400' : 'bg-blue-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default CashFlowForecast
