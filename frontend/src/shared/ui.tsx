/**
 * Shared UI primitives — the only place layout/typography decisions live.
 * Tokens per DESIGN-supabase.md / DESIGN-apple.md: ink #171717, hairline
 * #dfdfdf, white cards on parchment, one emerald accent, no chrome shadows.
 */
import React from 'react'

// ── Page chrome ────────────────────────────────────────────────────────────

export const PageHeader: React.FC<{
  title: string
  subtitle?: string
  right?: React.ReactNode
}> = ({ title, subtitle, right }) => (
  <div className="bg-white border-b border-[#dfdfdf] px-5 py-2.5 flex items-center justify-between gap-4 sticky top-0 z-20">
    <div className="flex items-baseline gap-3 min-w-0">
      <h1 className="text-[15px] font-semibold text-[#171717] tracking-display whitespace-nowrap">{title}</h1>
      {subtitle && <p className="text-[12px] text-[#707070] truncate">{subtitle}</p>}
    </div>
    {right && <div className="flex items-center gap-2 flex-shrink-0">{right}</div>}
  </div>
)

export const Section: React.FC<{
  title: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}> = ({ title, right, children, className = '' }) => (
  <section className={className}>
    <div className="flex items-center justify-between mb-2">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#9a9a9a]">{title}</h2>
      {right}
    </div>
    {children}
  </section>
)

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-[#dfdfdf] rounded-[8px] ${className}`}>{children}</div>
)

// ── Stats ──────────────────────────────────────────────────────────────────

type Tone = 'default' | 'accent' | 'positive' | 'warning' | 'critical'

const TONE_VALUE: Record<Tone, string> = {
  default: 'text-[#171717]',
  accent: 'text-[#24b47e]',
  positive: 'text-[#16a34a]',
  warning: 'text-[#d97706]',
  critical: 'text-[#dc2626]',
}

/**
 * StatTile sizes encode importance: `hero` for the page's defining number,
 * `md` for primary KPIs, `sm` for supporting figures.
 */
