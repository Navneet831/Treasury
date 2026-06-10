import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { TrendingUp } from 'lucide-react'

const Header: React.FC = () => {
  const { currency, setCurrency, fy, setFy } = useStore()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dateStr = currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })

  return (
    <header className="h-[52px] border-b border-[#e2e8f0] bg-white flex items-center justify-between px-6 sticky top-0 z-50">
      {/* Brand */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#0f172a] rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#3ecf8e]" />
          </div>
          <div>
            <span className="text-[14px] font-bold text-[#0f172a] tracking-tight">Trade Finance Intelligence</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1 text-[11px] text-[#94a3b8]">
          <span className="font-medium">{dateStr}</span>
          <span className="mx-1.5 text-[#e2e8f0]">·</span>
          <span className="font-mono font-semibold text-[#475569]">{timeStr}</span>
          <span className="ml-2 w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-pulse" title="Live" />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-5">
        {/* FY Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">FY</span>
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="bg-[#f8fafc] border border-[#e2e8f0] rounded-md text-[12px] font-semibold text-[#0f172a] px-2 py-1 focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] outline-none cursor-pointer transition-colors"
          >
            <option value="All">All Years</option>
            <option value="FY24-25">FY 24–25</option>
            <option value="FY25-26">FY 25–26</option>
            <option value="FY26-27">FY 26–27</option>
          </select>
        </div>

        {/* Currency Toggle */}
        <div className="flex items-center gap-0.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-0.5">
          {(['INR', 'FC'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-3 py-1 text-[11px] font-bold uppercase rounded-md transition-all ${
                currency === c
                  ? 'bg-white text-[#0f172a] shadow-sm border border-[#e2e8f0]'
                  : 'text-[#94a3b8] hover:text-[#475569]'
              }`}
              >
                {c}
              </button>
          ))}
        </div>
      </div>
    </header>
  )
}

export default Header
