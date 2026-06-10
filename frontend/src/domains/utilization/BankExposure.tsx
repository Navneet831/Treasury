// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { getLCExposure } from '../../api'
import { useStore } from '../../store'
import { formatCurrency } from '../../utils'
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

const COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1']

const BankExposure: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getLCExposure(currency, fy)
        const mappedData = (result?.bank_wise || []).map((b: any) => ({
          name: b.bank || 'Unknown',
          count: b.lc_count || 0,
          value: b.utilized || 0
        }))
        setData(mappedData)
      } catch (error) {
        console.error('Error fetching bank exposure:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currency, fy])

  if (loading) return <div className="p-8">Loading analytics...</div>

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold">Bank Exposure Analytics</h2>
          <p className="text-sm text-muted-foreground">Detailed breakdown of LC distribution across financial institutions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Exposure by Bank ({currency})</h3>
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 500 }}
                  width={150}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), 'Exposure']}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Bank Summary</h3>
          <div className="flex-1 space-y-4">
            {data.map((bank, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{bank.name}</span>
                  <span className="text-xs text-muted-foreground">{bank.count} Active LCs</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatCurrency(bank.value, currency)}</div>
                  <div className="text-[10px] text-muted-foreground font-medium">
                    {((bank.value / data.reduce((acc, b) => acc + b.value, 0)) * 100).toFixed(1)}% of total
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BankExposure
