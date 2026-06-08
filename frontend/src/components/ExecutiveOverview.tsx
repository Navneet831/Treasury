import React, { useEffect, useState, useCallback } from 'react'
import { getExecutiveOverview, getDrillDown } from '../api'
import { useStore } from '../store'
import KPICard from './KPICard'
import DrillDownModal from './DrillDownModal'
import { formatCurrencyCompact, formatNumber } from '../utils'
import {
  FileText,
  Building2,
  Users,
  Clock,
  AlertCircle,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  XCircle,
  ChevronRight
} from 'lucide-react'

const ExecutiveOverview: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [drillData, setDrillData] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await getExecutiveOverview(currency, fy)
      setData(result)
      setLastRefresh(new Date())
    } catch (err: any) {
      setError('System connection error. Executive intelligence unavailable.')
      console.error('Error fetching executive overview:', err)
    } finally {
      setLoading(false)
    }
  }, [currency, fy])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDrillDown = async (kpiKey: string, title: string) => {
    try {
      const result = await getDrillDown({ kpi: kpiKey, fy })
      setDrillData(result)
      setModalTitle(title)
      setIsModalOpen(true)
    } catch (e) { console.error(e) }
  }

  if (loading) {
    return (
      <div className="p-12 animate-pulse space-y-12">
        <div className="h-12 w-1/3 bg-[#f5f5f7] rounded-lg" />
        <div className="grid grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-[#f5f5f7] rounded-[18px]" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-20 flex flex-col items-center justify-center text-center">
        <XCircle className="w-12 h-12 text-[#dc2626] mb-4 opacity-20" />
        <h3 className="text-[24px] font-bold text-[#1d1d1f] mb-2">Connectivity Offline</h3>
        <p className="text-[#86868b] mb-8 max-w-sm">{error}</p>
        <button onClick={fetchData} className="px-6 py-3 bg-[#0066cc] text-white rounded-full font-bold text-[14px] hover:bg-[#0071e3] transition-colors">
          Retry Connection
        </button>
      </div>
    )
  }

  if (!data) return null

  const kpis = data.kpis

  return (
    <div className="bg-white min-h-screen">
      <section className="px-12 pt-16 pb-12">
        <div className="max-w-[1200px] mx-auto flex justify-between items-end">
          <div>
            <h1 className="text-[56px] font-bold text-[#1d1d1f] tracking-[-0.02em] leading-[1.07]">Intelligence.</h1>
            <p className="text-[24px] text-[#86868b] mt-4 font-normal tracking-tight leading-[1.4]">
              High-level decision metrics for treasury management.
            </p>
          </div>
          <p className="text-[12px] font-bold text-[#86868b] tracking-wider uppercase mb-2">Updated: {lastRefresh.toLocaleTimeString()}</p>
        </div>
      </section>

      <section className="px-12 pb-12">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <KPICard
            title="Open LC Value"
            value={formatCurrencyCompact(kpis.open_lc_value, currency)}
            description={`${formatNumber(kpis.open_lc_count)} Active instruments`}
            icon={<FileText />}
            onClick={() => handleDrillDown('open_lc', 'Currently Open LCs')}
          />
          <KPICard
            title="Counterparties"
            value={formatNumber(kpis.active_suppliers)}
            description="Active global suppliers"
            icon={<Users />}
          />
          <KPICard
            title="Bank Exposure"
            value={formatNumber(kpis.active_banks)}
            description="Participating institutions"
            icon={<Building2 />}
          />
          <KPICard
            title="Pending BOE"
            value={formatCurrencyCompact(kpis.pending_boe_value, currency)}
            description="Outstanding compliance value"
            icon={<AlertCircle />}
            variant={kpis.pending_boe_value > 0 ? 'warning' : 'default'}
            onClick={() => handleDrillDown('pending_boe', 'Pending Bill of Entries')}
          />
        </div>
      </section>

      <section className="px-12 pb-24">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Liquidity Alerts */}
          <div className="lg:col-span-2 space-y-8">
            <h2 className="text-[24px] font-bold text-[#1d1d1f]">Liquidity Operations</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                onClick={() => handleDrillDown('upcoming_7d', 'Payments Due in 7 Days')}
                className="p-8 rounded-[18px] border border-[#f0f0f0] hover:border-[#0066cc] cursor-pointer transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <Clock className="w-5 h-5 text-[#86868b] group-hover:text-[#0066cc]" />
                  <span className="text-[10px] font-bold text-[#0066cc] uppercase tracking-wider">7-Day Outlook</span>
                </div>
                <h3 className="text-[14px] font-bold text-[#86868b] uppercase tracking-tight mb-1">Upcoming Payments</h3>
                <p className="text-[32px] font-bold text-[#1d1d1f] tracking-tighter">{formatCurrencyCompact(kpis.upcoming_due_7d, currency)}</p>
                <p className="text-[12px] text-[#86868b] mt-4 flex items-center gap-1 group-hover:text-[#0066cc]">
                  View Maturity Schedule <ChevronRight className="w-4 h-4" />
                </p>
              </div>

              <div 
                onClick={() => handleDrillDown('overdue', 'Overdue Payments')}
                className="p-8 rounded-[18px] border border-[#f0f0f0] hover:border-[#dc2626] cursor-pointer transition-all group"
              >
                <div className="flex justify-between items-start mb-6">
                  <ShieldAlert className="w-5 h-5 text-[#dc2626]" />
                  <span className="text-[10px] font-bold text-[#dc2626] uppercase tracking-wider">Critical Risk</span>
                </div>
                <h3 className="text-[14px] font-bold text-[#86868b] uppercase tracking-tight mb-1">Overdue Portfolio</h3>
                <p className="text-[32px] font-bold text-[#dc2626] tracking-tighter">{formatCurrencyCompact(kpis.overdue_payments, currency)}</p>
                <p className="text-[12px] text-[#86868b] mt-4 flex items-center gap-1 group-hover:text-[#dc2626]">
                  Immediate Action Required <ChevronRight className="w-4 h-4" />
                </p>
              </div>
            </div>

            <div className="bg-[#f5f5f7] p-8 rounded-[24px]">
               <h3 className="text-[17px] font-bold text-[#1d1d1f] mb-6">Strategic Insights</h3>
               <ul className="space-y-4">
                 {data.insights.map((insight: string, idx: number) => (
                   <li key={idx} className="flex items-start gap-4 text-[14px] text-[#1d1d1f] font-medium leading-[1.5]">
                     <div className="w-1.5 h-1.5 rounded-full bg-[#0066cc] mt-1.5 flex-shrink-0" />
                     {insight}
                   </li>
                 ))}
               </ul>
            </div>
          </div>

          {/* Concentration Risk */}
          <div className="space-y-8">
            <h2 className="text-[24px] font-bold text-[#1d1d1f]">Risk Profile</h2>
            <div className="bg-white p-8 rounded-[18px] border border-[#f0f0f0]">
              <h3 className="text-[14px] font-bold text-[#86868b] uppercase tracking-wider mb-6">Top Bank Concentration</h3>
              <div className="flex items-end justify-between mb-4">
                <span className="text-[32px] font-bold text-[#1d1d1f] tracking-tighter">{data.top_bank_concentration.pct}%</span>
                <span className="text-[14px] font-bold text-[#86868b] mb-1">{data.top_bank_concentration.bank}</span>
              </div>
              <div className="w-full bg-[#f5f5f7] h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-[#0066cc] h-full transition-all duration-1000" 
                  style={{ width: `${data.top_bank_concentration.pct}%` }} 
                />
              </div>
              <p className="text-[12px] text-[#86868b] mt-6 leading-[1.5]">
                Exposure concentration at {data.top_bank_concentration.bank} should be monitored against internal diversification limits.
              </p>
            </div>

            <div className="bg-white p-8 rounded-[18px] border border-[#f0f0f0]">
              <div className="flex items-center gap-3 mb-4 text-[#d97706]">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-[14px] font-bold uppercase tracking-wider">Compliance Alert</span>
              </div>
              <p className="text-[14px] text-[#1d1d1f] font-medium leading-[1.5]">
                {kpis.expired_lcs} LCs have passed expiry but remain open in system.
              </p>
            </div>
          </div>
        </div>
      </section>

      <DrillDownModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalTitle}
        data={drillData}
      />
    </div>
  )
}

export default ExecutiveOverview
