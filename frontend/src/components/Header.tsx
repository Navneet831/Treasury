import React, { useState, useEffect } from 'react'
import { useStore } from '../store'
import { Coins, Calendar as CalIcon, Clock } from 'lucide-react'

const Header: React.FC = () => {
  const { currency, setCurrency, fy, setFy } = useStore()
  const [currentTime, setCurrentTime] = useState(new Date())

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const dateStr = currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })

  return (
    <header className="h-[52px] border-b border-[#f0f0f0] bg-white/80 backdrop-blur-md flex items-center justify-between px-12 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
           <Coins className="w-5 h-5 text-[#1d1d1f]" />
           <h1 className="text-[17px] font-bold text-[#1d1d1f] tracking-tight">Treasury Intel</h1>
        </div>
        
        <nav className="hidden md:flex items-center gap-6">
          <span className="text-[12px] font-medium text-[#86868b] cursor-default">{dateStr}</span>
          <span className="text-[12px] font-bold text-[#1d1d1f] tracking-tighter">{timeStr}</span>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        {/* FY Selector */}
        <div className="flex items-center gap-2">
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="bg-transparent text-[12px] font-bold text-[#1d1d1f] border-none focus:ring-0 outline-none cursor-pointer hover:text-[#0066cc] transition-colors"
          >
            <option value="All">All FY</option>
            <option value="FY25-26">FY 25-26</option>
            <option value="FY26-27">FY 26-27</option>
          </select>
        </div>

        {/* Currency Toggle */}
        <div className="flex gap-4">
          <button
            onClick={() => setCurrency('INR')}
            className={`text-[12px] font-bold transition-all ${
              currency === 'INR' ? 'text-[#0066cc]' : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            INR
          </button>
          <button
            onClick={() => setCurrency('FC')}
            className={`text-[12px] font-bold transition-all ${
              currency === 'FC' ? 'text-[#0066cc]' : 'text-[#86868b] hover:text-[#1d1d1f]'
            }`}
          >
            FC
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
