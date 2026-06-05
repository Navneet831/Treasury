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

  const timeStr = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateStr = currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-2">
        <Coins className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-lg font-black tracking-tight leading-none">LC Analytics Command Center</h1>
          <p className="text-[10px] text-muted-foreground font-medium">Treasury Operations Platform</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Live Clock */}
        <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5 rounded-lg">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          <div className="text-right">
            <p className="text-xs font-black font-mono tracking-tighter leading-none">{timeStr}</p>
            <p className="text-[9px] text-muted-foreground leading-none mt-0.5">{dateStr}</p>
          </div>
        </div>

        {/* FY Selector */}
        <div className="flex items-center gap-2 bg-muted p-1 rounded-md">
          <CalIcon className="w-4 h-4 ml-2 text-muted-foreground" />
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="bg-transparent text-sm font-bold border-none focus:ring-0 outline-none cursor-pointer pr-2"
          >
            <option value="All">All Years</option>
            <option value="FY25-26">FY 25-26</option>
            <option value="FY26-27">FY 26-27</option>
          </select>
        </div>

        {/* Currency Toggle */}
        <div className="flex bg-muted p-1 rounded-md">
          <button
            onClick={() => setCurrency('INR')}
            className={`px-3 py-1 text-sm font-bold rounded-sm transition-all ${
              currency === 'INR' ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ₹ INR
          </button>
          <button
            onClick={() => setCurrency('FC')}
            className={`px-3 py-1 text-sm font-bold rounded-sm transition-all ${
              currency === 'FC' ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            $ FC
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
