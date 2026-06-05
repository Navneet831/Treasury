import React, { useState, useEffect } from 'react'
import { getCalendarData } from '../api'
import { useStore } from '../store'
import { formatCurrency } from '../utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const CalendarView: React.FC = () => {
  const { currency } = useStore()
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 1)) // June 2026
  const [calendarData, setCalendarData] = useState<any[]>([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const month = currentDate.getMonth() + 1
        const year = currentDate.getFullYear()
        const data = await getCalendarData(month, year, currency)
        setCalendarData(data)
      } catch (error) {
        console.error('Error fetching calendar data:', error)
      }
    }
    fetchData()
  }, [currentDate, currency])

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()

  const days = []
  // Padding for first week
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  const getDayData = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return calendarData.find(d => d.date === dateStr)
  }

  const getColorClass = (value: number) => {
    if (!value) return 'bg-white'
    if (value > 10000000) return 'bg-red-50'
    if (value > 5000000) return 'bg-orange-50'
    return 'bg-green-50'
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Calendar Command Center</h2>
        <div className="flex items-center gap-4 bg-white border rounded-lg p-1">
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold min-w-[120px] text-center">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button 
            onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
        <div className="grid grid-cols-7 bg-muted/50 border-b">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            if (day === null) return <div key={`empty-${idx}`} className="h-32 border-b border-r last:border-r-0 bg-muted/10" />
            
            const dayData = getDayData(day)
            const colorClass = dayData ? getColorClass(dayData.total_value) : 'bg-white'
            
            return (
              <div 
                key={day} 
                className={`h-32 border-b border-r last:border-r-0 p-2 flex flex-col gap-1 transition-colors hover:bg-muted/5 cursor-pointer ${colorClass}`}
              >
                <span className="text-sm font-bold text-muted-foreground">{day}</span>
                {dayData && (
                  <div className="flex flex-col gap-1 mt-1">
                    {dayData.opened_value > 0 && (
                      <div className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold truncate">
                        Open: {formatCurrency(dayData.opened_value, currency)}
                      </div>
                    )}
                    {dayData.closed_value > 0 && (
                      <div className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold truncate">
                        Closed: {formatCurrency(dayData.closed_value, currency)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex items-center gap-3 p-4 bg-white border rounded-lg">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-muted-foreground font-medium">Moderate Activity</span>
        </div>
        <div className="flex items-center gap-3 p-4 bg-white border rounded-lg">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span className="text-sm text-muted-foreground font-medium">High Exposure Day</span>
        </div>
        <div className="flex items-center gap-3 p-4 bg-white border rounded-lg">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-sm text-muted-foreground font-medium">Critical Threshold</span>
        </div>
      </div>
    </div>
  )
}

export default CalendarView
