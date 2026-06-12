/**
 * Audit — the methodology register. Documents how every number in the app is
 * derived (formula, source columns, config dependencies, caveats) with LIVE
 * configuration values and table row counts, so figures can be independently
 * verified against the warehouse.
 */
import React, { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { getAuditCatalog } from '../api'
import { useFetch } from '../shared/useFetch'
import {
  Card, ErrorState, MiniTable, PageHeader, PageSkeleton, Pill, Section,
} from '../shared/ui'

interface Metric {
  id: string
  name: string
  tab: string
  formula: string
  source: string
  config_keys?: string
  caveats?: string
}

const TAB_ORDER = [
  'Command Center', 'Executive Overview', 'Calendar', 'Cash Flow',
  'FX & Hedging', 'Operations', 'Intelligence', 'Insights',
]

const AuditView: React.FC = () => {
  const [query, setQuery] = useState('')
  const { data, loading, error, reload } = useFetch(() => getAuditCatalog(), [])

  const grouped = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const metrics: Metric[] = (data.metrics || []).filter((m: Metric) =>
      !q || [m.name, m.tab, m.formula, m.source, m.config_keys, m.caveats]
        .filter(Boolean).join(' ').toLowerCase().includes(q),
    )
    return TAB_ORDER
      .map((tab) => ({ tab, items: metrics.filter((m) => m.tab === tab) }))
      .filter((g) => g.items.length > 0)
  }, [data, query])

  if (loading) return <PageSkeleton />
  if (error || !data) return <ErrorState message={error || undefined} onRetry={reload} />

  return (
    <div className="page-in">
      <PageHeader
        title="Audit"
        subtitle="How every number is derived — formulas, sources and live configuration"
        right={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9a9a9a]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search metrics, columns, formulas"
              className="w-[260px] pl-8 pr-3 py-1.5 bg-[#fafafa] border border-[#dfdfdf] rounded-[6px] text-[12px] text-[#171717] focus:outline-none focus:border-[#24b47e] transition-colors placeholder:text-[#9a9a9a]"
            />
          </div>
        }
      />
      <div className="p-4 space-y-5 max-w-[1500px]">

        <Section title="Reading Conventions">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {(data.conventions || []).map((c: any) => (
              <div key={c.topic} className="bg-white border border-[#dfdfdf] rounded-[6px] px-3 py-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#171717]">{c.topic}</p>
                <p className="text-[11px] text-[#707070] leading-snug mt-0.5">{c.rule}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <Section title="Data Sources (live row counts)">
            <Card>
              <MiniTable
                rowKey={(r) => r.table}
                columns={[
                  { key: 'table', label: 'Table', render: (r) => <span className="font-mono font-semibold text-[11px]">{r.table}</span> },
                  { key: 'row_count', label: 'Rows', align: 'right', render: (r) => (
                    <span className="tabular font-semibold">{r.row_count != null ? r.row_count.toLocaleString('en-IN') : '—'}</span>
                  ) },
                  { key: 'purpose', label: 'Purpose', render: (r) => (
                    <span className="text-[11px] text-[#707070] leading-snug" title={r.columns_used}>{r.purpose}</span>
                  ) },
                ]}
                rows={data.data_sources || []}
              />
            </Card>
          </Section>

          <Section title="Configuration (live from APP_CONFIG)">
            <Card>
              <MiniTable
                rowKey={(r) => r.key}
                columns={[
                  { key: 'key', label: 'Key', render: (r) => <span className="font-mono text-[11px]">{r.key}</span> },
                  { key: 'value', label: 'Value', align: 'right', render: (r) => (
                    <span className="tabular font-semibold">{r.value != null ? r.value : '—'}</span>
                  ) },
                  { key: 'overridden', label: 'Source', render: (r) => (
                    <Pill tone={r.overridden ? 'accent' : 'default'}>{r.overridden ? 'DB' : 'default'}</Pill>
                  ) },
                  { key: 'description', label: 'Controls', render: (r) => (
                    <span className="text-[11px] text-[#707070] leading-snug">{r.description}</span>
                  ) },
                ]}
                rows={data.config || []}
              />
            </Card>
          </Section>
        </div>

        {grouped.map(({ tab, items }) => (
          <Section key={tab} title={`${tab} — ${items.length} metric${items.length > 1 ? 's' : ''}`}>
            <div className="bg-white border border-[#dfdfdf] rounded-[8px] divide-y divide-[#ededed]">
              {items.map((m) => (
                <div key={m.id} className="px-3 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[12px] font-semibold text-[#171717]">{m.name}</p>
                    {m.config_keys && (
                      <span className="font-mono text-[10px] text-[#24b47e]" title="Configurable via APP_CONFIG">
                        ⚙ {m.config_keys}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#171717] leading-snug mt-1">
                    <span className="text-[#9a9a9a] font-semibold uppercase text-[9px] tracking-wider mr-1.5">How</span>
                    {m.formula}
                  </p>
                  <p className="text-[11px] text-[#707070] leading-snug mt-0.5">
                    <span className="text-[#9a9a9a] font-semibold uppercase text-[9px] tracking-wider mr-1.5">From</span>
                    <span className="font-mono text-[10px]">{m.source}</span>
                  </p>
                  {m.caveats && (
                    <p className="text-[11px] text-[#d97706] leading-snug mt-0.5">
                      <span className="font-semibold uppercase text-[9px] tracking-wider mr-1.5">Note</span>
                      {m.caveats}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>
        ))}

        {grouped.length === 0 && (
          <p className="text-[12px] text-[#707070] px-1">No metrics match "{query}".</p>
        )}
      </div>
    </div>
  )
}

export default AuditView
