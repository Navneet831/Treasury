import React, { useState, useRef, useEffect } from 'react'
import { Info, Database, FlaskConical, Shield, AlertTriangle, X, Filter } from 'lucide-react'

export interface ProvenanceMeta {
  /** Which tables / warehouse objects back this number */
  source: string[]
  /** Human-readable description of filters that are active */
  query?: string
  /** The computation expressed plainly */
  formula?: string
  /** Baked-in rules that affect the result */
  assumptions?: string[]
  /** How trustworthy is the data */
  confidence: 'high' | 'medium' | 'low'
  /** How many underlying rows drove this number */
  rowCount?: number
  /**
   * Loss-aversion framing: what is at risk / what could go wrong.
   * Frame around the downside, not the upside.
   */
  atRisk?: string
}

interface Props {
  meta: ProvenanceMeta
  /** Which side the panel opens toward */
  align?: 'left' | 'right'
  className?: string
}

const CONF = {
  high:   { label: 'High',   dotCls: 'bg-green-500',  textCls: 'text-green-700',  bgCls: 'bg-green-50 border-green-100'  },
  medium: { label: 'Medium', dotCls: 'bg-amber-500',  textCls: 'text-amber-700',  bgCls: 'bg-amber-50 border-amber-100'  },
  low:    { label: 'Low',    dotCls: 'bg-red-500',    textCls: 'text-red-700',    bgCls: 'bg-red-50 border-red-100'      },
}

const ProvenanceBadge: React.FC<Props> = ({ meta, align = 'right', className = '' }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const conf = CONF[meta.confidence]

  return (
    <div ref={ref} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o) }}
        title="View data provenance"
        aria-label="Data provenance"
        className={`flex items-center justify-center w-[14px] h-[14px] rounded-full transition-colors duration-150 ${
          open
            ? 'bg-accent/15 text-accent'
            : 'text-ink-faint hover:text-ink-mute hover:bg-hairline-cool'
        }`}
      >
        <Info className="w-[10px] h-[10px]" />
      </button>

      {open && (
        <div
          className={`absolute z-50 top-5 w-[288px] bg-canvas border border-hairline rounded-xl shadow-lift overflow-hidden ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-hairline bg-parchment">
            <span className="text-[8.5px] font-black uppercase tracking-[0.14em] text-ink-mute">
              Data Provenance
            </span>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setOpen(false) }}
              className="text-ink-faint hover:text-ink transition-colors"
              aria-label="Close"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="p-3 space-y-2.5">

            {/* Source */}
            <Row icon={<Database className="w-3 h-3" />} label="Source">
              <div className="flex flex-wrap gap-1 mt-0.5">
                {meta.source.map((s, i) => (
                  <span
                    key={i}
                    className="px-1.5 py-0.5 bg-parchment border border-hairline rounded text-[10px] font-mono font-semibold text-ink-mute"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </Row>

            {/* Active filters */}
            {meta.query && (
              <Row icon={<Filter className="w-3 h-3" />} label="Active Filters">
                <p className="text-[10px] text-ink-mute leading-relaxed mt-0.5">{meta.query}</p>
              </Row>
            )}

            {/* Formula */}
            {meta.formula && (
              <Row icon={<FlaskConical className="w-3 h-3" />} label="Formula">
                <p className="text-[10px] font-mono text-ink-mute leading-relaxed mt-0.5 break-all">{meta.formula}</p>
              </Row>
            )}

            {/* Assumptions */}
            {meta.assumptions && meta.assumptions.length > 0 && (
              <Row icon={<Shield className="w-3 h-3" />} label="Assumptions">
                <ul className="mt-0.5 space-y-0.5">
                  {meta.assumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-ink-faint text-[10px] mt-px flex-shrink-0">·</span>
                      <span className="text-[10px] text-ink-mute leading-relaxed">{a}</span>
                    </li>
                  ))}
                </ul>
              </Row>
            )}

            {/* Confidence */}
            <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${conf.bgCls}`}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${conf.dotCls}`} />
              <span className={`text-[10px] font-bold ${conf.textCls}`}>Confidence: {conf.label}</span>
              {meta.rowCount !== undefined && (
                <span className={`ml-auto text-[10px] ${conf.textCls} opacity-70`}>
                  {meta.rowCount.toLocaleString()} rows
                </span>
              )}
            </div>

            {/* At Risk — loss aversion framing, only shown when meaningful */}
            {meta.atRisk && (
              <div className="flex gap-2 px-2.5 py-2 bg-red-50 border border-red-100 rounded-lg">
                <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-red-700 font-medium leading-relaxed">{meta.atRisk}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const Row: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({
  icon,
  label,
  children,
}) => (
  <div className="flex gap-2">
    <div className="text-ink-faint mt-0.5 flex-shrink-0">{icon}</div>
    <div className="min-w-0 flex-1">
      <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-ink-faint">{label}</p>
      {children}
    </div>
  </div>
)

export default ProvenanceBadge
