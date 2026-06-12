import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCalendarData, getDailyReco, getBanksList, getPaymentStatuses } from '../../api'
import { useStore } from '../../store'
import { formatCurrencyAbsolute } from '../../utils'

const EVENT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  'Payment Due':        { bg: '#fee2e2', text: '#991b1b', label: 'Unpaid'        },
  'Paid':               { bg: '#d1fae5', text: '#065f46', label: 'Paid'          },
  'LC Opened':          { bg: '#dbeafe', text: '#1e40af', label: 'LC Opened'     },
  'LC Closed':          { bg: '#fef3c7', text: '#92400e', label: 'LC Closed'     },
  'LC Expiry':          { bg: '#fecaca', text: '#991b1b', label: 'LC Expiry'     },
  'SBLC Opened':        { bg: '#e0f2fe', text: '#0369a1', label: 'SBLC Open'     },
  'SBLC Expiry':        { bg: '#ffedd5', text: '#9a3412', label: 'SBLC Exp'      },
  'BOE Received':       { bg: '#ede9fe', text: '#5b21b6', label: 'BOE Recv'      },
  'BOE Unpaid':         { bg: '#fee2e2', text: '#991b1b', label: 'BOE Unpaid'    },
  'BOE Paid':           { bg: '#dcfce7', text: '#166534', label: 'BOE Paid'      },
  'FD Margin Released': { bg: '#cffafe', text: '#155e75', label: 'FD Released'   },
}

const COLOR_TO_TYPE: Record<string, string> = {
  Red:      'Payment Due',
  Green:    'Paid',
  Blue:     'LC Opened',
  Orange:   'LC Closed',
  DarkRed:  'LC Expiry',
  Purple:   'BOE Received',
  BoeRed:   'BOE Unpaid',
  BoeGreen: 'BOE Paid',
  Teal:     'FD Margin Released',
}


type ViewMode = 'payments' | 'lc' | 'boe' | 'fd' | 'bank'

const VIEW_LABELS: Record<ViewMode, string> = {
  payments: 'Payments',
  lc:       'NFB',
  boe:      'BOE',
  fd:       'FD Release',
  bank:     'Bank',
}

const VIEW_TYPES: Record<ViewMode, string[]> = {
  payments: ['Payment Due', 'Paid'],
  lc:       ['LC Opened', 'LC Closed', 'LC Expiry', 'SBLC Opened', 'SBLC Expiry'],
  boe:      ['BOE Received', 'BOE Unpaid', 'BOE Paid'],
  fd:       ['FD Margin Released'],
  bank:     ['Payment Due', 'Paid', 'LC Opened', 'LC Closed', 'LC Expiry', 'BOE Received', 'BOE Unpaid', 'BOE Paid', 'FD Margin Released', 'SBLC Opened', 'SBLC Expiry'], // All types visible in Bank view, grouping logic will change UI
}

const HAS_PAY_TOGGLE: Record<ViewMode, boolean> = {
  payments: true,
  lc:       false,
  boe:      false,
  fd:       false,
  bank:     false,
}

