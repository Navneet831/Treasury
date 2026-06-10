import React from 'react'
import { X, Download } from 'lucide-react'
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
  useStore()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-8 animate-in fade-in duration-300">
      <div className="bg-white rounded-[24px] shadow-[0_24px_60px_rgba(0,0,0,0.15)] w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-400">
        <div className="px-12 py-8 border-b border-[#f0f0f0] flex justify-between items-center">
          <div>
            <h3 className="text-[34px] font-bold text-[#1d1d1f] tracking-tight">{title}</h3>
            <p className="text-[14px] text-[#86868b] font-medium mt-1">
              Found {data.length} correlated records.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => exportToCSV(data, title.replace(/[^a-zA-Z0-9]/g, '_'))}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#3ecf8e] hover:bg-[#24b47e] text-[#171717] rounded-full text-[13px] font-bold transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-[#f5f5f7] rounded-full transition-all text-[#1d1d1f]"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-12 py-8 bg-[#fafafa]">
          {data.length > 0 ? (
            <table className="w-full text-left" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '12%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '16%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-[#dfdfdf]">
                  <th className="pb-4 pr-3 text-[10px] font-black text-[#707070] uppercase tracking-widest">LC No.</th>
                  <th className="pb-4 pr-3 text-[10px] font-black text-[#707070] uppercase tracking-widest">Supplier</th>
                  <th className="pb-4 pr-3 text-[10px] font-black text-[#707070] uppercase tracking-widest">Bank</th>
                  <th className="pb-4 pr-3 text-[10px] font-black text-[#707070] uppercase tracking-widest text-right">BOE Amt (INR)</th>
                  <th className="pb-4 pr-3 text-[10px] font-black text-[#707070] uppercase tracking-widest text-right">LC Amt (INR)</th>
                  <th className="pb-4 pr-3 text-[10px] font-black text-[#707070] uppercase tracking-widest">Due Date</th>
                  <th className="pb-4 text-[10px] font-black text-[#707070] uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {data.map((item, idx) => {
                  const boeAmt  = item['BOE Bill Amt (in INR)'] || 0
                  const lcAmt   = item['LC Amt (in INR)'] || 0
                  const payStatus = item['Payment Status']
                  const statusColor =
                    payStatus === 'Paid'      ? '#059669' :
                    payStatus === 'Unpaid'    ? '#dc2626' :
                    payStatus === 'Cancelled' ? '#94a3b8' : '#d97706'
                  return (
                    <tr key={idx} className="group hover:bg-[#f4f4f5] transition-colors">
                      <td className="py-3 pr-3 text-[12px] font-bold text-[#171717] truncate">{item['LC no.'] || 'N/A'}</td>
                      <td className="py-3 pr-3 text-[12px] text-[#171717] font-medium truncate">{item['Supplier Name'] || 'N/A'}</td>
                      <td className="py-3 pr-3 text-[12px] text-[#707070] font-medium truncate">{item['Bank Name'] || 'N/A'}</td>
                      <td className="py-3 pr-3 text-[12px] text-right font-bold text-[#171717]">
                        {boeAmt > 0 ? formatCurrency(boeAmt, 'INR') : <span className="text-[#94a3b8]">—</span>}
                      </td>
                      <td className="py-3 pr-3 text-[12px] text-right font-medium text-[#707070]">
                        {formatCurrency(lcAmt, 'INR')}
                      </td>
                      <td className="py-3 pr-3 text-[12px] text-[#707070] font-medium whitespace-nowrap">
                        {formatDate(item['LC Payment Due Date'])}
                      </td>
                      <td className="py-3">
                        <span
                          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                          style={{ background: statusColor }}
                        >
                          {payStatus || 'N/A'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-[#707070] font-medium italic">
              No matching intelligence records.
            </div>
          )}
        </div>

        <div className="px-12 py-8 border-t border-[#dfdfdf] flex justify-between items-center bg-[#fafafa]">
          <p className="text-[12px] text-[#707070] font-medium">Securely synchronized with treasury systems.</p>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-[#171717] text-white rounded-full font-bold text-[14px] hover:bg-black transition-all active:scale-95 shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default DrillDownModal
