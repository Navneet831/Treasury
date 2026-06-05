import React, { useEffect, useState } from 'react'
import { getStrategicIntelligence } from '../api'
import { useStore } from '../store'
import { formatCurrency } from '../utils'
import { 
  TrendingDown, 
  BarChart, 
  Activity,
  AlertOctagon,
  Percent
} from 'lucide-react'

const StrategicIntelligence: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getStrategicIntelligence(currency, fy)
        setData(result)
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
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

        {/* Tolerance Variance */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4" />
            Tolerance & Variance Analysis
          </h3>
          <p className="text-xs text-muted-foreground mb-6">Capital efficiency lost due to over-issuance vs actual reduction amounts.</p>
          
          <div className="flex flex-col items-center justify-center h-40">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Total Variance Detected</p>
              <p className="text-4xl font-black text-orange-600">{formatCurrency(data.tolerance_variance, 'INR')}</p>
              <p className="text-xs text-center text-muted-foreground max-w-sm mt-4">
                  High variance indicates systematic over-estimation of LC amounts, unnecessarily locking up bank limits.
              </p>
          </div>
        </div>

        {/* Supplier Scorecard */}
        <div className="bg-white p-6 rounded-xl border shadow-sm lg:col-span-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
            <BarChart className="w-4 h-4" />
            Supplier Reliability Scorecard
          </h3>
          <p className="text-xs text-muted-foreground mb-6">Ranking vendors by average delay between Shipment Date and BOE Submission.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {data.supplier_reliability.map((supp: any, idx: number) => (
                  <div key={idx} className="p-4 border rounded-lg hover:border-primary transition-colors">
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