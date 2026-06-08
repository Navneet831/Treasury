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
        // Escape commas and quotes in CSV
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const DrillDownModal: React.FC<DrillDownModalProps> = ({ isOpen, onClose, data, title }) => {
  const { currency } = useStore()

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
              className="flex items-center gap-2 px-6 py-2.5 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f] rounded-full text-[13px] font-bold transition-all"
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

        <div className="flex-1 overflow-auto px-12 py-8">
          {data.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f0f0f0]">
                  <th className="pb-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest">ID</th>
                  <th className="pb-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest">Supplier</th>
                  <th className="pb-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest">Institution</th>
                  <th className="pb-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest text-right">Value ({currency})</th>
                  <th className="pb-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest">Maturity</th>
                  <th className="pb-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f5f5f7]">
                {data.map((item, idx) => (
                  <tr key={idx} className="group hover:bg-[#fafafa] transition-colors">
                    <td className="py-4 text-[13px] font-bold text-[#1d1d1f]">{item['LC no.']}</td>
                    <td className="py-4 text-[13px] text-[#1d1d1f] font-medium max-w-[200px] truncate">{item['Supplier Name']}</td>
                    <td className="py-4 text-[13px] text-[#86868b] font-medium">{item['Bank Name']}</td>
                    <td className="py-4 text-[13px] text-right font-bold text-[#1d1d1f]">
                      {formatCurrency(currency === 'INR' ? item['LC Amt (in INR)'] : item['Final LC Amt (in FC)'], currency)}
                    </td>
                    <td className="py-4 text-[13px] text-[#86868b] font-medium">
                      {formatDate(item['LC Payment Due Date'])}
                    </td>
                    <td className="py-4">
                       <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${item['LC Status'] === 'Open' ? 'bg-[#0066cc]' : 'bg-[#86868b]'}`} />
                          <span className="text-[12px] font-bold text-[#1d1d1f]">{item['LC Status'] || 'Open'}</span>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-[#86868b] font-medium italic">
              No matching intelligence records.
            </div>
          )}
        </div>

        <div className="px-12 py-8 border-t border-[#f0f0f0] flex justify-between items-center bg-[#fafafa]">
          <p className="text-[12px] text-[#86868b] font-medium">Securely synchronized with treasury systems.</p>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-[#0066cc] text-white rounded-full font-bold text-[14px] hover:bg-[#0071e3] transition-all active:scale-95 shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

export default DrillDownModal
