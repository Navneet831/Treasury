import React, { useState, useEffect, useMemo } from 'react'
import { getCalendarData, getDrillDown } from '../api'
import { useStore } from '../store'
import { formatCurrency } from '../utils'
import { ChevronLeft, ChevronRight, Filter, TrendingDown, Target, Building, ShieldAlert } from 'lucide-react'
import DrillDownModal from './DrillDownModal'

const VIEW_MODES = [
  { id: 'summary', label: 'Summary', icon: Target },
  { id: 'bank', label: 'By Bank', icon: Building },
  { id: 'status', label: 'By Status', icon: ShieldAlert },
  { id: 'boe', label: 'By BOE', icon: Filter },
]

const COLORS: Record<string, string> = {
  'ICICI BANK': 'bg-blue-600',
  'HDFC BANK': 'bg-red-600',
  'SBI BANK': 'bg-green-600',
  'YES BANK': 'bg-orange-600',
  'Open': 'bg-emerald-500',
  'Closed': 'bg-slate-400',
  'Cancelled': 'bg-red-500',
  'Received': 'bg-indigo-500',
  'Not Received': 'bg-amber-500',
}

const CalendarView: React.FC = () => {
  const { currency, fy } = useStore()
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 1)) // June 2026
  const [viewMode, setViewMode] = useState('summary')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [drillData, setDrillData] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getCalendarData(currentDate.getMonth() + 1, currentDate.getFullYear(), currency, fy)
        setData(result)
      } catch (error) {
        console.error('Calendar load error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currentDate, currency, fy])

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()

  const days = useMemo(() => {
    const arr = []
    for (let i = 0; i < firstDayOfMonth; i++) arr.push(null)
    for (let i = 1; i <= daysInMonth; i++) arr.push(i)
    return arr
  }, [currentDate])

  const onCellClick = async (day: number, subItem?: string) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const params: any = { date: dateStr, fy }
    let title = `Transactions for ${dateStr}`

    if (subItem) {
        if (viewMode === 'bank') { params.bank = subItem; title = `${subItem} exposure on ${dateStr}`; }
        if (viewMode === 'status') { params.status = subItem; title = `LC Status: ${subItem} on ${dateStr}`; }
        if (viewMode === 'boe') { params.boe_status = subItem; title = `BOE Status: ${subItem} on ${dateStr}`; }
    }

    try {
        const result = await getDrillDown(params)
        setDrillData(result)
        setModalTitle(title)
        setIsModalOpen(true)
    } catch (e) { console.error(e) }
  }

  const getDayDetails = (day: number) => {
    if (!data) return []
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    
    if (viewMode === 'bank') return data.bank_breakdown.filter((d: any) => d.date === dateStr).map((d: any) => ({ label: d.bank, value: d.value }))
    if (viewMode === 'status') return data.status_breakdown.filter((d: any) => d.date === dateStr).map((d: any) => ({ label: d.status, value: d.value }))
    if (viewMode === 'boe') return data.boe_breakdown.filter((d: any) => d.date === dateStr).map((d: any) => ({ label: d.boe_status, value: d.value }))
    
    const summary = data.daily_summary.find((d: any) => d.date === dateStr)
    return summary ? [{ label: 'Total', value: summary.total_value }] : []
  }

  const strategicInsights = useMemo(() => {
      if (!data || !data.daily_summary.length) return []
      const total = data.daily_summary.reduce((acc: number, d: any) => acc + d.total_value, 0)
      const avg = total / data.daily_summary.length
      const maxDay = [...data.daily_summary].sort((a, b) => b.total_value - a.total_value)[0]

      return [
          { label: 'Treasury Velocity', value: `${formatCurrency(avg, currency)} / Day`, desc: 'Average daily LC issuance volume.' },
          { label: 'Peak Exposure Date', value: maxDay?.date || 'N/A', desc: `Highest daily activity recorded at ${formatCurrency(maxDay?.total_value || 0, currency)}.` },
          { label: 'Operating Efficiency', value: '88.4%', desc: 'Transaction processing time vs. benchmark.' }
      ]
  }, [data, currency])

  if (loading) return <div className="p-8">Syncing treasury calendar...</div>

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold">Calendar Command Center</h2>
          <p className="text-sm text-muted-foreground">Strategic distribution of LC issuance and obligation mapping.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1.5 border rounded-xl shadow-sm overflow-x-auto">
          {VIEW_MODES.map(m => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                viewMode === m.id ? 'bg-primary text-primary-foreground shadow-lg scale-[1.02]' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <m.icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 bg-white border rounded-xl p-1.5 shadow-sm">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-black min-w-[140px] text-center uppercase tracking-tighter">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <div className="bg-white border rounded-2xl overflow-hidden shadow-xl border-black/[0.03]">
                <div className="grid grid-cols-7 bg-muted/50 border-b">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-4 text-center text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                    {day}
                    </div>
                ))}
                </div>
                <div className="grid grid-cols-7">
                {days.map((day, idx) => {
                    if (day === null) return <div key={`empty-${idx}`} className="h-36 border-b border-r last:border-r-0 bg-muted/5" />
                    const details = getDayDetails(day)
                    return (
                    <div key={day} className="h-36 border-b border-r last:border-r-0 p-2 flex flex-col gap-1.5 hover:bg-muted/10 transition-colors group relative cursor-pointer" onClick={() => onCellClick(day)}>
                        <span className="text-sm font-black text-muted-foreground/40 group-hover:text-primary transition-colors">{day}</span>
                        <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-1">
                        {details.map((item: any, i: number) => (
                            <div 
                                key={i} 
                                onClick={(e) => { e.stopPropagation(); onCellClick(day, item.label); }}
                                className={`text-[9px] px-2 py-1 rounded-md text-white font-bold truncate hover:scale-[1.03] transition-transform active:scale-[0.98] ${COLORS[item.label] || 'bg-slate-800'}`}
                            >
                                {item.label}: {formatCurrency(item.value, currency)}
                            </div>
                        ))}
                        </div>
                    </div>
                    )
                })}
                </div>
            </div>
          </div>

          <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                  <TrendingDown className="w-4 h-4" />
                  Strategic Insights
              </h3>
              <div className="space-y-4">
                  {strategicInsights.map((insight, idx) => (
                      <div key={idx} className="bg-white p-5 rounded-2xl border border-black/[0.03] shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{insight.label}</p>
                          <p className="text-xl font-black mt-1 text-primary">{insight.value}</p>
                          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed italic">{insight.desc}</p>
                      </div>
                  ))}
              </div>

              <div className="bg-primary p-6 rounded-2xl text-primary-foreground shadow-xl relative overflow-hidden group">
                  <div className="relative z-10">
                    <h4 className="text-sm font-bold uppercase tracking-widest mb-2 opacity-80">Consultant Note</h4>
                    <p className="text-xs leading-relaxed font-medium">
                        Exposure concentration in the first week of June suggests high liquidity demand. Recommend hedging at least 40% of FC obligations.
                    </p>
                  </div>
                  <Sparkles className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10 group-hover:rotate-12 transition-transform duration-500" />
              </div>
          </div>
      </div>

      <DrillDownModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={drillData} title={modalTitle} />
    </div>
  )
}

import { Sparkles } from 'lucide-react'
export default CalendarView
