/**
 * Operations — LC lifecycle funnel, BOE aging, shipment status and supplier
 * performance in one tab. Replaces LC Lifecycle, BOE Monitoring and
 * Track & Suppliers tabs.
 */
import React from 'react'
import { getBOEAnalytics, getInsights, getLifecycleTracker, getShipmentTracking, getTrendCohort } from '../../api'
import { useStore } from '../../store'
import { useFetch } from '../../shared/useFetch'
import { useMoney } from '../../shared/useMoney'
import {
  BarRow, Card, ErrorState, InsightStrip, MiniTable, PageHeader, PageSkeleton, Pill, Section, StatTile,
} from '../../shared/ui'
import { formatNumber, formatPercent } from '../../utils'

const OperationsView: React.FC = () => {
  const { currency, fy } = useStore()
  const fmt = useMoney()
  const { data, loading, error, reload } = useFetch(
    async () => {
      const [lifecycle, boe, shipment, cohort, insights] = await Promise.all([
        getLifecycleTracker(fy),
        getBOEAnalytics(currency, fy),
        getShipmentTracking(fy),
        getTrendCohort(currency),
        getInsights('operations', currency, fy),
      ])
      return { lifecycle: lifecycle as any[], boe, shipment, suppliers: cohort.supplier_cohort as any[], insights }
    },
    [currency, fy],
  )

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error || undefined} onRetry={reload} />

  const { lifecycle, boe, shipment, suppliers, insights } = data
  const funnelMax = Math.max(...lifecycle.map((s) => s.count), 1)

  return (
    <div className="page-in">
      <PageHeader title="Operations" subtitle="Lifecycle funnel, BOE aging, shipments and supplier performance" />
      <div className="p-4 space-y-5 max-w-[1500px]">
        <InsightStrip insights={insights} />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <StatTile 
            size="md" 
            label="Shipments Pending" 
            value={formatNumber(shipment.pending_count)} 
            sub="Awaiting dispatch" 
            metricId="ops-funnel"
            drillDownParams={{ status: 'Open' }}
          />
          <StatTile 
            size="md" 
            label="Shipments Done" 
            value={formatNumber(shipment.completed_count)} 
            sub="Dispatched to date" 
            metricId="ops-funnel"
            drillDownParams={{ status: 'Open' }}
          />
          <StatTile 
            size="md" 
            tone={shipment.delayed_count > 0 ? 'warning' : 'positive'}
            label="Delayed Receipts" 
            value={formatNumber(shipment.delayed_count)} 
            sub="Material after LC ship date" 
            metricId="ops-delayed"
            drillDownParams={{ status: 'Open' }}
          />
          <StatTile 
            size="md" 
            tone={shipment.expired_count > 0 ? 'critical' : 'positive'}
            label="Expired, Not Shipped" 
            value={formatNumber(shipment.expired_count)} 
            sub="LC lapsed without shipment" 
            metricId="ops-funnel"
            drillDownParams={{ status: 'Open' }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Section title="LC Lifecycle Funnel">
            <Card className="p-3 space-y-1.5">
              {lifecycle.map((stage, i) => {
                const conv = i > 0 && lifecycle[i - 1].count > 0
                  ? (stage.count / lifecycle[i - 1].count) * 100 : 100
                return (
                  <BarRow key={stage.stage} label={stage.stage}
                    pct={(stage.count / funnelMax) * 100}
                    color={i === lifecycle.length - 1 ? '#3ecf8e' : '#171717'}
                    inBarText={String(stage.count)} display=""
                    rightExtra={i > 0 ? formatPercent(conv, 0) : ''} />
                )
              })}
            </Card>
          </Section>

          <Section title="BOE Aging (Unpaid)">
            <Card className="p-3">
              <div className="space-y-1.5">
                {(boe.aging_buckets || []).map((b: any) => {
                  const maxVal = Math.max(...(boe.aging_buckets || []).map((x: any) => x.value || 0), 1)
                  const danger = b.bucket === '90+ Days' || b.bucket === '61-90 Days'
                  return (
                    <BarRow key={b.bucket} label={b.bucket}
                      pct={(b.value / maxVal) * 100}
                      color={danger ? '#dc2626' : '#d97706'}
                      display={fmt(b.value)} rightExtra={String(b.count)} labelWidth="w-[70px]" />
                  )
                })}
                {(boe.aging_buckets || []).length === 0 && (
                  <p className="text-[12px] text-[#707070] py-2">No unpaid BOE in aging buckets.</p>
                )}
              </div>
              <div className="mt-3 pt-2 border-t border-[#ededed] grid grid-cols-2 gap-1.5">
                {(boe.bifurcation || []).map((b: any) => (
                  <div key={b.status_group} className="flex items-center justify-between">
                    <span className="text-[10px] text-[#707070] truncate">{b.status_group}</span>
                    <span className="text-[11px] font-semibold tabular">{formatPercent(b.pct, 0)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Section>
        </div>

        <Section title="Supplier Exposure & Payment Discipline (Top 10)">
          <Card>
            <MiniTable
              rowKey={(r) => r.supplier}
              columns={[
                { key: 'supplier', label: 'Supplier', render: (r) => <span className="font-semibold truncate">{r.supplier}</span> },
                { key: 'exposure', label: 'Exposure', align: 'right', render: (r) => <span className="font-semibold">{fmt(r.exposure)}</span> },
                { key: 'payments', label: 'Paid', align: 'right', render: (r) => fmt(r.payments) },
                { key: 'overdues', label: 'Overdue', align: 'right', render: (r) => r.overdues > 0
                  ? <span className="text-[#dc2626] font-semibold">{fmt(r.overdues)}</span>
                  : <Pill tone="positive">Clear</Pill> },
              ]}
              rows={suppliers || []}
            />
          </Card>
        </Section>
      </div>
    </div>
  )
}

export default OperationsView
