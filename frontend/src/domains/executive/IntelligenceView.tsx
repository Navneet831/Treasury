/**
 * Intelligence — strategic posture and quantitative risk in ONE view (no
 * subtabs: scores → cost of capital → models → stress → counterparties).
 * Replaces the StrategicIntelligence / AdvancedQuant pair.
 */
import React from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, PolarAngleAxis, PolarGrid, PolarRadiusAxis,
  Radar, RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getAdvancedQuant, getStrategicIntelligence, getTreasuryRadar } from '../../api'
import { useStore } from '../../store'
import { useFetch } from '../../shared/useFetch'
import { useMoney } from '../../shared/useMoney'
import {
  BarRow, Card, ErrorState, MiniTable, PageHeader, PageSkeleton, Pill, Section, StatTile,
} from '../../shared/ui'
import { formatPercent } from '../../utils'

const IntelligenceView: React.FC = () => {
  const { currency, fy } = useStore()
  const fmt = useMoney('INR')
  const { data, loading, error, reload } = useFetch(
    async () => {
      const [intel, quant, radar] = await Promise.all([
        getStrategicIntelligence(currency, fy),
        getAdvancedQuant(currency, fy),
        getTreasuryRadar(currency, fy),
      ])
      return { intel, quant, radar: radar as any[] }
    },
    [currency, fy],
  )

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error || undefined} onRetry={reload} />

  const { intel, quant, radar } = data
  const yo = intel.yield_optimization
  const qm = intel.quant_models
  const ewi = quant.early_warning_index
  const stressTests: any[] = quant.stress_tests || []
  const maxUtil = Math.max(150, ...stressTests.map((s) => s.utilization + 10))
  const healthTone = intel.health_score >= 70 ? 'positive' : intel.health_score >= 40 ? 'warning' : 'critical'
  const runwayTone = intel.cash_runway_days >= 60 ? 'positive' : intel.cash_runway_days >= 30 ? 'warning' : 'critical'
  const ewiTone = ewi > 75 ? 'critical' : ewi > 50 ? 'warning' : 'positive'

  return (
    <div className="page-in">
      <PageHeader
        title="Intelligence"
        subtitle="Strategic posture, quant models and stress testing — one view, all live"
        right={<Pill tone={ewiTone}>EWI {Math.round(ewi)}</Pill>}
      />
      <div className="p-4 space-y-5 max-w-[1500px]">

        {/* The four scores that decide whether anything below needs attention */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatTile size="hero" tone={healthTone} label="Treasury Health" value={`${Math.round(intel.health_score)}/100`}
            sub="Utilization + overdue + unhedged composite" />
          <StatTile size="hero" tone={runwayTone} label="Cash Runway" value={`${Math.round(intel.cash_runway_days)} days`}
            sub="Headroom ÷ avg daily obligations" />
          <StatTile size="hero" tone={ewiTone} label="Early Warning Index" value={`${Math.round(ewi)}/100`}
            sub="Utilization · stress · FX · overdue" />
          <StatTile size="hero" tone="warning" label="Liquidity-at-Risk (95%)" value={fmt(quant.liquidity_at_risk)}
            sub={`μ ${fmt(quant.lar_mean)} + 1.645σ (${fmt(quant.lar_stddev)})`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <Section title="Risk Radar (0–100)" className="lg:col-span-2">
            <Card className="p-2">
              <div className="h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="78%" data={radar}>
                    <PolarGrid stroke="#ededed" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#707070', fontSize: 9, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar name="Risk" dataKey="A" stroke="#dc2626" fill="#dc2626" fillOpacity={0.15} strokeWidth={1.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Section>

          <Section title={`Cost of Capital & Yield (${yo.yield_rate_pct.toFixed(1)}% market yield)`} className="lg:col-span-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <StatTile size="md" label="Margin FD Locked" value={fmt(yo.locked_fd)} sub="Working capital frozen" />
              <StatTile size="md" tone="critical" label="Yield Lost / Year" value={fmt(yo.est_yield_lost_annual)}
                sub={`At ${yo.yield_rate_pct.toFixed(1)}% opportunity rate`} />
              <StatTile size="md" tone="positive" label="WC Unlock Potential" value={fmt(yo.working_capital_unlock)}
                sub="Capital + annual carry" />
              <StatTile size="sm" tone="warning" label="Inefficiency Cost" value={fmt(yo.cost_of_inefficiency)}
                sub="Delayed BOE + overdue penalties" />
              <StatTile size="sm" tone="warning" label={`Expected FX Loss (VaR ${yo.fx_var_rate_pct.toFixed(0)}%)`}
                value={fmt(yo.expected_fx_loss)} sub="On unhedged open exposure" />
              <StatTile size="sm" tone={yo.prob_liquidity_stress > 50 ? 'critical' : yo.prob_liquidity_stress > 25 ? 'warning' : 'default'}
                label="Liquidity Stress Prob." value={formatPercent(yo.prob_liquidity_stress)} sub="30-day dues vs headroom" />
            </div>
            <p className="text-[11px] text-[#707070] mt-2">
              → Renegotiating margin requirements with the two largest banks is the single biggest working-capital lever.
            </p>
          </Section>
        </div>

        <Section title="Predictive Models">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <StatTile size="md" label="Avg LC Cycle" value={`${Math.round(qm.lc_closure_avg_days)} days`}
              sub="Opening to closure, observed" />
            <StatTile size="md" label="30-Day Demand Forecast" value={fmt(qm.lc_demand_forecast_30d)}
              sub="3-month moving average of openings" />
            <StatTile size="md" tone={qm.bank_dependency_risk_pct > 60 ? 'warning' : 'default'}
              label="Bank Dependency" value={formatPercent(qm.bank_dependency_risk_pct)}
              sub="Exposure share of top facility" />
            <StatTile size="md" tone="critical" label="Stress Window"
              value={qm.stress_window_start || '—'}
              sub={qm.stress_window_val > 0 ? `${fmt(qm.stress_window_val)} in 7 days` : 'No future dues'} />
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Section title="Stress Scenarios — Limit Utilization Impact">
            <Card className="p-3">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stressTests} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#ededed" />
                    <XAxis type="number" domain={[0, maxUtil]} hide />
                    <YAxis dataKey="scenario" type="category" axisLine={false} tickLine={false}
                      tick={{ fontSize: 9, fontWeight: 600, fill: '#707070' }} width={170} />
                    <Tooltip
                      formatter={(value: any, name: any) => [
                        name === 'utilization' ? `${Number(value).toFixed(1)}%` : fmt(Number(value)),
                        name === 'utilization' ? 'Limit Utilized' : 'Stressed Exposure',
                      ]}
                      contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #dfdfdf' }}
                    />
                    <Bar dataKey="utilization" barSize={14} radius={[0, 3, 3, 0]}>
                      {stressTests.map((entry, index) => (
                        <Cell key={index}
                          fill={entry.utilization > 100 ? '#dc2626' : entry.utilization > 85 ? '#d97706' : '#3ecf8e'} />
                      ))}
                    </Bar>
                    <ReferenceLine x={100} stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 4"
                      label={{ value: '100%', position: 'insideTopRight', fontSize: 9, fill: '#dc2626' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Section>

          <Section title="Facility Utilization">
            <Card className="p-3 space-y-2.5">
              {(intel.bank_utilization || []).map((bank: any) => {
                const pct = bank.max_limit > 0 ? (bank.used_limit / bank.max_limit) * 100 : 0
                return (
                  <BarRow key={bank.bank} label={bank.bank} pct={pct}
                    color={pct > 85 ? '#dc2626' : pct > 60 ? '#d97706' : '#3ecf8e'}
                    display={`${fmt(bank.used_limit)} / ${fmt(bank.max_limit)}`}
                    rightExtra={`${pct.toFixed(0)}%`} labelWidth="w-[60px]" />
                )
              })}
            </Card>
          </Section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Section title="Supplier Reliability (Shipment → BOE, slowest first)">
            <Card>
              <MiniTable
                rowKey={(r) => r.supplier}
                columns={[
                  { key: 'supplier', label: 'Supplier', render: (r) => <span className="font-semibold truncate">{r.supplier}</span> },
                  { key: 'avg_delay_days', label: 'Avg Delay', align: 'right', render: (r) => (
                    <Pill tone={r.avg_delay_days > 20 ? 'critical' : r.avg_delay_days > 10 ? 'warning' : 'positive'}>
                      {Math.round(r.avg_delay_days)}d
                    </Pill>
                  ) },
                  { key: 'tx_count', label: 'Txns', align: 'right' },
                ]}
                rows={intel.supplier_reliability || []}
              />
            </Card>
          </Section>

          <Section title="Bank → Supplier Concentration (Open LCs)">
            <Card>
              <MiniTable
                rowKey={(r, i) => `${r.source}-${r.target}-${i}`}
                columns={[
                  { key: 'source', label: 'Bank', render: (r) => <span className="font-semibold">{r.source}</span> },
                  { key: 'target', label: 'Supplier', render: (r) => <span className="truncate">{r.target}</span> },
                  { key: 'value', label: 'Exposure', align: 'right', render: (r) => <span className="font-semibold">{fmt(r.value)}</span> },
                ]}
                rows={quant.network || []}
              />
              {(quant.network || []).length === 0 && (
                <p className="px-3 py-3 text-[12px] text-[#707070]">No open bank–supplier pipelines.</p>
              )}
            </Card>
          </Section>
        </div>
      </div>
    </div>
  )
}

export default IntelligenceView
