import React, { useEffect, useState } from 'react'
import { useStore } from '../store'
import { getFYList } from '../api'
import { RefreshCw } from 'lucide-react'

const Header: React.FC = () => {
  const { currency, setCurrency, fy, setFy, asOnDate, setAsOnDate, setAmountUnit } = useStore()
  const [fyOptions, setFyOptions] = useState<string[]>([])

  useEffect(() => {
    getFYList().then(setFyOptions).catch(() => setFyOptions([]))
  }, [])

  return (
    <header className="h-[52px] border-b border-[#e2e8f0] bg-white flex items-center justify-between px-6 sticky top-0 z-50">
      {/* Brand */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 flex items-center justify-center">
            <img src="/bank_favicon.svg" alt="Logo" className="w-7 h-7" />
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-bold text-[#0f172a] tracking-tight leading-tight">Treasury</span>
            <span className="text-[10px] font-medium text-[#64748b] leading-tight">Grew Analytics</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-5">
        {/* As On Date Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">LC Payment Due Date</span>
          <input
            type="date"
            value={asOnDate}
            onChange={(e) => setAsOnDate(e.target.value)}
            className="bg-[#f8fafc] border border-[#e2e8f0] rounded-md text-[12px] font-semibold text-[#0f172a] px-2 py-1 focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] outline-none cursor-pointer transition-colors"
          />
        </div>

        {/* Global Refresh — dispatches to active module via custom event */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('app-refresh'))}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-[#e2e8f0] bg-[#f8fafc] rounded-md text-[12px] font-semibold text-[#475569] hover:bg-white hover:text-[#0f172a] transition-colors shadow-sm"
          title="Refresh data"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>

        {/* FY Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">FY</span>
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="bg-[#f8fafc] border border-[#e2e8f0] rounded-md text-[12px] font-semibold text-[#0f172a] px-2 py-1 focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] outline-none cursor-pointer transition-colors"
          >
            <option value="All">All Years</option>
            {fyOptions.map((f) => (
              <option key={f} value={f}>{f.replace('FY', 'FY ').replace('-', '–')}</option>
            ))}
          </select>
        </div>

        {/* Currency Toggle */}
        <div className="flex items-center gap-0.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-0.5">
          {(['INR', 'FC'] as const).map((c) => (
            <button
              key={c}
              onClick={() => {
                setCurrency(c);
                if (c === 'INR') setAmountUnit('Cr');
              }}
              className={`px-3 py-1 text-[11px] font-bold uppercase rounded-md transition-all ${
                currency === c
                  ? 'bg-white text-[#0f172a] shadow-sm border border-[#e2e8f0]'
                  : 'text-[#94a3b8] hover:text-[#475569]'
              }`}
              >
                {c === 'INR' ? 'In Cr' : c}
              </button>
          ))}
        </div>
      </div>
    </header>
  )
}

export default Header