const getVisibleTypes = (view: ViewMode, pay: string): Set<string> => {
  const base = VIEW_TYPES[view]
  if (!HAS_PAY_TOGGLE[view] || pay === 'All') return new Set(base)
  if (pay === 'Paid') return new Set(base.filter(t => t !== 'Payment Due'))
  return new Set(base.filter(t => t !== 'Paid'))
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CalendarView: React.FC = () => {
  const { currency, fy } = useStore()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year,  setYear]  = useState(now.getFullYear())
  const [events,           setEvents]          = useState<any[]>([])
  const [banks,            setBanks]           = useState<string[]>([])
  const [paymentStatuses,  setPaymentStatuses] = useState<string[]>([])
  const [selectedBank,     setSelectedBank]    = useState('All')
  const [loading,          setLoading]         = useState(true)
  const [reco,             setReco]            = useState<any>(null)
  const [selectedDay,      setSelectedDay]     = useState<number | null>(null)

  const [viewMode,  setViewMode]  = useState<ViewMode>('payments')
  const [payFilter, setPayFilter] = useState<string>('Unpaid')

  const visibleTypes = useMemo(() => getVisibleTypes(viewMode, payFilter), [viewMode, payFilter])

  useEffect(() => {
    getBanksList().then(setBanks).catch(() => setBanks([]))
    getPaymentStatuses().then(setPaymentStatuses).catch(() => setPaymentStatuses([]))
  }, [])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const psFilter = viewMode === 'payments' && payFilter !== 'All' ? payFilter : undefined
      const result = await getCalendarData(
        month + 1, year, currency, fy,
        selectedBank === 'All' ? undefined : selectedBank,
        undefined,
        psFilter
      )
      setEvents(Array.isArray(result) ? result : [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [month, year, currency, fy, selectedBank, viewMode, payFilter])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  useEffect(() => {
    if (selectedDay === null) { setReco(null); return }
    const d = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    getDailyReco(d).then(setReco).catch(() => setReco(null))
  }, [selectedDay, month, year])

  const prevMonth = () => { setSelectedDay(null); if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { setSelectedDay(null); if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const daysInMonth  = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()

  const days = useMemo(() => {
    const arr: (number | null)[] = Array(firstWeekday).fill(null)
    for (let d = 1; d <= daysInMonth; d++) arr.push(d)
    return arr
  }, [daysInMonth, firstWeekday])

  const getDayEvents = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => {
      const d = e.date ? String(e.date).split('T')[0] : null
      if (d !== dateStr) return false
      const type = COLOR_TO_TYPE[e.color] || e.type
      return visibleTypes.has(type)
    })
  }

  const handleCellClick = (day: number) => {
    setSelectedDay(prev => prev === day ? null : day)
  }

  const todayDay   = now.getMonth() === month && now.getFullYear() === year ? now.getDate() : null
  const monthLabel = new Date(year, month, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })

  const viewTotals = useMemo(() => {
    const t: Record<string, { amount: number; count: number }> = {}
    events.forEach(e => {
      const type = COLOR_TO_TYPE[e.color] || e.type
      if (visibleTypes.has(type)) {
        if (!t[type]) t[type] = { amount: 0, count: 0 }
        t[type].amount += (e.amount || 0)
        t[type].count  += (e.count  || 0)
      }
    })
    return t
  }, [events, visibleTypes])

  const legendTypes = [...visibleTypes].filter(t => VIEW_TYPES[viewMode].includes(t))

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white border-b border-[#e2e8f0] px-4 py-2 flex flex-wrap items-center gap-2 sticky top-0 z-30">
        <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5 flex-shrink-0">
          <button onClick={prevMonth} className="p-1.5 rounded-md hover:bg-white transition-colors text-[#64748b]"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <span className="text-[12px] font-bold text-[#0f172a] min-w-[130px] text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-md hover:bg-white transition-colors text-[#64748b]"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>

        <div className="w-px h-5 bg-[#e2e8f0]" />

        <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map(v => (
            <button key={v} onClick={() => { setViewMode(v); setPayFilter('All') }} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${viewMode === v ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'}`}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {HAS_PAY_TOGGLE[viewMode] && paymentStatuses.length > 0 && (
          <>
            <div className="w-px h-5 bg-[#e2e8f0]" />
            <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
              {['All', ...paymentStatuses].map(ps => {
                const isActive = payFilter === ps
                const activeColor = ps === 'Paid' ? '#047857' : ps === 'Unpaid' ? '#b91c1c' : ps === 'Cancelled' ? '#64748b' : '#2563eb'
                return (
                  <button key={ps} onClick={() => setPayFilter(ps)} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${isActive ? 'text-white shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'}`} style={isActive ? { background: ps === 'All' ? '#0f172a' : activeColor } : {}}>
                    {ps}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {banks.length > 0 && (
          <>
            <div className="w-px h-5 bg-[#e2e8f0]" />
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="bg-[#f1f5f9] rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#0f172a] border-0 focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 cursor-pointer"
            >
              <option value="All">All Banks</option>
              {banks.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </>
        )}

      </div>

      {Object.keys(viewTotals).length > 0 && (
        <div className="bg-[#f8fafc] border-b border-[#e2e8f0] px-4 py-1.5 flex items-center gap-5 flex-wrap">
          {legendTypes.map(type => {
            const val = viewTotals[type]; if (!val?.amount) return null; const style = EVENT_STYLE[type]
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: style.bg }} />
                <span className="text-[10px] text-[#64748b]">{style.label}</span>
                <span className="text-[11px] font-black text-[#0f172a]">{formatCurrencyAbsolute(val.amount, currency)}</span>
                {val.count > 0 && <span className="text-[9px] font-semibold text-[#94a3b8] tabular-nums">{val.count}</span>}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-7 bg-[#f8fafc] border-b border-[#e2e8f0]">
        {DAY_NAMES.map(d => <div key={d} className="py-1.5 text-center text-[9px] font-black text-[#94a3b8] uppercase tracking-widest">{d}</div>)}
      </div>

      <div className="flex-1 grid grid-cols-7 border-l border-t border-[#e2e8f0]" style={{ minHeight: 0, gridTemplateRows: 'repeat(6, 1fr)' }}>
        {loading ? (
          <div className="col-span-7 row-span-6 flex items-center justify-center"><span className="text-[12px] text-[#94a3b8] animate-pulse font-medium">Synchronising…</span></div>
        ) : (
          days.map((day, i) => {
            const dayEvents = day ? getDayEvents(day) : []
            const isToday = day === todayDay, isSelected = day === selectedDay, hasUrgent = dayEvents.some(e => e.color === 'Red')
            return (
              <div key={i} onClick={() => day && setSelectedDay(prev => prev === day ? null : day)} className={`border-r border-b border-[#e2e8f0] p-1.5 overflow-hidden transition-colors ${!day ? 'bg-[#fafafa]' : isSelected ? 'bg-[#eff6ff] cursor-pointer' : 'hover:bg-[#f8fafc] cursor-pointer'}`}>
                {day && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-1 py-0.5 rounded leading-none ${isToday ? 'bg-[#2563eb] text-white' : hasUrgent ? 'text-[#dc2626] font-black' : 'text-[#94a3b8]'}`}>{day}</span>
                    </div>
                    <div className="space-y-0.5 overflow-y-auto max-h-[calc(100%-20px)] custom-scrollbar">
                      {dayEvents.map((ev, idx) => {
                        const type = COLOR_TO_TYPE[ev.color] || ev.type, style = EVENT_STYLE[type]
                        if (!style) return null
                        return (
                          <button key={idx} onClick={e => { e.stopPropagation(); handleCellClick(day) }} title={`${ev.bank || 'Unknown Bank'}: ${formatCurrencyAbsolute(ev.amount, currency)}`} className="w-full text-left rounded-[3px] px-1 py-[1.5px] flex flex-col gap-0 shadow-sm hover:brightness-95 transition-all" style={{ background: style.bg, color: style.text, borderLeft: `2px solid ${style.text}44` }}>
                            <div className="flex justify-between items-center w-full">
                                <span className="text-[8px] font-black uppercase tracking-tighter opacity-80 truncate max-w-[50px]">{ev.bank || 'MISC'}</span>
                                <span className="text-[8px] font-bold opacity-60">{style.label}</span>
                            </div>
                            <span className="text-[9px] font-bold leading-tight">{formatCurrencyAbsolute(ev.amount, currency)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      {selectedDay && reco && (
        <div className="bg-white border-t border-[#e2e8f0] px-5 py-2 flex items-center gap-5 flex-wrap">
          <span className="text-[11px] font-black text-[#0f172a] flex-shrink-0">{String(selectedDay).padStart(2, '0')} {new Date(year, month).toLocaleString('en-IN', { month: 'short', year: 'numeric' })}</span>
          {([
            { key: 'lc_opened', label: 'LC Opened', color: '#2563eb' },
            { key: 'lc_closed', label: 'LC Closed', color: '#d97706' },
            { key: 'payments_due', label: 'BOE to Pay', color: '#dc2626' },
            { key: 'payments_completed', label: 'BOE Paid', color: '#059669' },
            { key: 'boe_received', label: 'BOE Received', color: '#7c3aed' },
            { key: 'fd_releasing', label: 'FD Released', color: '#0891b2' },
          ] as const).map(({ key, label, color }) => {
            const item = reco[key]; if (!item || item.count === 0) return null
            return (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-[10px] text-[#64748b]">{label}</span>
                <span className="text-[10px] font-bold text-[#0f172a]">{item.count} · {formatCurrencyAbsolute(item.value, currency)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Legend — shows only what's visible in current view ────────────────── */}
      <div className="bg-white border-t border-[#e2e8f0] px-4 py-1.5 flex items-center gap-4 flex-wrap mt-auto">
        <span className="text-[9px] font-bold text-[#94a3b8] uppercase tracking-wider">Legend</span>
        {legendTypes.map(type => {
          const style = EVENT_STYLE[type]
          if (!style) return null
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-1.5 rounded" style={{ background: style.bg }} />
              <span className="text-[10px] text-[#64748b]">{style.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CalendarView
