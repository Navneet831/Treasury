/**
 * Shared UI primitives — the only place layout/typography decisions live.
 * Tokens per DESIGN-supabase.md / DESIGN-apple.md: ink #171717, hairline
 * #dfdfdf, white cards on parchment, one emerald accent, no chrome shadows.
 */
import React, { useState, useRef, useEffect } from 'react'
import { useAudit } from './AuditContext'
import { useStore } from '../store'
import { ShieldCheck, Database, FlaskConical, Shield, AlertTriangle, CheckCircle2 } from 'lucide-react'

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
  metricId?: string
  drillDownParams?: any
}> = ({ label, value, sub, tone = 'default', size = 'md', title: passedTitle, metricId, drillDownParams }) => {
  const { isAuditMode, getMetricMeta, triggerDrillDown } = useAudit()
  const { sourceMode } = useStore()
  const [open, setOpen] = useState(false)
  const [provenanceHover, setProvenanceHover] = useState(false)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Clean up hide timer on unmount
  useEffect(() => {
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current) }
  }, [])

  // Dismiss provenance overlay on outside tap/click (touch-friendly)
  useEffect(() => {
    if (!provenanceHover) return
    const dismiss = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setProvenanceHover(false)
      }
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('touchstart', dismiss)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('touchstart', dismiss)
    }
  }, [provenanceHover])

  const meta = metricId ? getMetricMeta(metricId) : undefined

  const valueCls = size === 'hero' ? 'text-[24px]' : size === 'md' ? 'text-[18px]' : 'text-[14px]'
  const pad = size === 'hero' ? 'px-4 py-3' : size === 'md' ? 'px-3.5 py-2.5' : 'px-3 py-2'

  const CONF = {
    high:   { label: 'High',   dotCls: 'bg-emerald-500',  textCls: 'text-emerald-700',  bgCls: 'bg-emerald-50 border-emerald-100'  },
    medium: { label: 'Medium', dotCls: 'bg-amber-500',  textCls: 'text-amber-700',  bgCls: 'bg-amber-50 border-amber-100'  },
    low:    { label: 'Low',    dotCls: 'bg-rose-500',    textCls: 'text-rose-700',    bgCls: 'bg-rose-50 border-rose-100'      },
  }

  const confInfo = meta?.confidence ? CONF[meta.confidence] : null

  // ── Hover/touch handlers for Source Mode provenance ──
  const handleMouseEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (sourceMode && meta) setProvenanceHover(true)
  }
  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setProvenanceHover(false), 250)
  }
  const handleTapToggle = () => {
    if (sourceMode && meta) {
      setProvenanceHover((prev) => !prev)
    }
  }

  // Native title: only when Source Mode is OFF, show compact formula
  const compactFormula = (f: string) =>
    f
      .replace(/^[^=]*=\s*/i, '')           // strip "X = "
      .replace(/^Sum of\s*/i, '')            // strip "Sum of "
      .replace(/\s*across\s+all\s+banks/i, '') // strip "... across all banks"
      .replace(/\s*\(Note:[^)]*\)/gi, '')     // strip parenthetical notes
      .replace(/\[[^\]]*\]/g, '')             // strip [bracketed notes]
      .trim()
  const nativeTitle = !sourceMode && meta ? compactFormula(meta.formula) : passedTitle

  return (
    <div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleTapToggle}
      className={`relative bg-white border rounded-[8px] ${pad} min-w-0 transition-all duration-200 cursor-default ${
        isAuditMode && meta
          ? 'border-emerald-500/40 bg-emerald-500/[0.01] shadow-sm hover:border-emerald-500 hover:shadow-md'
          : sourceMode && meta && provenanceHover
            ? 'border-accent/40 bg-accent/[0.01] shadow-sm'
            : 'border-[#dfdfdf]'
      }`}
      title={nativeTitle}
    >
      <div className="flex justify-between items-start gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9a9a9a] truncate flex-1">{label}</p>
        {meta && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(!open) }}
            className={`p-0.5 rounded-full hover:bg-slate-100 transition-colors ${open ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
            title="Inspect Provenance & Auditability"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <p className={`${valueCls} font-semibold tracking-display tabular ${TONE_VALUE[tone]} leading-tight mt-0.5 truncate`}>
        {value}
      </p>

      {sub && <p className="text-[11px] text-[#707070] mt-0.5 truncate">{sub}</p>}

      {isAuditMode && meta && (
        <div className="mt-1.5 flex items-center justify-between text-[8.5px] font-bold text-emerald-600 uppercase tracking-wider border-t border-emerald-500/10 pt-1">
          <span className="flex items-center gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
            Verified
          </span>
          {drillDownParams && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); triggerDrillDown(`${meta.name} (Drill Down)`, drillDownParams) }}
              className="hover:underline hover:text-emerald-700"
            >
              Drill Down &rarr;
            </button>
          )}
        </div>
      )}

      {/* ── Source Mode: Rich Provenance Overlay (hover/tap) ── */}
      {sourceMode && provenanceHover && meta && (
        <div
          className="fixed inset-x-2 top-1/2 -translate-y-1/2 z-[100] max-h-[80vh] overflow-y-auto sm:absolute sm:top-full sm:mt-1.5 sm:left-1/2 sm:-translate-x-1/2 sm:w-[380px] sm:right-auto sm:max-h-none sm:overflow-y-visible bg-white border border-[#dfdfdf] rounded-xl shadow-lift text-left"
          onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); setProvenanceHover(true) }}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#dfdfdf] bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                <Database className="w-3.5 h-3.5 text-accent" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.14em] text-accent">Data Provenance</span>
                <p className="text-[9px] text-slate-400 font-medium">{meta.name}</p>
              </div>
            </div>
            <span className="text-[8px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">ID: {meta.id}</span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setProvenanceHover(false) }}
              className="sm:hidden flex items-center justify-center w-7 h-7 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              aria-label="Close provenance overlay"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div className="p-3.5 space-y-3">
            {/* Source Tables */}
            <div className="flex gap-2.5">
              <div className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Source Tables</p>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="flex flex-wrap gap-1">
                  {meta.source.split(',').map((t: string, i: number) => (
                    <span key={i} className="text-[10px] font-mono font-bold text-slate-700 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded leading-tight">
                      {t.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters / Config */}
            {meta.config_keys && (
              <div className="flex gap-2.5">
                <div className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Filters Applied</p>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {meta.config_keys.split(',').map((f: string, i: number) => (
                      <span key={i} className="text-[10px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded leading-tight">
                        {f.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Derivation Formula */}
            <div className="flex gap-2.5">
              <FlaskConical className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Derivation Formula</p>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <p className="text-[10px] text-slate-600 leading-snug bg-slate-50 border border-slate-200 rounded p-1.5 font-mono">{meta.formula}</p>
              </div>
            </div>

            {/* Methodology Assumptions */}
            {meta.caveats && (
              <div className="flex gap-2.5">
                <Shield className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-400">Methodology Notes</p>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  <p className="text-[10px] text-slate-600 leading-snug">{meta.caveats}</p>
                </div>
              </div>
            )}

            {/* Bottom grid: Confidence + Risk */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {confInfo && (
                <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded border ${confInfo.bgCls}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${confInfo.dotCls}`} />
                  <span className={`text-[9px] font-bold ${confInfo.textCls}`}>{confInfo.label} Confidence</span>
                </div>
              )}
              {meta.atRisk && (
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border bg-rose-50 border-rose-100">
                  <AlertTriangle className="w-3 h-3 text-rose-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[7px] font-black uppercase tracking-[0.1em] text-rose-800">Risk</p>
                    <p className="text-[9px] text-rose-700 font-medium leading-tight truncate">{meta.atRisk}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Drill‑down CTA */}
            {drillDownParams && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setProvenanceHover(false);
                    triggerDrillDown(`${meta.name} (Drill Down)`, drillDownParams);
                  }}
                  className="w-full bg-slate-900 text-white rounded py-2.5 sm:py-1.5 text-[10px] font-bold hover:bg-black text-center transition-all flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  Verify Underlying Transactions
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Audit Mode: Click-triggered Provenance Popover ── */}
      {open && meta && (
        <div
          className="absolute z-50 top-8 right-2 w-[320px] bg-white border border-[#dfdfdf] rounded-xl shadow-lift overflow-hidden text-left"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#dfdfdf] bg-[#fafafa]">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-800 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Audit Provenance
            </span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setOpen(false) }}
              className="text-[#9a9a9a] hover:text-[#171717] text-[10px]"
            >
              ✕
            </button>
          </div>

          <div className="p-3 space-y-2.5">
            {/* Metric ID & Title */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-800">{meta.name}</h4>
              <span className="text-[9px] font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-500">ID: {meta.id}</span>
            </div>

            {/* Data Source */}
            <div className="flex gap-2">
              <Database className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-[#9a9a9a]">Source Tables</p>
                <p className="text-[10px] text-slate-700 font-mono mt-0.5 leading-tight">{meta.source}</p>
              </div>
            </div>

            {/* Formula / Reasoning */}
            <div className="flex gap-2">
              <FlaskConical className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-[#9a9a9a]">Derivation Logic</p>
                <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{meta.formula}</p>
              </div>
            </div>

            {/* Caveats / Assumptions */}
            {meta.caveats && (
              <div className="flex gap-2">
                <Shield className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-[#9a9a9a]">Methodology Assumptions</p>
                  <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">{meta.caveats}</p>
                </div>
              </div>
            )}

            {/* Confidence */}
            {confInfo && (
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${confInfo.bgCls}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${confInfo.dotCls}`} />
                <span className={`text-[10px] font-bold ${confInfo.textCls}`}>Confidence Rating: {confInfo.label}</span>
              </div>
            )}

            {/* Loss Aversion Frame */}
            {meta.atRisk && (
              <div className="flex gap-2 px-2.5 py-2 bg-rose-50 border border-rose-100 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-rose-800">Downside Risk Exposure</p>
                  <p className="text-[10px] text-rose-700 font-medium leading-normal mt-0.5">{meta.atRisk}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1 border-t border-slate-100">
              {drillDownParams && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    triggerDrillDown(`${meta.name} (Drill Down)`, { ...drillDownParams, fy: 'All' });
                  }}
                  className="flex-1 bg-slate-900 text-white rounded py-1 text-[10px] font-bold hover:bg-black text-center transition-all"
                >
                  Verify Underlying Transactions
                </button>
              )}
            </div>
          </div>
        </div>
      )}
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
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-[#ededed] rounded-[8px]" />)}
    </div>
    <div className="h-56 bg-[#ededed] rounded-[8px]" />
  </div>
)

export const ErrorState: React.FC<{ message?: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="p-10 flex flex-col items-center text-center gap-3">
    <p className="text-[13px] font-semibold text-[#171717]">Data unavailable</p>
    <p className="text-[12px] text-[#707070] max-w-sm">{message || 'The treasury service did not respond.'}</p>
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onRetry();
      }}
      className="px-3.5 py-1.5 bg-[#3ecf8e] text-[#171717] rounded-[6px] text-[12px] font-semibold hover:bg-[#24b47e] transition-colors"
    >
      Retry
    </button>
  </div>
)
