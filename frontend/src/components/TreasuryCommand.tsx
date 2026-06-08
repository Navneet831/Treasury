import React, { useEffect, useState } from 'react'
import { getCommandData } from '../api'
import { useStore } from '../store'
import { formatCurrencyCompact, formatPercent, formatCurrency } from '../utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Activity, Shield, Wallet, ChevronRight } from 'lucide-react'

// Supabase-inspired colors but avoiding pure white backgrounds
const BRAND = {
  emerald: '#3ecf8e',
  emeraldDeep: '#24b47e',
  ink: '#171717',
  inkMute: '#707070',
  inkFaint: '#b2b2b2',
  surfaceLight: '#fafafa',
  surfaceMid: '#f4f4f5',
  surfaceDark: '#1c1c1c',
  hairline: '#e5e5e5',
}

const CHART_COLORS = [BRAND.emerald, '#212121', '#707070', '#a3a3a3', '#d4d4d4']

const MiniMetric: React.FC<{ label: string; value: string | number; subText?: string }> = ({ label, value, subText }) => (
  <div className="flex flex-col">
    <span className="text-[12px] font-medium text-[#707070] mb-1">{label}</span>
    <span className="text-[20px] font-medium text-[#171717] tracking-tight leading-none mb-1">{value}</span>
    {subText && <span className="text-[11px] text-[#9a9a9a]">{subText}</span>}
  </div>
)

