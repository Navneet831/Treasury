/**
 * FX & Hedging — currency exposure, hedge coverage by product, and policy
 * compliance in one tab. Replaces the separate FX Exposure and Hedge Coverage tabs.
 */
import React from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getFXRisk, getHedgeCoverage, getInsights } from '../../api'
import { useStore } from '../../store'
import { useFetch } from '../../shared/useFetch'
import { useMoney } from '../../shared/useMoney'
import {
  Card, ErrorState, InsightStrip, MiniTable, PageHeader, PageSkeleton, Pill, Section, StatTile,
} from '../../shared/ui'
import { formatPercent } from '../../utils'

const FXView: React.FC = () => {
  const { currency, fy } = useStore()
  const fmtInr = useMoney('INR')
  const { data, loading, error, reload } = useFetch(
    async () => {
      const [fx, hedge, insights] = await Promise.all([
        getFXRisk(fy),
        getHedgeCoverage(currency, fy),
        getInsights('fx', currency, fy),
      ])
      return { fx, hedge, insights }
    },
    [currency, fy],
  )

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error || undefined} onRetry={reload} />

  const { fx, hedge, insights } = data
  const exposure: any[] = fx.exposure || []
  const totalExposure = exposure.reduce((s, e) => s + (e.exposure_inr || 0), 0)
  const chartData = exposure.map((e) => ({
    currency: e.currency, Hedged: e.hedged || 0, Unhedged: e.unhedged || 0,
  }))
  const s = hedge.summary

  return (
    <div className="page-in">
      <PageHeader title="FX & Hedging" subtitle="Currency exposure and hedge coverage of the unpaid book"
        right={<Pill tone={fx.total_unhedged_pct > 30 ? 'critical' : 'positive'}>
          {formatPercent(fx.total_unhedged_pct)} unhedged
        </Pill>} />
      <div className="p-4 space-y-5 max-w-[1500px]">
        <InsightStrip insights={insights} />

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <StatTile 
            size="hero" 
            label="FC Exposure" 
            value={fmtInr(totalExposure)}
            sub={`${exposure.length} currencies (INR value)`} 
            metricId="fx-exposure"
            drillDownParams={{ status: 'Open' }}
          />
          <StatTile 
            size="hero" 
            tone={fx.total_unhedged_pct > 30 ? 'critical' : 'positive'}
            label="Unhedged Share" 
            value={formatPercent(fx.total_unhedged_pct)}
            sub={fx.alert || 'Within policy threshold'} 
            metricId="fx-unhedged"
            drillDownParams={{ status: 'Open' }}
          />
          <StatTile 
            size="md" 
            tone="positive" 
            label="Hedged (Unpaid Book)" 
            value={fmtInr(s.hedged)}
            sub={`${formatPercent(s.hedge_pct)} of unpaid`} 
            metricId="fx-hedge-book"
            drillDownParams={{ payment_status: 'Unpaid' }}
          />
          <StatTile 
            size="md" 
            tone={s.unhedged > 0 ? 'warning' : 'default'}
            label="Open to FX (Unpaid)" 
            value={fmtInr(s.unhedged)} 
            sub={`${formatPercent(s.unhedged_pct)} of unpaid`} 
            metricId="fx-loss"
            drillDownParams={{ payment_status: 'Unpaid' }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <Section title="Hedged vs Unhedged by Currency" className="lg:col-span-2">
            <Card className="p-3">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ededed" />
                    <XAxis dataKey="currency" tick={{ fontSize: 10, fill: '#707070' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmtInr(v)} tick={{ fontSize: 9, fill: '#9a9a9a' }}
                      axisLine={false} tickLine={false} width={60} />
                    <Tooltip formatter={(v: any, n: any) => [fmtInr(Number(v)), n]}
                      contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #dfdfdf' }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />
                    <Bar dataKey="Hedged" stackId="a" fill="#3ecf8e" radius={[0, 0, 0, 0]} barSize={28} />
                    <Bar dataKey="Unhedged" stackId="a" fill="#dc2626" radius={[3, 3, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Section>

          <Section title="Currency Detail" className="lg:col-span-3">
            <Card>
              <MiniTable
                rowKey={(r) => r.currency}
                columns={[
                  { key: 'currency', label: 'CCY', render: (r) => <span className="font-semibold">{r.currency}</span> },
                  { key: 'exposure_fc', label: 'Exposure (FC)', align: 'right', render: (r) => (r.exposure_fc || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }) },
                  { key: 'exposure_inr', label: 'Exposure (INR)', align: 'right', render: (r) => <span className="font-semibold">{fmtInr(r.exposure_inr)}</span> },
                  { key: 'hedged', label: 'Hedged', align: 'right', render: (r) => fmtInr(r.hedged) },
                  { key: 'unhedged', label: 'Unhedged', align: 'right', render: (r) => <span className="text-[#dc2626] font-semibold">{fmtInr(r.unhedged)}</span> },
                  { key: 'hedge_pct', label: 'Coverage', align: 'right', render: (r) => (
                    <Pill tone={r.hedge_pct >= 70 ? 'positive' : r.hedge_pct >= 40 ? 'warning' : 'critical'}>
                      {formatPercent(r.hedge_pct)}
                    </Pill>
                  ) },
                ]}
                rows={exposure}
              />
            </Card>
          </Section>
        </div>

        <Section title="Unpaid Bills by Product — Hedge Status">
          <Card>
            <MiniTable
              rowKey={(r, i) => `${r.product}-${r.type}-${i}`}
              columns={[
                { key: 'product', label: 'Product', render: (r) => <span className="font-semibold">{r.product}</span> },
                { key: 'type', label: 'Type' },
                { key: 'hedge_status', label: 'Status', render: (r) => (
                  <Pill tone={r.hedge_status === 'Hedged' ? 'positive' : 'critical'}>{r.hedge_status}</Pill>
                ) },
                { key: 'lc_count', label: 'Bills', align: 'right' },
                { key: 'unpaid_fc', label: 'Unpaid (FC)', align: 'right', render: (r) => `${r.currency} ${(r.unpaid_fc || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` },
                { key: 'unpaid_inr', label: 'Unpaid (INR)', align: 'right', render: (r) => <span className="font-semibold">{fmtInr(r.unpaid_inr)}</span> },
              ]}
              rows={hedge.products || []}
            />
          </Card>
        </Section>
      </div>
    </div>
  )
}

export default FXView
