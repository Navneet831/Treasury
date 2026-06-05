import React, { useEffect, useState } from 'react'
import { getStrategicIntelligence, getTreasuryRadar } from '../api'
import { useStore } from '../store'
import { formatCurrency } from '../utils'
import { 
  TrendingDown, 
  BarChart, 
  Activity,
  AlertOctagon,
  Percent
} from 'lucide-react'
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer
} from 'recharts'

const StrategicIntelligence: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [radarData, setRadarData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [intelResult, radarResult] = await Promise.all([
            getStrategicIntelligence(currency, fy),
            getTreasuryRadar(currency, fy)
        ])
        setData(intelResult)
        setRadarData(radarResult)
      } catch (error) {
        console.error('Error fetching strategic intelligence:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currency, fy])

  if (loading) return <div className="p-8">Compiling strategic intelligence report...</div>
  if (!data) return null

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="text-primary w-6 h-6" />
            Treasury Strategic Intelligence
        </h2>
        <p className="text-sm text-muted-foreground">McKinsey-style observations for yield optimization, risk mitigation, and efficiency.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Treasury Health Score & Cash Runway */}
        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-between">
          <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Treasury Health Score & Runway
              </h3>
              <p className="text-xs text-muted-foreground mb-6">Aggregate score based on limit utilization, cash runway, and pending obligations.</p>
              
              <div className="flex items-center gap-6">
                  <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-8 border-primary/10">
                      <p className="text-3xl font-black text-primary">{Math.round(data.health_score)}</p>
                      <svg className="absolute inset-0 w-full h-full transform -rotate-90 text-primary" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={`${data.health_score * 2.89} 289`} />
                      </svg>
                  </div>
                  <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase">Cash Runway</p>
                      <p className={`text-2xl font-black ${data.cash_runway_days < 30 ? 'text-red-600' : 'text-green-600'}`}>{Math.round(data.cash_runway_days)} Days</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Available Limit: {formatCurrency(data.remaining_limit, currency)}</p>
                  </div>
              </div>
          </div>
        </div>

        {/* Treasury Risk Radar */}
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Treasury Risk Radar (0-100)
          </h3>
          <p className="text-xs text-muted-foreground mb-6">Multi-dimensional risk exposure. Larger area equals higher systemic risk.</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Risk Exposure" dataKey="A" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Yield Optimization */}
        <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-between">
          <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Cost of Capital & Yield
              </h3>
              <p className="text-xs text-muted-foreground mb-6">Estimated opportunity cost of funds locked in Margin FDs vs 7% market yield.</p>
              
              <div className="space-y-4">
                  <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase">Total Margin FD Locked</p>
                      <p className="text-3xl font-black">{formatCurrency(data.yield_optimization.locked_fd, 'INR')}</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                      <p className="text-xs font-bold text-red-600 uppercase">Est. Annual Yield Lost</p>
                      <p className="text-2xl font-black text-red-800">{formatCurrency(data.yield_optimization.est_yield_lost_annual, 'INR')}</p>
                      <p className="text-[10px] text-red-700 mt-1 font-medium">Recommendation: Renegotiate margin requirements with top 2 banks to free up working capital.</p>
                  </div>
              </div>
          </div>
        </div>

        {/* Cost of Treasury Inefficiency */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4" />
            Quant Risk & Inefficiency Cost
          </h3>
          <p className="text-xs text-muted-foreground mb-4">Calculated capital drain from operational delays, overdue payments, and unhedged FX.</p>
          
          <div className="space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Total Inefficiency Cost</p>
                  <p className="text-lg font-black text-red-600">{formatCurrency(data.yield_optimization.cost_of_inefficiency, 'INR')}</p>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Working Cap Unlock Opp.</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(data.yield_optimization.working_capital_unlock, 'INR')}</p>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Expected FX Loss (VaR 3%)</p>
                  <p className="text-sm font-bold text-orange-600">{formatCurrency(data.yield_optimization.expected_fx_loss, 'INR')}</p>
              </div>
              <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-muted-foreground uppercase">Prob. of Liquidity Stress</p>
                  <p className="text-sm font-bold text-primary">{data.yield_optimization.prob_liquidity_stress.toFixed(1)}%</p>
              </div>
          </div>
        </div>

        {/* Advanced Quant Models */}
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Predictive Analytics & Forecasting Models
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
              <div className="p-4 border rounded-xl bg-muted/10">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">LC Closure Prediction</p>
                  <p className="text-2xl font-black text-primary">{Math.round(data.quant_models.lc_closure_avg_days)} Days</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Average time from Opening to Closure</p>
              </div>
              <div className="p-4 border rounded-xl bg-muted/10">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">LC Demand Forecast (30D)</p>
                  <p className="text-2xl font-black text-primary">{formatCurrency(data.quant_models.lc_demand_forecast_30d, currency)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Projected volume based on moving average</p>
              </div>
              <div className="p-4 border rounded-xl bg-muted/10">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Bank Dependency Risk</p>
                  <p className="text-2xl font-black text-orange-600">{data.quant_models.bank_dependency_risk_pct.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Exposure concentrated in top facility</p>
              </div>
              <div className="p-4 border rounded-xl bg-red-50 border-red-100">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">Future Stress Window</p>
                  <p className="text-lg font-black text-red-800">{data.quant_models.stress_window_start}</p>
                  <p className="text-xs font-bold text-red-600">{formatCurrency(data.quant_models.stress_window_val, currency)}</p>
                  <p className="text-[10px] text-red-700 mt-1">Highest 7-day concentrated outflow</p>
              </div>
          </div>
        </div>

        {/* Supplier Scorecard */}
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <BarChart className="w-4 h-4" />
            Supplier Reliability Scorecard
          </h3>
          <p className="text-xs text-muted-foreground mb-6">Ranking vendors by average delay between Shipment Date and BOE Submission.</p>
          
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
              {data.supplier_reliability.map((supp: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-lg hover:border-primary transition-colors min-w-[200px] flex-shrink-0">
                      <p className="text-xs font-bold truncate mb-2">{supp.supplier}</p>
                      <div className="flex items-end gap-2">
                          <p className={`text-2xl font-black ${supp.avg_delay_days > 20 ? 'text-red-600' : 'text-green-600'}`}>
                              {Math.round(supp.avg_delay_days)}
                          </p>
                          <span className="text-xs font-bold text-muted-foreground mb-1 tracking-widest uppercase">Days</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">{supp.tx_count} transactions analyzed</p>
                  </div>
              ))}
          </div>
        </div>

        {/* Bank Utilization */}
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <Percent className="w-4 h-4" />
            Facility Limit Utilization
          </h3>
          <p className="text-xs text-muted-foreground mb-6">Percentage of available LC limits currently utilized across active banks.</p>
          
          <div className="space-y-6">
              {data.bank_utilization.map((bank: any, idx: number) => {
                  const utilPct = bank.max_limit > 0 ? (bank.used_limit / bank.max_limit) * 100 : 0;
                  return (
                  <div key={idx} className="space-y-2">
                      <div className="flex justify-between items-end">
                          <p className="text-sm font-bold">{bank.bank}</p>
                          <div className="text-right">
                              <p className="text-xs font-bold">{utilPct.toFixed(1)}% Utilized</p>
                              <p className="text-[10px] text-muted-foreground">
                                  {formatCurrency(bank.used_limit, currency)} / {formatCurrency(bank.max_limit, currency)}
                              </p>
                          </div>
                      </div>
                      <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                          <div 
                              className={`h-full rounded-full ${utilPct > 85 ? 'bg-red-500' : utilPct > 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(utilPct, 100)}%` }}
                          />
                      </div>
                  </div>
              )})}
          </div>
        </div>

      </div>
    </div>
  )
}

export default StrategicIntelligence