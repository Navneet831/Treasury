// @ts-nocheck
import React, { useEffect, useState } from 'react'
import { getBOEMonitoring } from '../../api'
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
  Cell,
  PieChart, 
  Pie,
  Legend
} from 'recharts'

const AGING_COLORS: Record<string, string> = {
  '0-30 Days': '#22c55e',
  '31-60 Days': '#f59e0b',
  '61-90 Days': '#f97316',
  '90+ Days': '#ef4444'
}

const STATUS_COLORS = ['#0f172a', '#334155', '#475569', '#64748b', '#94a3b8']

const BOEMonitoring: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getBOEMonitoring(currency, fy)
        setData(result)
      } catch (error) {
        console.error('Error fetching BOE monitoring data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currency, fy])

  if (loading) return <div className="p-8">Loading BOE metrics...</div>
  if (!data) return null

  return (
    <div className="p-8 space-y-8 animate-in zoom-in-95 duration-500">
      <div>
        <h2 className="text-2xl font-bold">Bill of Entry (BOE) Monitoring</h2>
        <p className="text-sm text-muted-foreground">Tracking documentation compliance and pending obligations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">BOE Aging Analysis (Pending Value)</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.aging_buckets}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="bucket" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  formatter={(value: any) => [formatCurrency(Number(value || 0), currency), 'Pending Value']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                  {data.aging_buckets.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={AGING_COLORS[entry.bucket] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Status Breakdown (Pending Value)</h3>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.status_breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="status"
                >
                  {data.status_breakdown.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                   formatter={(value: any) => [formatCurrency(Number(value || 0), currency), 'Value']}
                />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Aging Summary Table</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground font-bold">
                <th className="pb-4">Aging Bucket</th>
                <th className="pb-4">No. of Documents</th>
                <th className="pb-4 text-right">Pending Value ({currency})</th>
                <th className="pb-4 text-right">Risk Level</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.aging_buckets.map((item: any, idx: number) => (
                <tr key={idx} className="hover:bg-muted/30 transition-colors">
                  <td className="py-4 font-medium">{item.bucket}</td>
                  <td className="py-4">{item.count}</td>
                  <td className="py-4 text-right font-bold">{formatCurrency(item.value, currency)}</td>
                  <td className="py-4 text-right">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      item.bucket === '90+ Days' ? 'bg-red-100 text-red-700' :
                      item.bucket === '61-90 Days' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {item.bucket === '90+ Days' ? 'Critical' : item.bucket === '61-90 Days' ? 'High' : 'Moderate'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default BOEMonitoring
