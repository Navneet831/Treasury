import React from 'react'
import { X } from 'lucide-react'
import { formatCurrency } from '../utils'
import { useStore } from '../store'

interface DrillDownModalProps {
  isOpen: boolean
  onClose: () => void
  data: any[]
  title: string
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
              Found {data.length} records in this slice
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
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
                  <th className="px-4">Status</th>
                  <th className="px-4">Payment</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => (
                  <tr key={idx} className="bg-muted/30 hover:bg-muted/50 transition-colors group">
                    <td className="px-4 py-3 font-bold rounded-l-lg border-l-2 border-primary/0 group-hover:border-primary transition-all">
                        {item['LC no.']}
                    </td>
                    <td className="px-4 py-3">{item['Supplier Name']}</td>
                    <td className="px-4 py-3">{item['Bank Name']}</td>
                    <td className="px-4 py-3 text-right font-black">
                        {formatCurrency(currency === 'INR' ? item['LC Amt (in INR)'] : item['Final LC Amt (in FC)'], currency)}
                    </td>
                    <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item['LC Status'] === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                            {item['LC Status']}
                        </span>
                    </td>
                    <td className="px-4 py-3 rounded-r-lg">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item['Payment Status'] === 'Paid' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                            {item['Payment Status']}
                        </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-muted-foreground italic">
                No matching records found for this drill-down.
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/10 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Close Drill-down
          </button>
        </div>
      </div>
    </div>
  )
}

export default DrillDownModal
