import React, { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Building, Calendar as CalIcon } from 'lucide-react'
import { getCalendarData, getDrillDown } from '../api'
import { useStore } from '../store'
import { formatCurrencyCompact } from '../utils'
import DrillDownModal from './DrillDownModal'

const CalendarView: React.FC = () => {
  const { currency, fy } = useStore()
  const [currentDate, setCurrentDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [selectedBank, setSelectedBank] = useState<string>('All')
  
  const [drillData, setDrillData] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getCalendarData(currentDate.getMonth() + 1, currentDate.getFullYear(), currency, fy, selectedBank)
        setData(result)
      } catch (error) {
        console.error('Calendar load error:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currentDate, currency, fy, selectedBank])

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()

  const days = useMemo(() => {
    const arr: (number | null)[] = []
    for (let i = 0; i < firstDayOfMonth; i++) arr.push(null)
    for (let i = 1; i <= daysInMonth; i++) arr.push(i)
    return arr
  }, [daysInMonth, firstDayOfMonth])

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))

  const onCellClick = async (day: number, type: string) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const params: any = { date: dateStr, fy }
    if (selectedBank !== 'All') params.bank = selectedBank

    let title = `Details for ${dateStr}`
    if (type === 'opened') title = `Opened LCs on ${dateStr}`
    if (type === 'closed') title = `Closed LCs on ${dateStr}`
    if (type === 'due') title = `Payments Due on ${dateStr}`

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

    const items = []
    
    // Opened
    const openedItems = (data.opened || []).filter((d: any) => d.date?.startsWith(dateStr))
    const totalOpened = openedItems.reduce((acc: number, val: any) => acc + (val.opened_value || 0), 0)
    if (totalOpened > 0) items.push({ value: totalOpened, color: 'bg-[#0066cc]', type: 'opened' })

    // Closed
    const closedItems = (data.closed || []).filter((d: any) => d.date?.startsWith(dateStr))
    const totalClosed = closedItems.reduce((acc: number, val: any) => acc + (val.closed_value || 0), 0)
    if (totalClosed > 0) items.push({ value: totalClosed, color: 'bg-[#333333]', type: 'closed' })

    // Due
    const dueItems = (data.due || []).filter((d: any) => d.date?.startsWith(dateStr))
    dueItems.forEach((item: any) => {
      if (item.due_value > 0) {
        const isPaid = item.payment_status === 'Paid'
        items.push({ 
          value: item.due_value, 
          color: isPaid ? 'bg-[#86868b]' : 'bg-[#dc2626]', 
          type: 'due' 
        })
      }
    })

    return items
  }

  return (
    <div className="bg-white min-h-screen">
      <section className="px-12 pt-16 pb-12">
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row justify-between items-end gap-8">
           <div>
              <h1 className="text-[56px] font-bold text-[#1d1d1f] tracking-[-0.02em] leading-[1.07]">Schedules.</h1>
              <p className="text-[24px] text-[#86868b] mt-4 font-normal tracking-tight leading-[1.4]">
                Maturity tracking and operational timeline.
              </p>
           </div>
           
           <div className="flex items-center gap-6 bg-[#f5f5f7] p-1.5 rounded-full px-4">
              <button onClick={prevMonth} className="p-1 hover:text-[#0066cc] transition-colors"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-[14px] font-bold text-[#1d1d1f] min-w-[140px] text-center">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={nextMonth} className="p-1 hover:text-[#0066cc] transition-colors"><ChevronRight className="w-4 h-4" /></button>
           </div>
        </div>
      </section>

      <section className="px-12 pb-24">
        <div className="max-w-[1200px] mx-auto space-y-8">
           <div className="flex items-center justify-between border-b border-[#f0f0f0] pb-6">
              <div className="flex items-center gap-2 bg-white border border-[#e0e0e0] px-3 py-1.5 rounded-full shadow-sm">
                <Building className="w-3.5 h-3.5 text-[#86868b]" />
                <select 
                  className="text-[12px] font-bold bg-transparent outline-none cursor-pointer"
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                >
                  <option value="All">All Banks</option>
                  <option value="ICICI BANK">ICICI Bank</option>
                  <option value="HDFC BANK">HDFC Bank</option>
                  <option value="SBI BANK">SBI</option>
                  <option value="YES BANK">Yes Bank</option>
                </select>
              </div>

              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2 text-[11px] font-bold text-[#86868b]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#0066cc]" /> Opened
                 </div>
                 <div className="flex items-center gap-2 text-[11px] font-bold text-[#86868b]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#333333]" /> Closed
                 </div>
                 <div className="flex items-center gap-2 text-[11px] font-bold text-[#86868b]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#86868b]" /> Paid
                 </div>
                 <div className="flex items-center gap-2 text-[11px] font-bold text-[#86868b]">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" /> Unpaid Due
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[24px] border border-[#f0f0f0] overflow-hidden">
              <div className="grid grid-cols-7 bg-[#fafafa] border-b border-[#f0f0f0]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="py-4 text-center text-[10px] font-black text-[#86868b] uppercase tracking-widest">
                    {day}
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="h-[600px] flex items-center justify-center text-[#86868b] font-medium animate-pulse">Synchronizing Schedules...</div>
              ) : (
                <div className="grid grid-cols-7 h-[700px]">
                  {days.map((day, i) => (
                    <div key={i} className={`border-r border-b border-[#f0f0f0] last:border-r-0 p-4 transition-colors ${!day ? 'bg-[#fafafa]' : 'hover:bg-[#fafafa]'}`}>
                      {day && (
                        <>
                          <span className="text-[13px] font-bold text-[#1d1d1f] mb-3 block opacity-40">{day}</span>
                          <div className="space-y-1.5 overflow-y-auto max-h-[100px] no-scrollbar">
                            {getDayDetails(day).map((item, idx) => (
                              <div 
                                key={idx} 
                                onClick={() => onCellClick(day, item.type)}
                                className={`${item.color} text-white text-[10px] font-bold px-2 py-1 rounded-md cursor-pointer hover:opacity-80 transition-all flex justify-between shadow-sm`}
                              >
                                <span>{formatCurrencyCompact(item.value, currency)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
           </div>
        </div>
      </section>

      <DrillDownModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        data={drillData}
      />
    </div>
  )
}

export default CalendarView