export const StatTile: React.FC<{
  label: string
  value: string
  sub?: string
  tone?: Tone
  size?: 'hero' | 'md' | 'sm'
  title?: string
}> = ({ label, value, sub, tone = 'default', size = 'md', title }) => {
  const valueCls = size === 'hero' ? 'text-[24px]' : size === 'md' ? 'text-[18px]' : 'text-[14px]'
  const pad = size === 'hero' ? 'px-4 py-3' : size === 'md' ? 'px-3.5 py-2.5' : 'px-3 py-2'
  return (
    <div className={`bg-white border border-[#dfdfdf] rounded-[8px] ${pad} min-w-0`} title={title}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a9a9a] truncate">{label}</p>
      <p className={`${valueCls} font-semibold tracking-display tabular ${TONE_VALUE[tone]} leading-tight mt-0.5 truncate`}>{value}</p>
      {sub && <p className="text-[11px] text-[#707070] mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

// ── Insights (McKinsey strip) ──────────────────────────────────────────────

export interface Insight {
  id: string
  severity: 'critical' | 'warning' | 'positive' | 'info'
  headline: string
  detail: string
  action?: string
}

const SEV_STYLE: Record<Insight['severity'], { border: string; dot: string }> = {
  critical: { border: 'border-l-[#dc2626]', dot: 'bg-[#dc2626]' },
  warning:  { border: 'border-l-[#d97706]', dot: 'bg-[#d97706]' },
  positive: { border: 'border-l-[#24b47e]', dot: 'bg-[#24b47e]' },
  info:     { border: 'border-l-[#9a9a9a]', dot: 'bg-[#9a9a9a]' },
}

export const InsightStrip: React.FC<{ insights: Insight[] }> = ({ insights }) => {
  if (!insights.length) return null
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
      {insights.map((ins) => (
        <div key={ins.id}
          className={`bg-white border border-[#dfdfdf] border-l-[3px] ${SEV_STYLE[ins.severity].border} rounded-[6px] px-3 py-2 min-w-0`}>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV_STYLE[ins.severity].dot}`} />
            <p className="text-[12px] font-semibold text-[#171717] truncate">{ins.headline}</p>
          </div>
          <p className="text-[11px] text-[#707070] leading-snug mt-0.5">{ins.detail}</p>
          {ins.action && (
            <p className="text-[11px] font-medium text-[#24b47e] mt-1">→ {ins.action}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Tables ─────────────────────────────────────────────────────────────────

export const MiniTable: React.FC<{
  columns: { key: string; label: string; align?: 'left' | 'right'; render?: (row: any) => React.ReactNode }[]
  rows: any[]
  rowKey?: (row: any, i: number) => string
}> = ({ columns, rows, rowKey }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-[12px]">
      <thead>
        <tr className="border-b border-[#dfdfdf]">
          {columns.map((c) => (
            <th key={c.key}
              className={`px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9a9a9a] ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#ededed]">
        {rows.map((row, i) => (
          <tr key={rowKey ? rowKey(row, i) : i} className="hover:bg-[#fafafa] transition-colors">
            {columns.map((c) => (
              <td key={c.key} className={`px-2.5 py-1.5 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.render ? c.render(row) : row[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)

export const Pill: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({ tone = 'default', children }) => {
  const cls = {
    default: 'bg-[#fafafa] text-[#171717] border-[#dfdfdf]',
    accent: 'bg-[#3ecf8e] text-[#171717] border-[#24b47e]',
    positive: 'bg-[#f0fdf4] text-[#16a34a] border-[#bbf7d0]',
    warning: 'bg-[#fffbeb] text-[#d97706] border-[#fde68a]',
    critical: 'bg-[#fef2f2] text-[#dc2626] border-[#fecaca]',
  }[tone]
  return <span className={`inline-block px-1.5 py-px rounded-full border text-[10px] font-semibold ${cls}`}>{children}</span>
}

// ── Charts ─────────────────────────────────────────────────────────────────

/** The one recharts tooltip (DRY). Pass the page's money formatter. */
export const ChartTip: React.FC<{
  fmt: (v: number) => string
  active?: boolean
  payload?: any[]
  label?: string
}> = ({ fmt, active, payload, label }) =>
  active && payload?.length ? (
    <div className="bg-white border border-[#dfdfdf] rounded-[6px] px-2.5 py-1.5 text-[11px]">
      {label && <p className="font-semibold text-[#171717] mb-0.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex justify-between gap-4">
          <span className="text-[#707070]">{p.name}</span>
          <span className="font-semibold tabular" style={{ color: p.color }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  ) : null

/** Labelled horizontal bar — funnels, aging buckets, utilization meters. */
export const BarRow: React.FC<{
  label: string
  pct: number            // 0–100 fill
  color: string          // bar fill color
  display: string        // value text on the right
  rightExtra?: string    // small secondary figure (count, conversion %)
  inBarText?: string     // optional bold text rendered inside the bar
  labelWidth?: string
}> = ({ label, pct, color, display, rightExtra, inBarText, labelWidth = 'w-[100px]' }) => (
  <div className="flex items-center gap-2">
    <span className={`text-[11px] text-[#707070] ${labelWidth} flex-shrink-0 truncate`} title={label}>{label}</span>
    <div className="flex-1 bg-[#fafafa] rounded-[4px] h-[18px] overflow-hidden border border-[#ededed]">
      <div className="h-full rounded-[3px] flex items-center px-1.5"
        style={{ width: `${Math.max(Math.min(pct, 100), inBarText ? 8 : 4)}%`, background: color }}>
        {inBarText && <span className="text-[10px] font-bold text-white">{inBarText}</span>}
      </div>
    </div>
    {display && <span className="text-[11px] font-semibold text-[#171717] w-[88px] text-right tabular flex-shrink-0">{display}</span>}
    {rightExtra !== undefined && <span className="text-[10px] text-[#9a9a9a] w-[40px] text-right tabular flex-shrink-0">{rightExtra}</span>}
  </div>
)

// ── Loading / error states ─────────────────────────────────────────────────

export const PageSkeleton: React.FC = () => (
  <div className="p-5 space-y-3 animate-pulse">
    <div className="h-7 w-64 bg-[#ededed] rounded" />
    <div className="grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-[#ededed] rounded-[8px]" />)}
    </div>
    <div className="h-56 bg-[#ededed] rounded-[8px]" />
  </div>
)

export const ErrorState: React.FC<{ message?: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="p-10 flex flex-col items-center text-center gap-3">
    <p className="text-[13px] font-semibold text-[#171717]">Data unavailable</p>
    <p className="text-[12px] text-[#707070] max-w-sm">{message || 'The treasury service did not respond.'}</p>
    <button onClick={onRetry}
      className="px-3.5 py-1.5 bg-[#3ecf8e] text-[#171717] rounded-[6px] text-[12px] font-semibold hover:bg-[#24b47e] transition-colors">
      Retry
    </button>
  </div>
)
