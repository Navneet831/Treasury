import React, { useEffect, useState, useCallback } from 'react'
import { getExecutiveOverview } from '../../api'
import { useStore } from '../../store'
import { formatCurrencyCompact, formatPercent } from '../../utils'
import {
  Wallet,
  Shield,
  CreditCard,
  Building2,
  Activity,
  AlertCircle,
  Clock,
  XCircle,
  TrendingUp,
  FileText
} from 'lucide-react'

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  icon: any;
  subText?: string;
  variant?: 'default' | 'accent' | 'warning';
  breakdown?: { Currency: string; value: number }[];
  currency: string;
  formula?: string;
  unit: 'Cr' | 'Absolute';
}> = ({ title, value, icon: Icon, subText, variant = 'default', breakdown, currency, formula, unit }) => {
  const isAccent = variant === 'accent'
  const isWarning = variant === 'warning'
  
  return (
    <div className={`p-8 rounded-[12px] border ${isAccent ? 'bg-[#3ecf8e] text-[#171717] border-[#24b47e]' : isWarning ? 'bg-[#ff2201] text-white border-[#e2005a]' : 'bg-[#f4f4f5] border-[#e5e5e5] text-[#171717]'} transition-all shadow-sm hover:shadow-md h-full flex flex-col`} title={formula}>
      <div className="flex justify-between items-start mb-6">
        <div className={`p-2 rounded-[6px] ${isAccent ? 'bg-[#171717]/10' : isWarning ? 'bg-white/20' : 'bg-white border border-[#e5e5e5]'}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="flex-1">
        <h3 className={`text-[13px] font-bold uppercase tracking-wider mb-2 opacity-80`}>{title}</h3>
        {breakdown && breakdown.length > 0 ? (
          <div className="space-y-3 mt-4">
            {breakdown.map((b, i) => (
              <div key={i} className="flex flex-col border-b border-black/5 pb-2 last:border-0">
                <span className="text-[11px] font-bold opacity-60">{b.Currency}</span>
                <span className="text-[24px] font-medium tracking-tight">
                  {formatCurrencyCompact(b.value, b.Currency, unit)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[32px] font-medium tracking-tight leading-none">{value}</p>
        )}
      </div>
      {subText && <p className={`text-[12px] mt-4 font-medium opacity-80`}>{subText}</p>}
    </div>
  )
}

const ExecutiveOverview: React.FC = () => {
  const { currency, fy, amountUnit } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getExecutiveOverview(currency, fy)
      setData(result)
    } catch (err: any) {
      setError('System connection error. Executive intelligence unavailable.')
      console.error('Error fetching executive overview:', err)
    } finally {
      setLoading(false)
    }
  }, [currency, fy])

  useEffect(() => { fetchData() }, [fetchData])

  if (loading) {
    return (
      <div className="p-12 animate-pulse space-y-12 min-h-screen bg-[#fafafa]">
        <div className="h-12 w-1/3 bg-[#f4f4f5] rounded-lg" />
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => <div key={i} className="h-40 bg-[#f4f4f5] rounded-[12px]" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-20 flex flex-col items-center justify-center text-center bg-[#fafafa] min-h-screen">
        <XCircle className="w-12 h-12 text-[#ff2201] mb-4 opacity-50" />
        <h3 className="text-[24px] font-medium text-[#171717] mb-2">Connectivity Offline</h3>
        <p className="text-[#707070] mb-8 max-w-sm">{error}</p>
        <button onClick={fetchData} className="px-6 py-2 bg-[#171717] text-white rounded-[6px] font-medium text-[14px] hover:bg-[#212121] transition-colors">
          Retry Connection
        </button>
      </div>
    )
  }

  if (!data) return null

  const { kpis, insights } = data

  return (
    <div className="bg-[#fafafa] min-h-screen font-sans">
      <section className="px-12 pt-16 pb-12 border-b border-[#dfdfdf] bg-white">
        <div className="max-w-[1400px] mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-[48px] font-medium text-[#171717] tracking-[-1.44px] leading-[1.1]">Executive Overview</h1>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-[18px] text-[#707070] font-normal leading-[1.4]">
                High-level treasury control tower.
              </p>
              <span className="text-[12px] font-bold text-[#64748b] bg-[#f4f4f5] px-2.5 py-1 rounded border border-[#e5e5e5]">
                Amount in Cr
              </span>
            </div>
          </div>
          {insights && insights.length > 0 && (
            <div className="hidden lg:flex items-center gap-2 bg-[#f4f4f5] px-4 py-2 rounded-[6px] border border-[#e5e5e5]">
               <div className="w-2 h-2 rounded-full bg-[#3ecf8e] animate-pulse" />
               <span className="text-[13px] font-medium text-[#171717]">{insights[0]}</span>
            </div>
          )}
        </div>
      </section>

      <section className="px-12 py-16">
        <div className="max-w-[1400px] mx-auto">
           {/* Section 1: Core Availability */}
           <div className="mb-12">
              <h2 className="text-[18px] font-medium text-[#171717] mb-6 flex items-center gap-2">
                 <Wallet className="w-5 h-5 text-[#707070]" />
                 Available Liquidity & Limits
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <MetricCard 
                    title="Available Cash" 
                    value={formatCurrencyCompact(kpis.available_cash, currency, amountUnit)} 
                    icon={Wallet} 
                    variant="accent"
                    currency={currency}
                    unit={amountUnit}
                 />
                 <MetricCard 
                    title="Available LC Limit" 
                    value={formatCurrencyCompact(kpis.available_lc_limit, currency, amountUnit)} 
                    icon={Shield} 
                    currency={currency}
                    unit={amountUnit}
                    formula="Total LC Limit - Utilized LC"
                 />
                 <MetricCard 
                    title="Available SBLC Limit" 
                    value={formatCurrencyCompact(kpis.available_sblc_limit, currency, amountUnit)} 
                    icon={Shield} 
                    currency={currency}
                    unit={amountUnit}
                    formula="Total SBLC Limit - Utilized SBLC"
                 />
              </div>
           </div>

           {/* Section 2: Total Facilities */}
           <div className="mb-12">
              <h2 className="text-[18px] font-medium text-[#171717] mb-6 flex items-center gap-2">
                 <Building2 className="w-5 h-5 text-[#707070]" />
                 Total Facilities & Utilisation
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <MetricCard 
                    title="Total NFB Limit" 
                    value={formatCurrencyCompact(kpis.total_nfb_limit, currency, amountUnit)} 
                    icon={CreditCard} 
                    currency={currency}
                    unit={amountUnit}
                    formula="Sum of all Non-Fund Based limits across all banks"
                 />
                 <MetricCard 
                    title="Total FB Limit" 
                    value={formatCurrencyCompact(kpis.total_fb_limit, currency, amountUnit)} 
                    icon={CreditCard} 
                    currency={currency}
                    unit={amountUnit}
                    formula="Sum of all Fund Based limits across all banks"
                 />
                 <MetricCard 
                    title="Total Utilisation" 
                    value={formatPercent(kpis.total_utilization_pct)} 
                    icon={Activity} 
                    subText="Percentage of NFB consumed"
                    currency={currency}
                    unit={amountUnit}
                    formula="(Total NFB Used / Total NFB Limit) * 100"
                 />
              </div>
           </div>

           {/* Section 3: Exposure & Blocked Capital */}
           <div className="mb-12">
              <h2 className="text-[18px] font-medium text-[#171717] mb-6 flex items-center gap-2">
                 <TrendingUp className="w-5 h-5 text-[#707070]" />
                 Active Exposure & Capital
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <MetricCard 
                    title="Total LC Exposure" 
                    value={formatCurrencyCompact(kpis.total_lc_exposure, currency, amountUnit)} 
                    icon={FileText} 
                    breakdown={kpis.breakdowns?.total_lc_exposure}
                    currency={currency}
                    unit={amountUnit}
                    formula="Aggregated value of all active Letters of Credit"
                 />
                 <MetricCard 
                    title="Total SBLC Exposure" 
                    value={formatCurrencyCompact(kpis.total_sblc_exposure, currency, amountUnit)} 
                    icon={FileText} 
                    currency={currency}
                    unit={amountUnit}
                    formula="Aggregated value of all active Standby Letters of Credit"
                 />
                 <MetricCard 
                    title="Working Capital Frozen" 
                    value={formatCurrencyCompact(kpis.working_capital_frozen, currency, amountUnit)} 
                    icon={Wallet} 
                    subText="Locked in Margin FDs"
                    breakdown={kpis.breakdowns?.working_capital_frozen}
                    currency={currency}
                    unit={amountUnit}
                    formula="Total Margin FDs lien-marked against active credit facilities"
                 />
              </div>
           </div>

           {/* Section 4: Risk & Forward Outlook */}
           <div>
              <h2 className="text-[18px] font-medium text-[#171717] mb-6 flex items-center gap-2">
                 <AlertCircle className="w-5 h-5 text-[#707070]" />
                 Risk & Forward Outlook
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <MetricCard 
                    title="Hedged Exposure" 
                    value={formatPercent(kpis.hedged_pct)} 
                    icon={Shield} 
                    currency={currency}
                    unit={amountUnit}
                    formula="(Value of Forward Contracts / Total FX Exposure) * 100"
                 />
                 <MetricCard 
                    title="Unhedged Exposure" 
                    value={formatPercent(kpis.unhedged_pct)} 
                    icon={AlertCircle} 
                    variant={kpis.unhedged_pct > 30 ? 'warning' : 'default'}
                    subText={kpis.unhedged_pct > 30 ? "Unhedged exposure exceeds 30% threshold" : ""}
                    currency={currency}
                    unit={amountUnit}
                    formula="100% - Hedged %"
                 />
                 <MetricCard 
                    title="30-Day Upcoming Payments" 
                    value={formatCurrencyCompact(kpis.upcoming_30d, currency, amountUnit)} 
                    icon={Clock} 
                    currency={currency}
                    unit={amountUnit}
                    formula="Sum of all LC/payment obligations due within the next 30 days"
                 />
                 />
              </div>
           </div>
        </div>
      </section>
    </div>
  )
}

export default ExecutiveOverview