import React, { useEffect, useState } from 'react'
import { getExecutiveOverview, getDrillDown } from '../api'
import { useStore } from '../store'
import KPICard from './KPICard'
import DrillDownModal from './DrillDownModal'
import { formatCurrency, formatNumber } from '../utils'
import { 
  FileText, 
  Building2, 
  Users, 
  Clock, 
  AlertCircle, 
  TrendingUp,
  ShieldAlert
} from 'lucide-react'

const ExecutiveOverview: React.FC = () => {
  const { currency, fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [drillData, setDrillData] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getExecutiveOverview(currency, fy)
        setData(result)
      } catch (error) {
        console.error('Error fetching executive overview:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currency, fy])

  const handleDrillDown = async (kpiKey: string, title: string) => {
      try {
          const result = await getDrillDown({ kpi: kpiKey, fy })
          setDrillData(result)
          setModalTitle(title)
          setIsModalOpen(true)
      } catch (e) { console.error(e) }
  }

  if (loading) {
    return <div className="p-8 flex justify-center items-center h-full">Loading insights...</div>
  }

  if (!data) return null

  const kpis = data.kpis

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Open LC Value" 
          value={formatCurrency(kpis.open_lc_value, currency)}
          description={`Across ${kpis.open_lc_count} active LCs`}
          icon={<FileText />}
          onClick={() => handleDrillDown('open_lc', 'Currently Open LCs')}
        />
        <KPICard 
          title="Active Banks" 
          value={formatNumber(kpis.active_banks)}
          description="Total participating banks"
          icon={<Building2 />}
        />
        <KPICard 
          title="Active Suppliers" 
          value={formatNumber(kpis.active_suppliers)}
          description="Total active counterparts"
          icon={<Users />}
        />
        <KPICard 
          title="Pending BOE Value" 
          value={formatCurrency(kpis.pending_boe_value, currency)}
          description="Bill of Entry outstanding"
          icon={<AlertCircle />}
          onClick={() => handleDrillDown('pending_boe', 'Pending Bill of Entries')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <KPICard 
          title="Upcoming Payments (7D)" 
          value={formatCurrency(kpis.upcoming_due_7d, currency)}
          description="Cash requirement next week"
          icon={<Clock />}
          onClick={() => handleDrillDown('upcoming_7d', 'Payments Due in 7 Days')}
        />
        <KPICard 
          title="Upcoming Payments (30D)" 
          value={formatCurrency(kpis.upcoming_due_30d, currency)}
          description="Cash requirement next month"
          icon={<Clock />}
          onClick={() => handleDrillDown('upcoming_30d', 'Payments Due in 30 Days')}
        />
         <KPICard 
          title="Overdue Payments" 
          value={formatCurrency(kpis.overdue_payments, currency)}
          description="Immediate attention required"
          icon={<ShieldAlert />}
          onClick={() => handleDrillDown('overdue', 'Overdue Payments')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Executive AI Insights
          </h3>
          <ul className="space-y-4">
            {data.insights.map((insight: string, idx: number) => (
              <li key={idx} className="flex gap-3 text-sm p-3 bg-muted/30 rounded-lg">
                <span className="text-primary mt-0.5">•</span>
                <span className="leading-relaxed">{insight}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            Operational Alerts
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/30 transition-colors">
              <span className="text-sm font-medium">Expired LCs (Action Required)</span>
              <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                {kpis.expired_lcs}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted/30 transition-colors">
              <span className="text-sm font-medium">LCs Closing This Month</span>
              <span className="px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                {kpis.lcs_closing_this_month}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <DrillDownModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={drillData} title={modalTitle} />
    </div>
  )
}

export default ExecutiveOverview
