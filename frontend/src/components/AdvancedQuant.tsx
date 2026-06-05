import React, { useEffect, useState } from 'react'
import { getAdvancedQuant } from '../api'
import { useStore } from '../store'
import { formatCurrency } from '../utils'
import { 
  Activity,
  AlertTriangle,
  Network,
  TrendingDown,
  ShieldAlert
} from 'lucide-react'
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Line, ComposedChart
} from 'recharts'

const AdvancedQuant: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getAdvancedQuant(currency, fy)
        setData(result)
      } catch (error) {
        console.error('Error fetching advanced quant data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currency, fy])

  if (loading) return <div className="p-8">Simulating quantitative models...</div>
  if (!data) return null

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-right-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-primary w-6 h-6" />
            Quantitative Risk & Stress Testing
        </h2>
        <p className="text-sm text-muted-foreground">Advanced mathematical models for liquidity-at-risk, network dependency, and scenario stress testing.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Liquidity at Risk & EWI */}
        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-6">
          <div className="flex items-start justify-between">
              <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Treasury Early Warning Index
                  </h3>
                  <p className="text-[10px] text-muted-foreground">Composite score of impending liquidity crunch (0-100)</p>
              </div>
              <div className={`p-3 rounded-xl border ${data.early_warning_index > 75 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
                  <p className="text-3xl font-black">{Math.round(data.early_warning_index)}</p>
              </div>
          </div>
          
          <div className="border-t pt-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Liquidity-at-Risk (LAR 95%)
              </h3>
              <p className="text-[10px] text-muted-foreground mb-3">Estimated worst-case 30-day outflow based on historical variance</p>
              <p className="text-4xl font-black text-orange-600">{formatCurrency(data.liquidity_at_risk, currency)}</p>
          </div>
        </div>

        {/* Treasury Stress Testing */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Treasury Stress Testing Scenarios
          </h3>
          <p className="text-xs text-muted-foreground mb-6">Simulated impact of FX shocks and bank limit cuts on overall utilization.</p>
          
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.stress_tests} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 150]} hide />
                <YAxis dataKey="scenario" type="category" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold'}} width={120} />
                <Tooltip 
                  formatter={(value: any, name: any) => [
                      name === 'utilization' ? `${Number(value).toFixed(1)}%` : formatCurrency(Number(value), currency), 
                      name === 'utilization' ? 'Limit Utilized' : name === 'exposure' ? 'Stressed Exposure' : 'Available Limit'
                  ]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="utilization" barSize={20} radius={[0, 4, 4, 0]}>
                    {data.stress_tests.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.utilization > 100 ? '#ef4444' : entry.utilization > 80 ? '#f97316' : '#3b82f6'} />
                    ))}
                </Bar>
                {/* Visual marker for 100% limit breach */}
                <Line dataKey={() => 100} stroke="#ef4444" strokeWidth={2} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Network Analysis (Bank -> Supplier flows) */}
        <div className="bg-white p-6 rounded-xl border shadow-sm md:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Network className="w-4 h-4" />
            Concentration Network Analysis
          </h3>
          <p className="text-xs text-muted-foreground mb-6">Visualizing the largest financial pipelines connecting your banks to your suppliers.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.network.map((link: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-xl flex flex-col justify-between hover:border-primary hover:shadow-md transition-all">
                      <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded truncate max-w-[45%]">
                              {link.source}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded truncate max-w-[45%]">
                              {link.target}
                          </span>
                      </div>
                      <p className="text-lg font-black text-center">{formatCurrency(link.value, currency)}</p>
                  </div>
              ))}
          </div>
        </div>

      </div>
    </div>
  )
}

export default AdvancedQuant