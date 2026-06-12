/**
 * Executive Overview — KPIs sized by importance + risk alerts + computed insights.
 * Replaces the old ExecutiveOverview (sparse hero cards) and RiskAlerts tabs.
 */
import React from 'react'
import { getExecutiveOverview, getInsights, getTreasuryActions } from '../../api'
import { useStore } from '../../store'
import { useFetch } from '../../shared/useFetch'
import { useMoney } from '../../shared/useMoney'
import {
  ErrorState, InsightStrip, PageHeader, PageSkeleton, Pill, Section, StatTile,
} from '../../shared/ui'
import { formatPercent } from '../../utils'

const OverviewView: React.FC = () => {
  const { currency, fy } = useStore()
  const fmt = useMoney()
  const { data, loading, error, reload } = useFetch(
    async () => {
      const [overview, actions, insights] = await Promise.all([
        getExecutiveOverview(currency, fy),
        getTreasuryActions(),
        getInsights('overview', currency, fy),
      ])
      return { overview, actions, insights }
    },
    [currency, fy],
  )

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error || undefined} onRetry={reload} />

  const { kpis } = data.overview
  const alerts = (data.actions || []).slice(0, 8)
  const sevTone = (p: number): 'critical' | 'warning' | 'default' =>
    p === 1 ? 'critical' : p === 2 ? 'warning' : 'default'

  return (
    <div className="page-in">
      <PageHeader
        title="Executive Overview"
        subtitle="Liquidity, exposure and risk — every figure from the warehouse"
        right={<Pill tone="default">₹ in Cr</Pill>}
      />
      <div className="p-4 space-y-5 max-w-[1500px]">
        <InsightStrip insights={data.insights} />

        {/* The defining numbers, sized by importance */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatTile size="hero" tone="accent" label="Available LC Limit" value={fmt(kpis.available_lc_limit)}
            sub={`of ${fmt(kpis.total_nfb_limit)} NFB limit`} title="Total LC Limit − Utilized LC" />
          <StatTile size="hero" tone={kpis.total_utilization_pct > 85 ? 'critical' : kpis.total_utilization_pct > 60 ? 'warning' : 'default'}
            label="Limit Utilisation" value={formatPercent(kpis.total_utilization_pct)}
            sub={`${fmt(kpis.total_lc_exposure)} LC exposure`} />
          <StatTile size="hero" tone={kpis.upcoming_30d > 0 ? 'warning' : 'positive'}
            label="Due in 30 Days" value={fmt(kpis.upcoming_30d)} sub="Unpaid obligations" />
          <StatTile size="hero" label="Working Capital Frozen" value={fmt(kpis.working_capital_frozen)}
            sub="Locked in margin FDs" title="Margin FDs lien-marked against open LCs" />
        </div>

        <Section title="Facilities & Liquidity">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <StatTile size="sm" label="Total NFB Limit" value={fmt(kpis.total_nfb_limit)} />
            <StatTile size="sm" label="Cash Credit Limit" value={fmt(kpis.total_fb_limit)}
              sub="Sanctioned FB limit" title="Live cash balance not yet integrated" />
            <StatTile size="sm" label="Available SBLC Limit" value={fmt(kpis.available_sblc_limit)} />
            <StatTile size="sm" label="SBLC Exposure" value={fmt(kpis.total_sblc_exposure)} />
            <StatTile size="sm" label="LC In Process" value={fmt(kpis.lc_in_process)} sub="Docs at bank" />
          </div>
        </Section>

        <Section title="FX Posture">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatTile size="sm" tone="positive" label="Hedged" value={formatPercent(kpis.hedged_pct)} />
            <StatTile size="sm" tone={kpis.unhedged_pct > 30 ? 'critical' : 'default'}
              label="Unhedged" value={formatPercent(kpis.unhedged_pct)}
              sub={kpis.unhedged_pct > 30 ? 'Above 30% policy threshold' : 'Within policy'} />
          </div>
        </Section>

        <Section title={`Action Queue (${alerts.length})`}>
          <div className="bg-white border border-[#dfdfdf] rounded-[8px] divide-y divide-[#ededed]">
            {alerts.length === 0 && (
              <p className="px-3 py-3 text-[12px] text-[#707070]">No pending treasury actions.</p>
            )}
            {alerts.map((a: any, i: number) => (
              <div key={i} className="px-3 py-2 flex items-center gap-2.5">
                <Pill tone={sevTone(a.priority)}>{a.type}</Pill>
                <p className="text-[12px] text-[#171717] truncate">{a.message}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

export default OverviewView
