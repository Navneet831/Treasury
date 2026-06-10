// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { getPETreasury } from '../../api'
import { 
  Building2,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  TrendingUp,
  Activity
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie
} from 'recharts'

const COLORS = ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8']

const PETreasury: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getPETreasury()
        setData(result)
      } catch (error) {
        console.error('Error fetching PE Treasury data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="p-8">Loading Private Equity Treasury Models...</div>
  if (!data) return null

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-right-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="text-primary w-6 h-6" />
            Macro & Corporate Finance (PE Style)
        </h2>
        <p className="text-sm text-muted-foreground">Level 3 Treasury reporting: Debt Maturity, Capital Stack, and Value Creation tracking.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Value Creation Tracker */}
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Return on Treasury Capital & Value Creation
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(data.value_creation).map(([key, val]: any, idx) => (
                    <div key={idx} className="p-4 border rounded-xl bg-muted/10 hover:border-primary transition-all">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
                            {key.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xl font-black text-primary">₹{val} Cr</p>
                    </div>
                ))}
            </div>
        </div>

        {/* Debt Maturity Wall */}
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6 flex items-center gap-2">
            <BarChart className="w-4 h-4" />
            Debt Maturity Wall
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.debt_maturity} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontWeight: 'bold' }} />
                <YAxis hide />
                <Tooltip 
                  formatter={(value: any, _name: any, props: any) => [`₹${value} Cr`, props.payload.debt_type]}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="amount_cr" radius={[4, 4, 0, 0]} barSize={40}>
                    {data.debt_maturity.map((_entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Capital Stack */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6 flex items-center gap-2">
            <PieChartIcon className="w-4 h-4" />
            Capital Stack
          </h3>
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.capital_stack}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="amount_cr"
                  nameKey="component"
                >
                  {data.capital_stack.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   formatter={(value: any) => [`₹${value} Cr`, 'Amount']}
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Macro Liquidity Index */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Macro Liquidity Index
            </h3>
            <div className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase">RBI Liquidity Deficit</p>
                    <p className="text-sm font-black text-red-600">{data.liquidity_index.rbi_liquidity_deficit}</p>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Banking System</p>
                    <p className="text-sm font-black text-orange-600">{data.liquidity_index.banking_system_liquidity}</p>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Money Market Rates</p>
                    <p className="text-sm font-black">{data.liquidity_index.money_market_rates}</p>
                </div>
                <div className="flex justify-between items-center pb-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase">Yield Curve Shape</p>
                    <p className="text-sm font-black text-blue-600">{data.liquidity_index.yield_curve_shape}</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-[10px] font-bold text-blue-800 uppercase mb-1">Treasury Implication</p>
                    <p className="text-xs font-medium text-blue-900">{data.liquidity_index.treasury_implication}</p>
                </div>
            </div>
        </div>

        {/* Yield Curve Dashboard */}
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6 flex items-center gap-2">
            <LineChartIcon className="w-4 h-4" />
            Yield Curve Dashboard
          </h3>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.yield_curve} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tenor" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={['dataMin - 0.2', 'dataMax + 0.2']} />
                <Tooltip 
                  formatter={(value: any) => [`${value}%`, 'Yield Rate']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Area type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  )
}

export default PETreasury