const TreasuryCommand: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const result = await getCommandData(currency, fy)
        setData(result)
      } catch (e) {
        console.error("Failed to load command data", e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currency, fy])

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse bg-[#fafafa] min-h-screen">
        <div className="h-20 bg-[#f4f4f5] rounded-lg border border-[#e5e5e5]" />
        <div className="h-[400px] bg-[#f4f4f5] rounded-lg border border-[#e5e5e5]" />
      </div>
    )
  }

  if (!data) return <div className="p-12 text-center text-[#707070] bg-[#fafafa] min-h-screen">No data available.</div>

  const { summary, bank_wise, margin_wise, boe_status_wise, hedging_wise } = data

  return (
    <div className="bg-[#fafafa] min-h-screen p-6 md:p-8 font-sans">
      
      {/* Header Area */}
      <div className="flex items-center justify-between mb-8 max-w-[1400px] mx-auto">
        <div>
          <h1 className="text-[28px] font-medium text-[#171717] tracking-[-0.42px]">Treasury Command</h1>
          <p className="text-[14px] text-[#707070] mt-1">Real-time consolidated liquidity and limit intelligence.</p>
        </div>
        <button className="bg-[#3ecf8e] text-[#171717] hover:bg-[#24b47e] px-4 py-2 rounded-[6px] text-[14px] font-medium transition-colors">
          Optimize Limits
        </button>
      </div>

      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* Top Dense Metrics Strip */}
        <div className="bg-[#f4f4f5] border border-[#e5e5e5] rounded-[12px] p-6 flex flex-wrap gap-8 justify-between items-center shadow-sm">
          <MiniMetric label="Total NFB Limit" value={formatCurrencyCompact(summary.total_nfb_limit, currency)} subText={`${formatPercent(summary.limit_utilization_pct)} Utilized`} />
          <div className="w-[1px] h-10 bg-[#e5e5e5]" />
          <MiniMetric label="Available Liquidity" value={formatCurrencyCompact(summary.available_balance, currency)} subText="Ready to deploy" />
          <div className="w-[1px] h-10 bg-[#e5e5e5]" />
          <MiniMetric label="Total Exposure" value={formatCurrencyCompact(summary.total_lc_exposure, currency)} subText={`In Process: ${formatCurrencyCompact(summary.lc_in_process, currency)}`} />
          <div className="w-[1px] h-10 bg-[#e5e5e5]" />
          <MiniMetric label="SBLC Active" value={formatCurrencyCompact(summary.sblc_outstanding, currency)} subText="Standby Portfolio" />
          <div className="w-[1px] h-10 bg-[#e5e5e5]" />
          <MiniMetric label="Frozen Capital" value={formatCurrencyCompact(summary.working_capital_frozen, currency)} subText="Margin FDs" />
          <div className="w-[1px] h-10 bg-[#e5e5e5]" />
          <MiniMetric label="Outstanding Payables" value={formatCurrencyCompact(summary.outstanding_payables, currency)} subText="Unpaid Obligations" />
        </div>

        {/* Core Layout: 2 Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Visual: Bank Exposure (Col Span 2) */}
          <div className="lg:col-span-2 bg-[#f4f4f5] border border-[#e5e5e5] rounded-[12px] p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[16px] font-medium text-[#171717]">Counterparty Exposure</h2>
              <span className="text-[13px] text-[#707070] flex items-center gap-1 cursor-pointer hover:text-[#171717]">
                View All <ChevronRight className="w-3 h-3" />
              </span>
            </div>
            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bank_wise} margin={{ top: 0, right: 0, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                  <XAxis dataKey="bank" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#707070' }} angle={-25} textAnchor="end" />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#707070' }} tickFormatter={(v) => formatCurrencyCompact(v, currency)} />
                  <RechartsTooltip cursor={{ fill: '#efefef' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e5e5e5', backgroundColor: '#fafafa', fontSize: '13px', color: '#171717' }} />
                  <Bar dataKey="lc_outstanding" name="Outstanding" fill={BRAND.ink} radius={[4, 4, 0, 0]} barSize={32} />
                  <Bar dataKey="margin_fd" name="Margin FD" fill={BRAND.emerald} radius={[4, 4, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Compliance & Operations Stack */}
          <div className="space-y-6 flex flex-col">
             {/* BOE Status */}
             <div className="bg-[#1c1c1c] text-white border border-[#333] rounded-[12px] p-6 flex-1 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-medium text-white">BOE Compliance Pipeline</h2>
                  <Activity className="w-4 h-4 text-[#707070]" />
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={boe_status_wise} dataKey="value" nameKey="boe_status" cx="50%" cy="50%" innerRadius={50} outerRadius={75} stroke="none">
                        {boe_status_wise.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #333', backgroundColor: '#212121', fontSize: '13px', color: '#fff' }} />
                      <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#b2b2b2' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
             </div>

             {/* Type Concentration */}
             <div className="bg-[#f4f4f5] border border-[#e5e5e5] rounded-[12px] p-6 flex-1 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-medium text-[#171717]">Instrument Type Mix</h3>
                  <Shield className="w-4 h-4 text-[#707070]" />
                </div>
                <div className="space-y-4">
                  {hedging_wise.slice(0, 3).map((item: any, idx: number) => (
                    <div key={idx} className="space-y-1.5">
                       <div className="flex justify-between text-[13px] font-medium">
                          <span className="text-[#171717]">{item.type}</span>
                          <span className="text-[#707070]">{formatCurrencyCompact(item.value, currency)}</span>
                       </div>
                       <div className="w-full bg-[#e5e5e5] h-1.5 rounded-full overflow-hidden">
                          <div className="h-full bg-[#171717]" style={{ width: `${(item.value / summary.total_lc_exposure * 100).toFixed(0)}%` }} />
                       </div>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </div>

        {/* Bottom Row: Margin Categories Dense Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            <div className="col-span-2 md:col-span-4 lg:col-span-1 flex items-center">
               <div>
                  <h3 className="text-[16px] font-medium text-[#171717]">Margin Structure</h3>
                  <p className="text-[13px] text-[#707070] mt-1 leading-[1.4]">Bifurcation of capital requirements across exposure buckets.</p>
               </div>
            </div>
            {margin_wise.slice(0, 4).map((item: any, idx: number) => (
              <div key={idx} className="bg-[#f4f4f5] border border-[#e5e5e5] rounded-[12px] p-5 shadow-sm transition-colors hover:bg-[#efefef]">
                 <p className="text-[12px] text-[#707070] mb-2">{item.margin_pct}% Margin Bucket</p>
                 <p className="text-[24px] font-medium text-[#171717] tracking-tight">{formatCurrencyCompact(item.value, currency)}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

export default TreasuryCommand
