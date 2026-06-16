import React, { useState, useEffect } from 'react'
import { X, Download, ChevronRight, Table } from 'lucide-react'
import { formatCurrency, formatDate } from '../utils'
import { useStore } from '../store'

interface DrillDownModalProps {
  isOpen: boolean
  onClose: () => void
  data: any[]
  title: string
}

const exportToCSV = (data: any[], filename: string) => {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h]
        if (val === null || val === undefined) return ''
        const str = String(val)
        // Better CSV escaping
        const escaped = str.replace(/"/g, '""')
        return `"${escaped}"`
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filename}.csv`)
  link.click()
  URL.revokeObjectURL(url)
}

const DrillDownModal: React.FC<DrillDownModalProps> = ({ isOpen, onClose, data, title }) => {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [isTabular, setIsTabular] = useState<boolean>(true)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  if (!isOpen) return null

  const toggleDate = (date: string) => {
    const next = new Set(expandedDates)
    if (next.has(date)) next.delete(date)
    else next.add(date)
    setExpandedDates(next)
  }

  // Sort and group by date
  const sortedData = [...data].sort((a, b) => {
    const dateA = new Date(a['LC Payment Due Date'] || 0).getTime()
    const dateB = new Date(b['LC Payment Due Date'] || 0).getTime()
    return dateA - dateB
  })

  const grouped: { [key: string]: any[] } = {}
  sortedData.forEach(item => {
    const d = formatDate(item['LC Payment Due Date'])
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(item)
  })

  const renderRow = (item: any, idx: number, globalIdx?: number) => {
    const boeAmt  = item['BOE Bill Amt (in INR)'] || 0
    const lcAmt   = item['LC Amt (in INR)'] || 0
    const payStatus = item['Payment Status']
    const boeDate = item['Date of Bill of Entry Submitted to Bank']
    const lcDate = item['LC Payment Due Date']
    
    let ageingDisplay = <span className="text-[#94a3b8]">N/A</span>
    if (boeDate) {
      const diff = new Date().getTime() - new Date(boeDate).getTime()
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const color = days > 90 ? 'text-red-600' : days > 60 ? 'text-orange-600' : days > 30 ? 'text-blue-600' : 'text-green-600'
      if (!isNaN(days)) ageingDisplay = <span className={`font-bold ${color}`}>{days}d</span>
    }

    const statusColor =
      payStatus === 'Paid'      ? '#059669' :
      payStatus === 'Unpaid'    ? '#dc2626' :
      payStatus === 'Cancelled' ? '#94a3b8' : '#d97706'
    return (
      <tr key={idx} className="group hover:bg-[#f4f4f5] transition-colors">
        {isTabular && (
          <td className="py-1.5 pr-3 text-[11px] font-medium text-[#707070] whitespace-nowrap">
            {globalIdx !== undefined ? globalIdx + 1 : idx + 1}
          </td>
        )}
        {isTabular && (
          <td className="py-1.5 pr-3 text-[11px] font-bold text-[#171717] whitespace-nowrap">
            {formatDate(lcDate)}
          </td>
        )}
        <td className="py-1.5 pr-3 text-[11px] whitespace-nowrap">
          {ageingDisplay}
        </td>
        <td className="py-1.5 pr-3 text-[11px] font-bold text-[#171717] truncate">{item['LC no.'] || 'N/A'}</td>
        <td className="py-1.5 pr-3 text-[11px] text-[#171717] font-medium truncate">{item['Supplier Name'] || 'N/A'}</td>
        <td className="py-1.5 pr-3 text-[11px] text-[#707070] font-medium truncate">{item['Bank Name'] || 'N/A'}</td>
        <td className="py-1.5 pr-3 text-[11px] text-right font-bold text-[#171717]">
          {boeAmt > 0 ? formatCurrency(boeAmt, 'INR') : <span className="text-[#94a3b8]">—</span>}
        </td>
        <td className="py-1.5 pr-3 text-[11px] text-right font-medium text-[#707070]">
          {formatCurrency(lcAmt, 'INR')}
        </td>
        <td className="py-1.5">
          <span
            className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold text-white"
            style={{ background: statusColor }}
          >
            {payStatus || 'N/A'}
          </span>
        </td>
      </tr>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-8 animate-in fade-in duration-300">
      <div className="bg-white rounded-[20px] shadow-lift w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-400">
        <div className="px-6 py-4 border-b border-[#f0f0f0] flex justify-between items-center bg-white z-10">
          <div>
            <h3 className="text-[20px] font-bold text-[#1d1d1f] tracking-tight">{title}</h3>
            <p className="text-[12px] text-[#86868b] font-medium">
              Found {data.length} correlated records.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsTabular(!isTabular)}
              className={`flex items-center justify-center p-2 rounded-full transition-all text-[#171717] border ${isTabular ? 'bg-[#f0f0f2] border-[#dfdfdf]' : 'bg-white border-[#dfdfdf] hover:bg-[#f5f5f7]'}`}
              title={isTabular ? "Switch to Grouped View" : "Switch to Tabular View"}
            >
              <Table className="w-4 h-4" />
            </button>
            <button
              onClick={() => exportToCSV(data, title.replace(/[^a-zA-Z0-9]/g, '_'))}
              className="flex items-center gap-2 px-4 py-1.5 bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] rounded-full text-[12px] font-bold transition-all shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[#f5f5f7] rounded-full transition-all text-[#1d1d1f]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4 bg-[#fafafa]">
          {data.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#dfdfdf]">
                  {isTabular && (
                    <th className="pb-3 pr-3 text-[9px] font-black text-[#707070] uppercase tracking-widest w-[4%]">S.No.</th>
                  )}
                  {isTabular && (
                    <th className="pb-3 pr-3 text-[9px] font-black text-[#707070] uppercase tracking-widest w-[9%]">Due Date</th>
                  )}
                  <th className="pb-3 pr-3 text-[9px] font-black text-[#707070] uppercase tracking-widest w-[9%]">Ageing</th>
                  <th className="pb-3 pr-3 text-[9px] font-black text-[#707070] uppercase tracking-widest w-[11%]">LC No.</th>
                  <th className="pb-3 pr-3 text-[9px] font-black text-[#707070] uppercase tracking-widest w-[20%]">Supplier</th>
                  <th className="pb-3 pr-3 text-[9px] font-black text-[#707070] uppercase tracking-widest w-[11%]">Bank</th>
                  <th className="pb-3 pr-3 text-[9px] font-black text-[#707070] uppercase tracking-widest text-right w-[14%]">BOE Amt (INR)</th>
                  <th className="pb-3 pr-3 text-[9px] font-black text-[#707070] uppercase tracking-widest text-right w-[14%]">LC Amt (INR)</th>
                  <th className="pb-3 text-[9px] font-black text-[#707070] uppercase tracking-widest w-[8%]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {isTabular ? (
                  sortedData.map((item, idx) => renderRow(item, idx, idx))
                ) : (
                  Object.entries(grouped).map(([date, items]) => {
                    const isExpanded = expandedDates.has(date)
                    const totalAmount = items.reduce((sum, item) => sum + (item['BOE Bill Amt (in INR)'] || item['LC Amt (in INR)'] || 0), 0)
                    const uniqueBanks = Array.from(new Set(items.map(item => item['Bank Name']))).filter(Boolean)
                    const banksList = uniqueBanks.join(' · ')
                    
                    return (
                      <React.Fragment key={date}>
                        <tr 
                          className="bg-[#f0f0f2]/50 hover:bg-[#eaeaec] cursor-pointer transition-colors group/header"
                          onClick={() => toggleDate(date)}
                        >
                          <td colSpan={isTabular ? 9 : 7} className="py-1.5 px-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <ChevronRight className={`w-4 h-4 text-[#707070] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                <span className="text-[12px] font-black text-[#1d1d1f] uppercase tracking-wider">{date}</span>
                                <span className="text-[11px] font-bold text-[#86868b] px-3 border-l border-[#dfdfdf]">{banksList}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                 <span className="text-[14px] font-black text-[#1d1d1f]">{formatCurrency(totalAmount, 'INR')}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && items.map((item, idx) => renderRow(item, idx))}
                      </React.Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-[#707070] font-medium italic">
              No matching intelligence records.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#dfdfdf] flex justify-between items-center bg-[#fafafa]">
          <p className="text-[11px] text-[#707070] font-medium">Securely synchronized with treasury systems.</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-[#171717] text-white rounded-full font-bold text-[13px] hover:bg-black transition-all active:scale-95 shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default DrillDownModal
