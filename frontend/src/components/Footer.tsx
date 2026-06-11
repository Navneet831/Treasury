import React, { useState, useEffect } from 'react'

const Footer: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateStr = currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-8 border-t border-[#e2e8f0] bg-white flex items-center justify-between px-6 z-50">
      <div className="text-[11px] text-[#0f172a] font-medium opacity-60">
        © Grew Energy Private Limited
      </div>

      <div className="flex flex-col items-end leading-[1.1] py-0.5">
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-[#16a34a] animate-pulse" title="Live" />
          <span className="text-[10px] font-mono font-bold text-[#475569]">{timeStr}</span>
        </div>
        <span className="text-[9px] font-medium text-[#94a3b8]">{dateStr}</span>
      </div>
    </footer>
  )
}

export default Footer
