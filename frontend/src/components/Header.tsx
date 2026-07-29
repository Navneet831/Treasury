import React, { useEffect, useState } from 'react'
import { useStore } from '../store'
import { getFYList } from '../api'
import { Menu, RefreshCw, Sun, Moon } from 'lucide-react'

const Header: React.FC<{ onToggleMobile?: () => void }> = ({ onToggleMobile }) => {
  const { currency, setCurrency, fy, setFy, asOnDate, setAsOnDate, setAmountUnit, isDarkMode, setIsDarkMode } = useStore()
  const [fyOptions, setFyOptions] = useState<string[]>([])

  useEffect(() => {
    getFYList().then(setFyOptions).catch(() => setFyOptions([]))
  }, [])

  return (
    <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-y-1 border-b border-hairline bg-canvas px-3 py-2 sm:h-[52px] sm:flex-nowrap sm:px-6 sm:py-0 overflow-x-hidden">
      {/* Left: Brand + Quick Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={onToggleMobile}
          className="flex md:hidden h-9 w-9 items-center justify-center rounded-md text-ink-mute hover:bg-parchment hover:text-ink transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center">
            <img src="/bank_favicon.svg" alt="Logo" className="h-7 w-7" />
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-bold leading-tight tracking-tight text-ink">Treasury</span>
            <span className="text-[10px] font-medium leading-tight text-ink-mute">Grew Analytics</span>
          </div>
        </div>

        {/* Quick Actions Divider */}
        <div className="h-6 w-px bg-hairline" />

        {/* Global Refresh */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('app-refresh'))}
          className="flex items-center gap-1.5 rounded-md border border-hairline bg-parchment px-2.5 py-1.5 text-[12px] font-semibold text-ink-mute transition-colors hover:bg-canvas hover:text-ink"
          title="Refresh all data"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden min-[420px]:inline">Refresh</span>
        </button>

        {/* Dark Mode Toggle */}
        <button
          type="button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="flex items-center justify-center rounded-md border border-hairline bg-parchment p-1.5 text-ink-mute transition-colors hover:bg-canvas hover:text-ink cursor-pointer"
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDarkMode ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5 text-violet-600" />}
        </button>
      </div>

      {/* Right: Filters & Controls */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 md:gap-5">
        {/* As On Date Selector */}
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-ink-faint">LC Payment Due Date</span>
          <input
            type="date"
            value={asOnDate}
            onChange={(e) => setAsOnDate(e.target.value)}
            className="cursor-pointer rounded-md border border-hairline bg-parchment px-2 py-1 text-[12px] font-semibold text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 min-h-[36px] sm:min-h-0"
          />
        </div>

        {/* FY Selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">FY</span>
          <select
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="cursor-pointer rounded-md border border-hairline bg-parchment px-2 py-1 text-[12px] font-semibold text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 min-h-[36px] sm:min-h-0"
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
              type="button"
              key={c}
              onClick={() => {
                setCurrency(c);
                if (c === 'INR') setAmountUnit('Cr');
              }}
              className={`rounded-md px-2.5 py-1.5 sm:py-1 text-[11px] font-bold uppercase transition-all min-w-[44px] sm:px-3 ${
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
