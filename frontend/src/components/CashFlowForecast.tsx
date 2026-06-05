import React, { useEffect, useState } from 'react'
import { getCashFlowForecast } from '../api'
import { useStore } from '../store'
import { formatCurrency } from '../utils'
import { 
  ComposedChart, 
  Bar, 
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts'

const CashFlowForecast: React.FC = () => {
  const { currency } = useStore()
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getCashFlowForecast(currency)
        setData(result)
      } catch (error) {
        console.error('Error fetching cash flow forecast:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currency])

  if (loading) return <div className="p-8">Generating treasury forecast...</div>

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-top-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold">Cash Flow Forecast</h2>
        <p className="text-sm text-muted-foreground">Predicting payment obligations and liquidity requirements</p>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">12-Month Payment Projection</h3>
        <div className="h-[450px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" hide />
              <YAxis yAxisId="right" orientation="right" hide />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                formatter={(value: any, name: any) => [formatCurrency(Number(value), currency), name === 'monthly_value' ? 'Monthly Requirement' : 'Cumulative Exposure']}
              />
              <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
              <Bar yAxisId="left" dataKey="monthly_value" name="Monthly Requirement" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={40} />
              <Line yAxisId="right" type="monotone" dataKey="cumulative_value" name="Cumulative Exposure" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.slice(0, 4).map((item, idx) => (
          <div key={idx} className="bg-white p-4 rounded-xl border shadow-sm">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{item.month}</p>
            <h4 className="text-lg font-bold mt-1">{formatCurrency(item.monthly_value, currency)}</h4>
            <div className="w-full bg-muted h-1.5 rounded-full mt-3 overflow-hidden">
               <div 
                className="bg-primary h-full rounded-full" 
                style={{ width: `${(item.monthly_value / Math.max(...data.map(d => d.monthly_value))) * 100}%` }} 
               />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default CashFlowForecast
