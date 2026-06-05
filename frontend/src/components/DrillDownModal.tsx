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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b flex justify-between items-center bg-primary text-primary-foreground">
          <div>
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="text-xs opacity-80 uppercase tracking-widest font-bold mt-1">
              {data.length} records found
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => exportToCSV(data, title.replace(/[^a-zA-Z0-9]/g, '_'))}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-colors"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {data.length > 0 ? (
            <table className="w-full text-sm border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-muted-foreground font-bold uppercase text-[10px] tracking-wider">
                  <th className="px-4">LC Number</th>
                  <th className="px-4">Supplier</th>
                  <th className="px-4">Bank</th>
                  <th className="px-4 text-right">Value ({currency})</th>
                  <th className="px-4">Due Date</th>
                  <th className="px-4">LC Status</th>
                  <th className="px-4">Payment</th>
                  <th className="px-4">Risk</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => {
                  const riskFlag = item['risk_flag']
                  const riskColor = riskFlag === 'Expiry Risk' || riskFlag === 'Overdue' ? 'bg-red-100 text-red-700'
                    : riskFlag === 'Payment Due' ? 'bg-orange-100 text-orange-700'
                    : riskFlag === 'BOE Overdue' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'

                  return (
                    <tr key={idx} className="bg-muted/30 hover:bg-muted/50 transition-colors group">
                      <td className="px-4 py-3 font-bold rounded-l-lg border-l-2 border-primary/0 group-hover:border-primary transition-all">
                        {item['LC no.']}
                      </td>
                      <td className="px-4 py-3 text-sm max-w-[150px] truncate">{item['Supplier Name']}</td>
                      <td className="px-4 py-3 text-sm">{item['Bank Name']}</td>
                      <td className="px-4 py-3 text-right font-black text-sm">
                        {formatCurrency(currency === 'INR' ? item['LC Amt (in INR)'] : item['Final LC Amt (in FC)'], currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(item['LC Payment Due Date'])}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item['LC Status'] === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {item['LC Status'] || 'Open'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item['Payment Status'] === 'Paid' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {item['Payment Status'] || 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 rounded-r-lg">
                        {riskFlag && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${riskColor}`}>
                            {riskFlag}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground italic">
              No matching records found for this drill-down.
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/10 flex justify-between items-center">
          <p className="text-xs text-muted-foreground">{data.length} records — click Export CSV to download all fields</p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default DrillDownModal
