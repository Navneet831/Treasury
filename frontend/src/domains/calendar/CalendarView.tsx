import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getCalendarData, getDailyReco, getLimitUtilisation } from '../../api'
import { useStore } from '../../store'
import { useAudit } from '../../shared/AuditContext'
import { formatCurrencyAbsolute, formatCurrencyCompact } from '../../utils'

const EVENT_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  'Payment Due':        { bg: '#fee2e2', text: '#991b1b', label: 'Unpaid'        },
  'Paid':               { bg: '#dcfce7', text: '#166534', label: 'Paid'          },
  'Cancelled':          { bg: '#f1f5f9', text: '#64748b', label: 'Cancelled'     },
  'LC Opened':          { bg: '#fee2e2', text: '#1e40af', label: 'LC Opened'     },
  'LC Closed':          { bg: '#dcfce7', text: '#92400e', label: 'LC Closed'     },
  'LC Expiry':          { bg: '#dcfce7', text: '#991b1b', label: 'LC Expiry'     },
  'SBLC Opened':        { bg: '#fee2e2', text: '#0369a1', label: 'SBLC Open'     },
  'SBLC Expiry':        { bg: '#dcfce7', text: '#9a3412', label: 'SBLC Exp'      },
  'BOE Received':       { bg: '#000000', text: '#ffffff', label: 'BOE Recv'      },
  'BOE Unpaid':         { bg: '#fee2e2', text: '#991b1b', label: 'BOE Unpaid'    },
  'BOE Paid':           { bg: '#dcfce7', text: '#166534', label: 'BOE Paid'      },
  'FD Margin Released': { bg: '#000000', text: '#ffffff', label: 'FD Released'   },
}

const BANK_CONFIG: Record<string, { color: string; bg: string }> = {
  'SBI':  { color: '#1d4ed8', bg: '#dbeafe' }, // Blue
  'BOI':  { color: '#ea580c', bg: '#fff7ed' }, // Orange
  'IDBI': { color: '#15803d', bg: '#f0fdf4' }, // Green
  'OTHER': { color: '#000000', bg: '#f1f5f9' },
}

const BANK_ORDER = ['SBI', 'BOI', 'IDBI']

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
  Grey:     'Cancelled',
}


type ViewMode = 'lc' | 'boe' | 'fd' | 'bank'

const VIEW_LABELS: Record<ViewMode, string> = {
  lc:       'NFB',
  boe:      'BOE',
  fd:       'FD Release',
  bank:     'Bank',
}

const VIEW_TYPES: Record<ViewMode, string[]> = {
  lc:       ['LC Opened', 'LC Closed', 'LC Expiry', 'SBLC Opened', 'SBLC Expiry'],
  boe:      ['BOE Received', 'BOE Unpaid', 'BOE Paid'],
  fd:       ['FD Margin Released'],
  bank:     ['LC Opened', 'LC Closed', 'LC Expiry'], // LC details only in Bank view
}


