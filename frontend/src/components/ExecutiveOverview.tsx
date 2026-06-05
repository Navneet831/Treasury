import React, { useEffect, useState, useCallback } from 'react'
import { getExecutiveOverview, getDrillDown } from '../api'
import { useStore } from '../store'
import KPICard from './KPICard'
import DrillDownModal from './DrillDownModal'
import { formatCurrencyCompact, formatNumber, formatPercent } from '../utils'
import {
  FileText,
  Building2,
  Users,
  Clock,
  AlertCircle,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Zap
} from 'lucide-react'

const HealthGauge: React.FC<{ score: number }> = ({ score }) => {
  const color = score >= 75 ? 'hsl(var(--success))' : score >= 50 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))'
  const label = score >= 75 ? 'Healthy' : score >= 50 ? 'Moderate' : 'Critical'
  return (
    <div className="relative flex items-center justify-center flex-col">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round" />
        {/* Value arc */}
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 157} 157`}
        />
        <text x="60" y="55" textAnchor="middle" fontSize="22" fontWeight="900" fill={color}>
          {Math.round(score)}
        </text>
      </svg>
      <span className="text-xs font-bold mt-1" style={{ color }}>{label}</span>
    </div>
  )
}

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
      setError('Failed to load executive overview. Check API connection.')
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white border rounded-xl p-6 shadow-sm animate-pulse">
              <div className="h-3 w-24 bg-muted rounded mb-3" />
              <div className="h-8 w-32 bg-muted rounded mb-2" />
              <div className="h-3 w-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 h-[400px]">
        <XCircle className="w-12 h-12 text-destructive" />
        <p className="text-destructive font-bold">{error}</p>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const kpis = data.kpis
  const healthScore = kpis.treasury_health_score || 0

  // CFO Decision Box items
  const decisions: Array<{ level: 'red' | 'orange' | 'green', message: string }> = []
  if (kpis.overdue_payments > 0) decisions.push({ level: 'red', message: `₹${(kpis.overdue_payments / 1e7).toFixed(2)} Cr payments are OVERDUE — immediate action needed` })
  if (kpis.expired_lcs > 0) decisions.push({ level: 'red', message: `${kpis.expired_lcs} LCs have expired while still Open — must be closed/amended` })
  if (kpis.upcoming_due_7d > 0) decisions.push({ level: 'orange', message: `${currency} ${formatCurrencyCompact(kpis.upcoming_due_7d, currency)} due within 7 days — arrange liquidity now` })
  if (kpis.limit_utilization_pct > 85) decisions.push({ level: 'orange', message: `Limit utilization at ${kpis.limit_utilization_pct}% — near exhaustion, talk to banks` })
  if (kpis.upcoming_due_30d > 0) decisions.push({ level: 'orange', message: `${formatCurrencyCompact(kpis.upcoming_due_30d, currency)} payable in next 30 days — plan cash reserves` })
  if (data.top_bank_concentration?.pct > 50) decisions.push({ level: 'orange', message: `${data.top_bank_concentration.bank} holds ${data.top_bank_concentration.pct}% of exposure — diversify` })
  if (decisions.length === 0) decisions.push({ level: 'green', message: 'No critical actions required today — treasury is stable.' })

  return (
    <div className="p-10 space-y-8 min-h-[calc(100vh-64px)] animate-slide-up-fade bg-grid-pattern text-balance relative">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Executive Overview</h2>
          <p className="text-xs text-muted-foreground mt-1">Last refreshed: {lastRefresh.toLocaleTimeString()}</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-bold hover:bg-muted transition-colors">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Row 1 — Core KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Open LC Value"
          value={formatCurrencyCompact(kpis.open_lc_value, currency)}
          description={`${formatNumber(kpis.open_lc_count)} active LCs`}
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
          value={formatCurrencyCompact(kpis.pending_boe_value, currency)}
          description="Bill of Entry outstanding"
          icon={<AlertCircle />}
          onClick={() => handleDrillDown('pending_boe', 'Pending Bill of Entries')}
        />
      </div>

      {/* Row 2 — Payments & Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Upcoming Payments (7D)"
          value={formatCurrencyCompact(kpis.upcoming_due_7d, currency)}
          description="Unpaid obligations due this week"
          icon={<Clock />}
          variant={kpis.upcoming_due_7d > 0 ? 'warning' : 'default'}
          onClick={() => handleDrillDown('upcoming_7d', 'Payments Due in 7 Days')}
        />
        <KPICard
          title="Upcoming Payments (30D)"
          value={formatCurrencyCompact(kpis.upcoming_due_30d, currency)}
          description="Next month's cash requirement"
          icon={<Clock />}
          onClick={() => handleDrillDown('upcoming_30d', 'Payments Due in 30 Days')}
        />
        <KPICard
          title="Overdue Payments"
          value={formatCurrencyCompact(kpis.overdue_payments, currency)}
          description="Past maturity, unpaid"
          icon={<ShieldAlert />}
          variant={kpis.overdue_payments > 0 ? 'danger' : 'default'}
          onClick={() => handleDrillDown('overdue', 'Overdue Payments')}
        />
        <KPICard
          title="Expired LCs (Open)"
          value={formatNumber(kpis.expired_lcs)}
          description="Expired but still open — action needed"
          icon={<AlertTriangle />}
          variant={kpis.expired_lcs > 0 ? 'danger' : 'default'}
        />
      </div>

      {/* Row 3 — Limit & Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Treasury Health Score */}
        <div className="glass-card rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-primary" />
              Treasury Health
            </h3>
            <p className="text-[10px] text-muted-foreground leading-tight">Multi-factor risk & liquidity score</p>
          </div>
          <div className="flex-1 flex items-center justify-center mt-6">
            <HealthGauge score={healthScore} />
            <div className="space-y-2 flex-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Limit Utilization</span>
                <span className={`font-bold ${kpis.limit_utilization_pct > 80 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatPercent(kpis.limit_utilization_pct)}
                </span>
              </div>
              <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${kpis.limit_utilization_pct > 85 ? 'bg-red-500' : kpis.limit_utilization_pct > 60 ? 'bg-orange-500' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(kpis.limit_utilization_pct || 0, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs mt-2">
                <span className="text-muted-foreground">Available Limit</span>
                <span className="font-bold text-green-600">{formatCurrencyCompact(kpis.available_lc_limit, currency)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Closing This Month</span>
                <span className="font-bold">{kpis.lcs_closing_this_month}</span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insights */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Executive AI Insights
          </h3>
          <ul className="space-y-3">
            {data.insights.map((insight: string, idx: number) => (
              <li key={idx} className="flex gap-3 text-sm p-3 bg-muted/30 rounded-lg">
                <span className="text-primary mt-0.5">•</span>
                <span className="leading-relaxed">{insight}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* CFO Decision Box */}
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            CFO Decision Box
          </h3>
          <p className="text-xs text-muted-foreground mb-4">What requires your attention today?</p>
          <div className="space-y-3">
            {decisions.map((d, idx) => (
              <div key={idx} className={`flex gap-3 p-3 rounded-lg text-sm ${
                d.level === 'red' ? 'bg-red-50 border border-red-100' :
                d.level === 'orange' ? 'bg-orange-50 border border-orange-100' :
                'bg-green-50 border border-green-100'
              }`}>
                {d.level === 'red' ? <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" /> :
                 d.level === 'orange' ? <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" /> :
                 <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />}
                <span className={`font-medium text-xs leading-relaxed ${
                  d.level === 'red' ? 'text-red-800' : d.level === 'orange' ? 'text-orange-800' : 'text-green-800'
                }`}>{d.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DrillDownModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={drillData} title={modalTitle} />
    </div>
  )
}

export default ExecutiveOverview
