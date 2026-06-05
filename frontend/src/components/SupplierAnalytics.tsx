import React, { useEffect, useState } from 'react'
import { getSupplierExposure } from '../api'
import { useStore } from '../store'
import { formatCurrency } from '../utils'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts'

const COLORS = ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0']

const SupplierAnalytics: React.FC = () => {
  const { currency } = useStore()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getSupplierExposure(currency)
        setData(result)
      } catch (error) {
        console.error('Error fetching supplier analytics:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currency])

  if (loading) return <div className="p-8">Loading supplier insights...</div>

  const totalExposure = data.reduce((acc, s) => acc + s.value, 0)

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-right-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold">Supplier Concentration Analysis</h2>
        <p className="text-sm text-muted-foreground">Monitoring counterparty exposure and risk distribution</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Top 10 Suppliers by Exposure ({currency})</h3>
          <div className="h-[500px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.slice(0, 10)} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 11, fontWeight: 500 }}
                  width={180}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), 'Exposure']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col h-full">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Exposure Distribution</h3>
            <div className="space-y-4 overflow-y-auto max-h-[600px] pr-2">
              {data.map((supplier, idx) => (
                <div key={idx} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col max-w-[60%]">
                    <span className="text-xs font-bold truncate">{supplier.name}</span>
                    <span className="text-[10px] text-muted-foreground">{supplier.count} Active LCs</span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold">{formatCurrency(supplier.value, currency)}</div>
                    <div className="text-[10px] text-muted-foreground font-medium">
                      {((supplier.value / totalExposure) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SupplierAnalytics
