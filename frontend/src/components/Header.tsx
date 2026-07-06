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
    <header className="sticky top-0 z-50 flex h-[52px] items-center justify-between border-b border-hairline bg-canvas px-6">
      {/* Brand */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center">
            <img src="/bank_favicon.svg" alt="Logo" className="h-7 w-7" />
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-bold leading-tight tracking-tight text-ink">Treasury</span>
            <span className="text-[10px] font-medium leading-tight text-ink-mute">Grew Analytics</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-5">
        {/* As On Date Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">LC Payment Due Date</span>
          <input
            type="date"
            value={asOnDate}
            onChange={(e) => setAsOnDate(e.target.value)}
            className="cursor-pointer rounded-md border border-hairline bg-parchment px-2 py-1 text-[12px] font-semibold text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {/* Global Refresh — dispatches to active module via custom event */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('app-refresh'))}
          className="flex items-center gap-1.5 rounded-md border border-hairline bg-parchment px-3 py-1.5 text-[12px] font-semibold text-ink-mute transition-colors hover:bg-canvas hover:text-ink"
          title="Refresh data"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>

        {/* FY Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">FY</span>
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="cursor-pointer rounded-md border border-hairline bg-parchment px-2 py-1 text-[12px] font-semibold text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          >
            <option value="All">All Years</option>
            {fyOptions.map((f) => (
              <option key={f} value={f}>{f.replace('FY', 'FY ').replace('-', '–')}</option>
            ))}
          </select>
        </div>

        {/* Currency Toggle */}
        <div className="flex items-center gap-0.5 rounded-lg border border-hairline bg-parchment p-0.5">
          {(['INR', 'FC'] as const).map((c) => (
            <button
              key={c}
              onClick={() => {
                setCurrency(c);
                if (c === 'INR') setAmountUnit('Cr');
              }}
              className={`rounded-md px-3 py-1 text-[11px] font-bold uppercase transition-all ${
                currency === c
                  ? 'border border-hairline bg-canvas text-ink shadow-sm'
                  : 'text-ink-faint hover:text-ink-mute'
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
