import React, { useState, useEffect } from 'react'
import { getMarketRates } from '../api'

interface Rates {
  usd_inr: number | null
  eur_inr: number | null
  cny_inr: number | null
}

const RateChip: React.FC<{ label: string; value: number | null; decimals?: number; suffix?: string }> = ({
  label, value, decimals = 2, suffix = ''
}) => (
  <div className="flex items-center gap-1.5">
    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">{label}</span>
    <span className={`font-mono text-[11px] font-bold ${value != null ? 'text-ink' : 'text-ink-faint'}`}>
      {value != null ? `${value.toFixed(decimals)}${suffix}` : '—'}
    </span>
  </div>
)

const Footer: React.FC = () => {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [rates, setRates] = useState<Rates>({ usd_inr: null, eur_inr: null, cny_inr: null })

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000)

    const fetchRates = async () => {
      try {
        const data = await getMarketRates()
        setRates({
          usd_inr: data.usd_inr ?? null,
          eur_inr: data.eur_inr ?? null,
          cny_inr: data.cny_inr ?? null,
        })
      } catch (e) {}
    }
    fetchRates()
    const rateTimer = setInterval(fetchRates, 5 * 60 * 1000)

    return () => {
      clearInterval(clockTimer)
      clearInterval(rateTimer)
    }
  }, [])

  const timeStr = currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateStr = currentTime.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' })

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 flex h-8 items-center justify-between border-t border-hairline bg-canvas px-6">
      <div className="text-[11px] font-medium text-ink opacity-60">
        © Grew Energy Private Limited
      </div>

      <div className="flex items-center gap-4 py-0.5">
        {/* FX Rates */}
        <div className="flex items-center gap-4 border-r border-hairline pr-4">
          <RateChip label="USD/INR" value={rates.usd_inr} />
          <RateChip label="EUR/INR" value={rates.eur_inr} />
          <RateChip label="CNY/INR" value={rates.cny_inr} />
        </div>

        {/* Live clock */}
        <div className="flex flex-col items-end leading-[1.1]">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 animate-pulse rounded-full bg-accent" title="Live" />
            <span className="font-mono text-[10px] font-bold text-ink-mute">{timeStr}</span>
          </div>
          <span className="text-[9px] font-medium text-ink-faint">{dateStr}</span>
        </div>
      </div>
    </footer>
  )
}

export default Footer
