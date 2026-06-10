// @ts-nocheck
import React, { useEffect, useState, useCallback } from 'react'
import { getAdvancedQuant } from '../../api'
import { useStore } from '../../store'
import { formatCurrencyCompact } from '../../utils'
import {
  Activity,
  AlertTriangle,
  Network,
  TrendingDown,
  ShieldAlert,
  RefreshCw
} from 'lucide-react'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  BarChart, Bar, ReferenceLine
} from 'recharts'

const AdvancedQuant: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const result = await getAdvancedQuant(currency, fy)
      setData(result)
    } catch (error) {
      console.error('Error fetching advanced quant data:', error)
    } finally {
      setLoading(false)
    }
  }, [currency, fy])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-56 bg-muted animate-pulse rounded-xl" />
          <div className="h-56 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    )
  }
  if (!data) return null

  const ewiColor = data.early_warning_index > 75 ? 'text-red-700' : data.early_warning_index > 50 ? 'text-orange-600' : 'text-green-700'
  const ewiBg = data.early_warning_index > 75 ? 'bg-red-50 border-red-200' : data.early_warning_index > 50 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-primary w-6 h-6" />
            Quantitative Risk & Stress Testing
          </h2>
          <p className="text-sm text-muted-foreground">Advanced mathematical models: liquidity-at-risk, stress testing, network dependency.</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-bold hover:bg-muted transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* EWI & LAR */}
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
          <div className={`p-5 rounded-xl border ${ewiBg}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Treasury Early Warning Index
                </h3>
                <p className="text-[10px] text-muted-foreground">Composite score — 0 is safe, 100 is critical</p>
              </div>
              <div className={`p-3 rounded-xl border ${ewiBg}`}>
                <p className={`text-3xl font-black ${ewiColor}`}>{Math.round(data.early_warning_index)}</p>
              </div>
            </div>
            <div className="mt-3 w-full bg-white/50 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${data.early_warning_index > 75 ? 'bg-red-500' : data.early_warning_index > 50 ? 'bg-orange-500' : 'bg-green-500'}`}
                style={{ width: `${data.early_warning_index}%` }}
              />
            </div>
          </div>

          <div className="border-t pt-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Liquidity-at-Risk (LAR 95%)
            </h3>
            <p className="text-[10px] text-muted-foreground mb-3">
              Statistical worst-case 30-day outflow: Mean + 1.645 × σ
            </p>
            <p className="text-4xl font-black text-orange-600">{formatCurrencyCompact(data.liquidity_at_risk, currency)}</p>
            <div className="mt-3 flex gap-6 text-xs text-muted-foreground">
              <span>Mean: <strong>{formatCurrencyCompact(data.lar_mean, currency)}</strong></span>
              <span>σ (Std Dev): <strong>{formatCurrencyCompact(data.lar_stddev, currency)}</strong></span>
            </div>
          </div>
        </div>

        {/* Stress Tests */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Treasury Stress Testing
          </h3>
          <p className="text-xs text-muted-foreground mb-6">Impact of FX shocks and limit cuts on utilization rate. Red line = 100% limit.</p>

          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stress_tests} layout="vertical" margin={{ left: 140, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, Math.max(150, ...data.stress_tests.map((s: any) => s.utilization + 10))]} hide />
                <YAxis
                  dataKey="scenario"
                  type="category"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fontWeight: 'bold' }}
                  width={150}
                />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    name === 'utilization' ? `${Number(value).toFixed(1)}%` : formatCurrencyCompact(Number(value), currency),
                    name === 'utilization' ? 'Limit Utilized' : 'Stressed Exposure'
                  ]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="utilization" barSize={18} radius={[0, 4, 4, 0]}>
                  {data.stress_tests.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.utilization > 100 ? '#ef4444' : entry.utilization > 85 ? '#f97316' : '#3b82f6'}
                    />
                  ))}
                </Bar>
                <ReferenceLine x={100} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" label={{ value: '100%', position: 'insideTopRight', fontSize: 10, fill: '#ef4444' }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Network Analysis */}
        <div className="bg-white p-6 rounded-xl border shadow-sm md:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Network className="w-4 h-4" />
            Bank → Supplier Concentration Network
          </h3>
          <p className="text-xs text-muted-foreground mb-6">
            Largest financial pipelines between banks and suppliers. Identifies concentration and single-point-of-failure risks.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.network.map((link: any, idx: number) => (
              <div key={idx} className="p-4 border rounded-xl flex flex-col justify-between hover:border-primary hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded truncate max-w-[45%]">
                    🏦 {link.source}
                  </span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded truncate max-w-[45%]">
                    🏭 {link.target}
                  </span>
                </div>
                <p className="text-base font-black text-center">{formatCurrencyCompact(link.value, currency)}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

export default AdvancedQuant