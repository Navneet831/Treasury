/**
 * Cash Flow — forecast with CI bands, opening/closure trend, due trend and
 * cohort performance in one insight-dense tab. Replaces the separate
 * Cash Forecast and Trend Analysis tabs.
 */
import React from 'react'
import {
  Area, Bar, CartesianGrid, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { getCashFlowForecast, getCohortAnalysis, getInsights, getTrendAnalysis } from '../../api'
import { useStore } from '../../store'
import { useFetch } from '../../shared/useFetch'
import { useMoney } from '../../shared/useMoney'
import {
  Card, ChartTip, ErrorState, InsightStrip, MiniTable, PageHeader, PageSkeleton, Pill, Section, StatTile,
} from '../../shared/ui'
import { formatPercent } from '../../utils'

const CashFlowView: React.FC = () => {
  const { currency, fy } = useStore()
  const fmt = useMoney()
  const { data, loading, error, reload } = useFetch(
    async () => {
      const [forecast, trend, cohort, insights] = await Promise.all([
        getCashFlowForecast(currency, fy),
        getTrendAnalysis(currency, fy),
        getCohortAnalysis(currency, fy),
        getInsights('cashflow', currency, fy),
      ])
      return { forecast: forecast as any[], trend, cohort: cohort as any[], insights }
    },
    [currency, fy],
  )

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error || undefined} onRetry={reload} />

  const { forecast, cohort, insights } = data
  const total = forecast.reduce((s, d) => s + (d.monthly_value || 0), 0)
  const avg = forecast.length ? total / forecast.length : 0
  const peak = forecast.reduce((m, d) => ((d.monthly_value || 0) > (m?.monthly_value || 0) ? d : m), forecast[0])

  const openingTrend = (data.trend?.monthly_opening_trend || []).map((d: any) => ({
    month: String(d.month || '').slice(0, 7),
    opened: d.opened_value, closed: d.closed_value, net: d.net_exposure,
  }))
  const dueTrend = (data.trend?.monthly_due_trend || []).map((d: any) => ({
    month: String(d.month || '').slice(0, 7), due: d.due_value,
  }))

  return (
    <div className="page-in">
      <PageHeader title="Cash Flow" subtitle="Forward obligations, trend and cohort performance"
        right={<Pill tone="default">95% CI from monthly variance</Pill>} />
      <div className="p-4 space-y-5 max-w-[1500px]">
        <InsightStrip insights={insights} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <StatTile size="hero" label="Total Forecast" value={fmt(total)} sub={`${forecast.length} months ahead`} />
          <StatTile size="hero" tone="warning" label="Peak Month" value={peak?.month || '—'}
            sub={peak ? `${fmt(peak.monthly_value)} due` : 'No future dues'} />
          <StatTile size="md" label="Monthly Average" value={fmt(avg)} sub="Planning baseline" />
          <StatTile size="md" label="Obligations" value={String(forecast.reduce((s, d) => s + (d.lc_count || 0), 0))}
            sub="Unpaid bills in horizon" />
        </div>

        <Section title="Payment Projection with Confidence Band">
          <Card className="p-3">
            <div className="h-[230px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={forecast} margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ededed" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#707070' }} />
                  <YAxis tickFormatter={(v) => fmt(v)} axisLine={false} tickLine={false}
                    tick={{ fontSize: 9, fill: '#9a9a9a' }} width={64} />
                  <Tooltip content={<ChartTip fmt={fmt} />} />
                  <Legend verticalAlign="top" align="right" height={24}
                    wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />
                  <Area dataKey="confidence_upper" name="Upper CI" fill="#ededed" stroke="transparent" fillOpacity={0.6} />
                  <Area dataKey="confidence_lower" name="Lower CI" fill="#ffffff" stroke="transparent" fillOpacity={1} />
                  <Bar dataKey="monthly_value" name="Expected" fill="#171717" radius={[3, 3, 0, 0]} barSize={20} />
                  <Line type="monotone" dataKey="cumulative_value" name="Cumulative"
                    stroke="#24b47e" strokeWidth={2} dot={{ r: 2.5, fill: '#24b47e' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Section title="LC Opening vs Closure (Monthly)">
            <Card className="p-3">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={openingTrend} margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ededed" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#707070' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 9, fill: '#9a9a9a' }}
                      axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<ChartTip fmt={fmt} />} />
                    <Bar dataKey="opened" name="Opened" fill="#3ecf8e" radius={[3, 3, 0, 0]} barSize={12} />
                    <Bar dataKey="closed" name="Closed" fill="#c7c7c7" radius={[3, 3, 0, 0]} barSize={12} />
                    <Line type="monotone" dataKey="net" name="Net" stroke="#171717" strokeWidth={1.5} dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Section>
          <Section title="Monthly Due Obligations">
            <Card className="p-3">
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dueTrend} margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ededed" />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#707070' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 9, fill: '#9a9a9a' }}
                      axisLine={false} tickLine={false} width={60} />
                    <Tooltip content={<ChartTip fmt={fmt} />} />
                    <Bar dataKey="due" name="Due" fill="#d97706" radius={[3, 3, 0, 0]} barSize={14} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </Section>
        </div>

        <Section title="Cohort Performance by Opening Month">
          <Card>
            <MiniTable
              rowKey={(r) => r.cohort_month}
              columns={[
                { key: 'cohort_month', label: 'Cohort', render: (r) => <span className="font-semibold">{String(r.cohort_month).slice(0, 7)}</span> },
                { key: 'total_lcs', label: 'LCs', align: 'right' },
                { key: 'total_value', label: 'Value', align: 'right', render: (r) => <span className="font-semibold">{fmt(r.total_value)}</span> },
                { key: 'closure_rate_pct', label: 'Closed', align: 'right', render: (r) => (
                  <Pill tone={r.closure_rate_pct >= 80 ? 'positive' : r.closure_rate_pct >= 50 ? 'warning' : 'critical'}>
                    {formatPercent(r.closure_rate_pct)}
                  </Pill>
                ) },
                { key: 'payment_rate_pct', label: 'Paid', align: 'right', render: (r) => formatPercent(r.payment_rate_pct) },
                { key: 'pending_boe_value', label: 'Pending BOE', align: 'right', render: (r) => fmt(r.pending_boe_value) },
                { key: 'avg_age_days', label: 'Avg Age', align: 'right', render: (r) => `${Math.round(r.avg_age_days)}d` },
              ]}
              rows={cohort}
            />
          </Card>
        </Section>
      </div>
    </div>
  )
}

export default CashFlowView