const getVisibleTypes = (view: ViewMode): Set<string> => {
  return new Set(VIEW_TYPES[view])
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const CalendarView: React.FC = () => {
  const { currency, fy } = useStore()
  const { triggerDrillDown } = useAudit()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year,  setYear]  = useState(now.getFullYear())
  const [events,           setEvents]          = useState<any[]>([])
  const [loading,          setLoading]         = useState(true)
  const [reco,             setReco]            = useState<any>(null)
  const [selectedDay,      setSelectedDay]     = useState<number | null>(null)
  const [limitData,        setLimitData]       = useState<any>(null)

  const [viewMode,  setViewMode]  = useState<ViewMode>('boe')

  // Sub-filters
  const [nfbStatus,    setNfbStatus]    = useState<'Open' | 'Closed' | 'All'>('Open')
  const [nfbType,      setNfbType]      = useState<'All' | 'LC' | 'SBLC'>('All')
  const [boePayStatus, setBoePayStatus] = useState<string>('Unpaid')
  const [bankFilter,   setBankFilter]   = useState<string>('All')

  const visibleTypes = useMemo(() => {
    if (viewMode === 'boe' && boePayStatus !== 'All') {
      if (boePayStatus === 'Paid') return new Set(['BOE Paid'])
      if (boePayStatus === 'Unpaid') return new Set(['BOE Unpaid'])
    }
    return getVisibleTypes(viewMode)
  }, [viewMode, boePayStatus])

  useEffect(() => {
  }, [])

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const psParam = viewMode === 'boe' ? (boePayStatus !== 'All' ? boePayStatus : undefined) : undefined;
      
      const bankParam = (viewMode === 'bank' && bankFilter !== 'All') ? bankFilter : undefined;
      const statusParam = (viewMode === 'lc' && nfbStatus !== 'All') ? nfbStatus : undefined;

      const [result, limits] = await Promise.all([
        getCalendarData(
          month + 1, year, currency, fy,
          bankParam,
          statusParam,
          psParam
        ),
        getLimitUtilisation(currency, fy)
      ])
      setEvents(Array.isArray(result) ? result : [])
      setLimitData(limits)
    } catch {
      setEvents([])
      setLimitData(null)
    } finally {
      setLoading(false)
    }
  }, [month, year, currency, fy, viewMode, nfbStatus, boePayStatus, bankFilter])

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
      
      // Frontend filtering for NFB type
      if (viewMode === 'lc' && nfbType !== 'All') {
        const isSBLC = type.includes('SBLC')
        if (nfbType === 'LC' && isSBLC) return false
        if (nfbType === 'SBLC' && !isSBLC) return false
      }

      return visibleTypes.has(type)
    }).sort((a, b) => {
       const bankA = a.bank || 'OTHER'
       const bankB = b.bank || 'OTHER'
       let idxA = BANK_ORDER.indexOf(bankA)
       let idxB = BANK_ORDER.indexOf(bankB)
       if (idxA === -1) idxA = BANK_ORDER.length
       if (idxB === -1) idxB = BANK_ORDER.length
       return idxA - idxB
    })
  }

  const handleCellClick = (day: number) => {
    setSelectedDay(prev => prev === day ? null : day)
  }

  const handleEventClick = (e: React.MouseEvent, ev: { color: string; type: string; date?: string; bank?: string; amount: number }, day: number) => {
    e.stopPropagation()
    const type = COLOR_TO_TYPE[ev.color] || ev.type
    const evDateStr = ev.date ? String(ev.date).split('T')[0] : null

    let title = `${type} Details`
    if (ev.bank && ev.bank !== 'OTHER') {
      title += ` - ${ev.bank}`
    }
    if (evDateStr) {
      title += ` (${evDateStr})`
    }

    const params: Record<string, string | number | undefined> = { fy }
    if (ev.bank && ev.bank !== 'OTHER') {
      params.bank = ev.bank
    }
    if (evDateStr) {
      params.date = evDateStr
    }

    if (type === 'BOE Received') {
      params.boe_status = 'Received'
      params.date_field = 'boe_date'
    } else if (type === 'BOE Unpaid') {
      params.boe_status = 'Received'
      params.payment_status = 'Unpaid'
      params.date_field = 'due_date'
    } else if (type === 'BOE Paid') {
      params.boe_status = 'Received'
      params.payment_status = 'Paid'
      params.date_field = 'due_date'
    } else if (type === 'Payment Due') {
      params.payment_status = 'Unpaid'
      params.date_field = 'due_date'
    } else if (type === 'Paid') {
      params.payment_status = 'Paid'
      params.date_field = 'due_date'
    } else if (type === 'Cancelled') {
      params.payment_status = 'Cancelled'
      params.date_field = 'due_date'
    } else if (type === 'LC Opened') {
      params.status = 'Open'
      params.date_field = 'op_date'
    } else if (type === 'LC Closed') {
      params.status = 'Closed'
      params.date_field = 'lc_close_date'
    } else if (type === 'LC Expiry') {
      params.date_field = 'expiry_date'
    } else if (type === 'SBLC Opened') {
      params.status = 'Open'
      params.date_field = 'op_date'
    } else if (type === 'SBLC Expiry') {
      params.date_field = 'expiry_date'
    } else {
      handleCellClick(day)
      return
    }

    triggerDrillDown(title, params)
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
    <div className="flex flex-col h-full bg-parchment">
      <div className="bg-white border-b border-[#e2e8f0] px-4 py-2 flex flex-wrap items-center gap-2 sticky top-0 z-30">
        <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5 flex-shrink-0">
          <button type="button" onClick={(e) => { e.preventDefault(); prevMonth(); }} className="p-1.5 rounded-md hover:bg-white transition-colors text-[#64748b]"><ChevronLeft className="w-3.5 h-3.5" /></button>
          <span className="text-[12px] font-bold text-[#0f172a] min-w-[130px] text-center">{monthLabel}</span>
          <button type="button" onClick={(e) => { e.preventDefault(); nextMonth(); }} className="p-1.5 rounded-md hover:bg-white transition-colors text-[#64748b]"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>

        <div className="w-px h-5 bg-[#e2e8f0]" />

        <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
          {(Object.keys(VIEW_LABELS) as ViewMode[]).map(v => (
            <button type="button" key={v} onClick={(e) => { e.preventDefault(); setViewMode(v); }} className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${viewMode === v ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b] hover:text-[#0f172a]'}`}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        {/* Dynamic Sub-filters ────────────────────────────────────────────────── */}
        

        {viewMode === 'lc' && (
          <>
            <div className="w-px h-5 bg-[#e2e8f0]" />
            <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
              {['All', 'Open', 'Closed'].map(s => (
                <button type="button" key={s} onClick={(e) => { e.preventDefault(); setNfbStatus(s as any); }} className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${nfbStatus === s ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b]'}`}>
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
              {['All', 'LC', 'SBLC'].map(t => (
                <button type="button" key={t} onClick={(e) => { e.preventDefault(); setNfbType(t as any); }} className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${nfbType === t ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b]'}`}>
                  {t}
                </button>
              ))}
            </div>
          </>
        )}

        {viewMode === 'boe' && (
          <>
            <div className="w-px h-5 bg-[#e2e8f0]" />
            <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
              {['All', 'Unpaid', 'Paid'].map(ps => (
                <button type="button" key={ps} onClick={(e) => { e.preventDefault(); setBoePayStatus(ps); }} className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${boePayStatus === ps ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b]'}`}>
                  {ps}
                </button>
              ))}
            </div>
          </>
        )}

        {viewMode === 'bank' && (
          <>
            <div className="w-px h-5 bg-[#e2e8f0]" />
            <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
              {['All', 'SBI', 'BOI', 'IDBI'].map(b => (
                <button type="button" key={b} onClick={(e) => { e.preventDefault(); setBankFilter(b); }} className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${bankFilter === b ? 'bg-white text-[#0f172a] shadow-sm' : 'text-[#64748b]'}`}>
                  {b}
                </button>
              ))}
            </div>
          </>
        )}

      </div>

      {viewMode === 'bank' ? (
        limitData && limitData.bank_utilization && (
          <div className="bg-parchment border-b border-[#e2e8f0] px-4 py-1.5 flex items-center gap-5 flex-wrap">
            {BANK_ORDER.map(bankName => {
              const bData = limitData.bank_utilization.find((b: any) => b.bank === bankName)
              if (!bData) return null
              const config = BANK_CONFIG[bankName] || BANK_CONFIG['OTHER']
              const balance = (bData.interchangeability_limit + (bData.cash_limit || 0)) - ((bData.lc_open || 0) + (bData.lc_in_process || 0) + (bData.sblc_utilization || 0) + (bData.cash_utilization || 0))
              return (
                <div key={bankName} className="flex items-center gap-1.5 bg-white border border-[#e2e8f0] px-2 py-1 rounded shadow-sm">
                  <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: config.color }} />
                  <span className="text-[10px] font-black text-[#64748b] uppercase">{bankName} Balance</span>
                  <span className="text-[11px] font-black" style={{ color: config.color }}>{formatCurrencyCompact(balance, currency, 'Cr')}</span>
                </div>
              )
            })}
          </div>
        )
      ) : Object.keys(viewTotals).length > 0 && (
        <div className="bg-parchment border-b border-[#e2e8f0] px-4 py-1.5 flex items-center gap-5 flex-wrap">
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

      <div className="grid grid-cols-7 bg-parchment border-b border-[#e2e8f0]">
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
              <div key={i} onClick={() => day && setSelectedDay(prev => prev === day ? null : day)} className={`border-r border-b border-[#e2e8f0] p-1.5 overflow-hidden transition-colors ${!day ? 'bg-parchment' : isSelected ? 'bg-[#eff6ff] cursor-pointer' : 'hover:bg-parchment cursor-pointer'}`}>
                {day && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[10px] font-bold px-1 py-0.5 rounded leading-none ${isToday ? 'bg-[#2563eb] text-white' : hasUrgent ? 'text-[#dc2626] font-black' : 'text-[#94a3b8]'}`}>{day}</span>
                    </div>
                    <div className="space-y-0.5 overflow-y-auto max-h-[calc(100%-20px)] custom-scrollbar">
                      {dayEvents.map((ev, idx) => {
                        const type = COLOR_TO_TYPE[ev.color] || ev.type
                        const typeStyle = EVENT_STYLE[type]
                        if (!typeStyle) return null
                        
                        const bankName = ev.bank || 'OTHER'
                        const bConf = BANK_CONFIG[bankName] || BANK_CONFIG['OTHER']
                        
                        // New hybrid style: status background + bank text color
                        const isUndefinedScenario = type === 'BOE Received' || type === 'FD Margin Released'
                        const style = { 
                          bg: typeStyle.bg, 
                          text: isUndefinedScenario ? '#ffffff' : bConf.color, 
                          label: typeStyle.label 
                        }

                        return (
                          <button type="button" key={idx} onClick={e => { e.preventDefault(); handleEventClick(e, ev, day); }} title={`${ev.bank || 'Unknown Bank'}: ${formatCurrencyAbsolute(ev.amount, currency)}`} className="w-full text-left rounded-[3px] px-1 py-[1.5px] flex flex-col gap-0 shadow-sm hover:brightness-95 transition-all" style={{ background: style.bg, color: style.text, borderLeft: `2px solid ${style.text}44` }}>
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
        {viewMode === 'bank' ? (
          BANK_ORDER.map(bankName => {
             const config = BANK_CONFIG[bankName]
             if (!config) return null
             return (
                <div key={bankName} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-1.5 rounded" style={{ background: config.color }} />
                  <span className="text-[10px] text-[#64748b] font-bold">{bankName}</span>
                </div>
             )
          })
        ) : (
          legendTypes.map(type => {
            const style = EVENT_STYLE[type]
            if (!style) return null
            return (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-2.5 h-1.5 rounded" style={{ background: style.bg }} />
                <span className="text-[10px] text-[#64748b]">{style.label}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default CalendarView
