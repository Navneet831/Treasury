import React, { useEffect, useState, useCallback } from 'react'
import {
  Terminal, Database, RefreshCw, CheckCircle2, XCircle,
  Server, User, Hash, Layers,   GitBranch, GitCommit,
  ArrowRight, Code2, Filter, Info, Cpu, Settings,
  Shield, Tag, BookOpen, Gauge, Calendar, Zap, Globe, Percent, Package, FileSearch, Sparkles
} from 'lucide-react'
import { useStore } from '../../store'
import { useAuthStore } from '@grew/auth'
import api from '../../api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DbConnection {
  host: string;
  port: number;
  user: string;
  database: string;
  ssl: boolean;
  masked_password?: string;
}

interface SchemaColumn {
  table: string;
  column: string;
  type: string;
}

interface DataStats {
  totalRecords: number | null;
  minDate: string | null;
  maxDate: string | null;
  cacheStatus: 'warm' | 'cold' | 'error';
  fetchMode: 'direct_pg' | 'error';
  tableCounts: Record<string, number | null> | null;
}

interface DataLogic {
  table: string;
  dateColumn: string;
  minDateFilter: string;
  currencyDivider: string;
  fiscalYearStart: string;
  weekDefinition: string;
  columnMapping: Record<string, string>;
}

interface GitCommitEntry {
  hash: string;
  message: string;
  date: string;
  author: string;
}

interface GitInfo {
  branch: string | null;
  branches?: string[];
  commits: GitCommitEntry[];
  error: string | null;
}

interface DbConfigResponse {
  connection: DbConnection | null;
  source: 'local_env' | 'edge_function' | null;
  connectionError: string | null;
  dataStats: DataStats | null;
  dataLogic: DataLogic | null;
  gitInfo: GitInfo | null;
  dbSchema: SchemaColumn[] | null;
  columnMappingByTable: Record<string, Record<string, string>> | null;
}

// ─── Main View ────────────────────────────────────────────────────────────────

export const DevView: React.FC = () => {
  const { currency, fy, asOnDate, amountUnit } = useStore()
  const { user } = useAuthStore()
  const features = user?.features || {}

  const [config, setConfig] = useState<DbConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // App tables map — which tables each tab uses (matches audit._DATA_SOURCES)
  const appTables: Record<string, { table: string; tabs: string[] }> = {
    'LC':                { table: 'LC',                tabs: ['All Tabs'] },
    'bank_limit':        { table: 'bank_limit',        tabs: ['Command Center', 'Audit', 'Developer'] },
    'SBLC':              { table: 'SBLC',              tabs: ['Command Center', 'Audit'] },
    'LC BG in Process':  { table: '"LC BG in Process"', tabs: ['Command Center', 'Audit'] },
    'FDR_List':          { table: 'FDR_List',           tabs: ['Interest'] },
    'Bank_Guarantee':    { table: 'Bank_Guarantee',     tabs: ['Audit', 'Operations'] },
    'APP_CONFIG':        { table: 'APP_CONFIG',         tabs: ['Audit'] },
  }
  const tabIcons: Record<string, React.ReactNode> = {
    'Command Center': <Gauge className="w-2.5 h-2.5" />,
    'Calendar':       <Calendar className="w-2.5 h-2.5" />,
    'Cash Flow':      <Zap className="w-2.5 h-2.5" />,
    'FX & Hedging':   <Globe className="w-2.5 h-2.5" />,
    'Interest':       <Percent className="w-2.5 h-2.5" />,
    'Operations':     <Package className="w-2.5 h-2.5" />,
    'LC Lifecycle':   <Layers className="w-2.5 h-2.5" />,
    'Intelligence':   <BookOpen className="w-2.5 h-2.5" />,
    'Audit':          <FileSearch className="w-2.5 h-2.5" />,
    'GrewGpt':        <Sparkles className="w-2.5 h-2.5" />,
    'Developer':      <Terminal className="w-2.5 h-2.5" />,
  }

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/db-config')
      setConfig(res.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Removed: fetchTables — app uses a curated table map instead
  // Git branch switching + console removed — no /git-branch or /git-command backend endpoints

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const conn = config?.connection
  const stats = config?.dataStats
  const logic = config?.dataLogic
  const git = config?.gitInfo
  const columnMappingByTable = config?.columnMappingByTable || {}

  return (
    <div className="flex-1 flex flex-col bg-canvas overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 text-[10px]">
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-hairline flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-1.5">
          <div className="p-1 bg-emerald-500/10 rounded border border-emerald-500/20">
            <Terminal className="w-3 h-3 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <h1 className="text-[11px] font-semibold text-ink">Dev Console</h1>
            <p className="text-[9px] text-ink-mute">DB · Branch · Schema · Logic</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { fetchConfig(); }}
            disabled={loading}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-hairline text-[10px] font-medium text-ink hover:bg-canvas transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar-vertical">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            Failed to load dev config: {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 max-w-7xl mx-auto">

          {/* ── DB Connection ── */}
          <DarkCard
            title="DB Connection"
            icon={<Database className="w-3.5 h-3.5 text-emerald-600" />}
            badge={conn
              ? <StatusBadge ok label={config?.source === 'local_env' ? '.env' : 'edge fn'} />
              : <StatusBadge label="not configured" />}
          >
            {conn ? (
              <>
                <DbRow icon={<Server className="w-3 h-3 text-sky-600" />} label="PG_HOST" value={conn.host} />
                <DbRow icon={<Hash className="w-3 h-3 text-violet-600" />} label="PG_PORT" value={String(conn.port)} />
                <DbRow icon={<User className="w-3 h-3 text-amber-600" />} label="PG_USER" value={conn.user} />
                {conn.masked_password && (
                  <DbRow icon={<Shield className="w-3 h-3 text-rose-500" />} label="PG_PASSWORD" value={conn.masked_password} />
                )}
                <DbRow icon={<Layers className="w-3 h-3 text-emerald-600" />} label="PG_DATABASE" value={conn.database} />
                <DbRow icon={<Info className="w-3 h-3 text-slate-500" />} label="SSL" value={conn.ssl ? 'enabled' : 'disabled'} />
                <DbRow
                  icon={<GitBranch className="w-3 h-3 text-teal-600" />}
                  label="SOURCE"
                  value={config?.source === 'local_env' ? 'local .env' : 'Supabase edge fn'}
                  highlight
                />
              </>
            ) : (
              <p className="py-4 text-[10px] text-ink-mute font-mono">{config?.connectionError || 'No connection details available'}</p>
            )}
          </DarkCard>

          {/* ── Git Info ── */}
          <DarkCard
            title="Git"
            icon={<GitBranch className="w-4 h-4 text-violet-600" />}
          >
            <div className="flex items-center gap-2 py-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[9px] font-bold text-ink-mute uppercase font-mono">BRANCH</span>
              <span className="font-mono text-ink font-semibold">{git?.branch || '—'}</span>
            </div>
            {git?.commits?.length ? (
              <div className="divide-y divide-hairline">
                {git.commits.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <GitCommit className="w-3 h-3 text-violet-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-violet-600 font-semibold">{c.hash}</span>
                        <span className="text-[9px] text-ink-faint font-mono">{c.date.slice(0, 10)}</span>
                        <span className="text-[9px] text-ink-faint truncate">{c.author}</span>
                      </div>
                      <p className="text-[10px] text-ink-mute truncate" title={c.message}>{c.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-2 text-xs text-ink-faint">{git?.error || 'No commits found'}</p>
            )}
          </DarkCard>

          {/* ── DB Overview (merged: App Tables + Schema + Column Mapping + Stats) ── */}
          <div className="bg-white rounded-lg border border-hairline shadow-sm overflow-hidden xl:col-span-2">
            <CardHeader title="DB Overview (Schema · Mapping · Row Counts)" icon={<Database className="w-3.5 h-3.5 text-blue-600" />}>
              <StatusBadge ok label={`${Object.keys(appTables).length} tables · ${currency === 'INR' ? '₹ INR' : '$ FC'}`} />
            </CardHeader>
            <div className="divide-y divide-hairline">
              {Object.entries(appTables).map(([key, { table: tblName, tabs }]) => {
                const cleanTable = tblName.replace(/"/g, '')
                const schemaCols = (config?.dbSchema || []).filter(s => s.table === cleanTable)
                const mapping = columnMappingByTable[cleanTable] || {}
                const rowCount = stats?.tableCounts?.[cleanTable]
                const hasDetail = schemaCols.length > 0 || Object.keys(mapping).length > 0
                return (
                  <details key={key} className="group open:bg-canvas-soft/20 transition-colors">
                    <summary className="flex items-center justify-between gap-2 px-3 py-1.5 cursor-pointer hover:bg-canvas-soft/30 transition-colors list-none select-none">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] text-ink-faint font-mono rotate-0 group-open:rotate-90 transition-transform">▶</span>
                        <span className="text-[10px] font-semibold text-blue-600 font-mono">{tblName}</span>
                        <span className="text-[10px] font-mono tabular text-ink-mute">
                          {rowCount != null ? Number(rowCount).toLocaleString('en-IN') : '—'} rows
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-0.5 shrink-0">
                        {tabs.map(t => (
                          <span key={t} className="inline-flex items-center gap-px text-[7px] font-medium px-1 py-px rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                            {tabIcons[t]}{t}
                          </span>
                        ))}
                      </div>
                    </summary>
                    <div className="px-3 pb-2">
                      {hasDetail ? (
                        <div className="ml-3 border-l-2 border-hairline pl-2 space-y-px">
                          {schemaCols.map((col) => {
                            const dbColKey = Object.keys(mapping).find(k => k.replace(/\(in CUR\)/g, '').trim() === col.column.replace(/\(in (INR|FC)\)/g, '').trim() || k.replace(/\(in CUR\)/i, `(in ${currency})`).trim() === col.column.trim())
                            const appField = dbColKey ? mapping[dbColKey] : null
                            const displayCol = col.column.replace(/\(in CUR\)/gi, `(in ${currency})`)
                            return (
                              <div key={col.column} className="flex items-center gap-2 py-0.5 text-[9px] font-mono">
                                <span className="text-blue-600 font-semibold min-w-[33%] truncate" title={displayCol}>{displayCol}</span>
                                <span className="text-ink-faint w-16 shrink-0">{col.type}</span>
                                {appField && (
                                  <>
                                    <ArrowRight className="w-2.5 h-2.5 text-ink-faint shrink-0" />
                                    <span className="text-emerald-600 font-medium truncate">{appField}</span>
                                  </>
                                )}
                              </div>
                            )
                          })}
                          {Object.entries(mapping)
                            .filter(([dbKey]) => !schemaCols.some(sc =>
                              sc.column.replace(/\(in (INR|FC)\)/g, '').trim() === dbKey.replace(/\(in CUR\)/g, '').trim()
                            ))
                            .map(([dbKey, appField]) => {
                              const displayKey = dbKey.replace(/\(in CUR\)/gi, `(in ${currency})`)
                              return (
                                <div key={dbKey} className="flex items-center gap-2 py-0.5 text-[9px] font-mono">
                                  <span className="text-blue-600 font-semibold min-w-[33%] truncate" title={displayKey}>{displayKey}</span>
                                  <span className="text-ink-faint w-16 shrink-0">—</span>
                                  <ArrowRight className="w-2.5 h-2.5 text-ink-faint shrink-0" />
                                  <span className="text-emerald-600 font-medium truncate">{appField}</span>
                                </div>
                              )
                            })}
                          {!hasDetail && <span className="text-[9px] text-ink-faint italic">No schema or mapping info</span>}
                        </div>
                      ) : (
                        <p className="ml-3 text-[9px] text-ink-faint italic">No column info loaded</p>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
            {/* Footer: LC date range + cache */}
            <div className="border-t border-hairline px-3 py-1 flex justify-between text-[8px] text-ink-faint">
              <span>LC dates: {stats?.minDate || '—'} → {stats?.maxDate || '—'}</span>
              <span>Cache: {stats?.cacheStatus || '—'} · {stats?.fetchMode || '—'}</span>
            </div>
          </div>

          {/* ── Active Filters ── */}
          <DarkCard title="Active Filters" icon={<Filter className="w-3.5 h-3.5 text-amber-600" />}>
            <DbRow label="CURRENCY" value={currency} highlight />
            <DbRow label="FISCAL YEAR" value={fy} />
            <DbRow label="AS ON DATE" value={asOnDate || '—'} />
            <DbRow label="AMOUNT UNIT" value={amountUnit} />
          </DarkCard>

          {/* ── Data Logic ── */}
          <DarkCard title="Data Logic" icon={<Code2 className="w-3.5 h-3.5 text-sky-600" />}>
            <DbRow label="TABLE" value={logic?.table || '—'} />
            <DbRow label="DATE COLUMN" value={logic?.dateColumn || '—'} />
            <DbRow label="MIN DATE FILTER" value={logic?.minDateFilter || '—'} />
            <DbRow label="CURRENCY DIVIDER" value={logic?.currencyDivider || '—'} />
            <DbRow label="FISCAL YEAR START" value={logic?.fiscalYearStart || '—'} />
            <DbRow label="WEEK DEFINITION" value={logic?.weekDefinition || '—'} />
          </DarkCard>

          {/* ── Algorithm Notes ── */}
          <div className="bg-white rounded-lg border border-hairline shadow-sm overflow-hidden xl:col-span-2">
            <CardHeader title="Algorithm Notes" icon={<Cpu className="w-3.5 h-3.5 text-amber-600" />} />
            <div className="p-2 grid grid-cols-2 gap-1">
              <AlgoBlock accent="border-blue-500" title="Exposure Weighting" body='"LC Amt" processed relative to usance credit periods and margin ratios.' />
              <AlgoBlock accent="border-emerald-500" title="BOE Reconciliation" body="Matches Lodge date vs Acceptance date to classify outstanding BOE bills." />
              <AlgoBlock accent="border-amber-500" title="Facility Limits" body="Available = total limit - open LCs - open BGs, per bank per fiscal period." />
              <AlgoBlock accent="border-purple-500" title="Payables Maturity Pacing" body="Clusters future outflows into usance cohorts (30/60/90/180 day buckets)." />
            </div>
          </div>

          {/* ── Feature Flags ── */}
          <div className="bg-white rounded-lg border border-hairline shadow-sm overflow-hidden xl:col-span-2">
            <CardHeader title="Feature Flags" icon={<Settings className="w-3.5 h-3.5 text-amber-600" />} />
            <div className="p-2 flex flex-wrap gap-1">
              {Object.keys(features).length > 0 ? (
                Object.entries(features).map(([flag, enabled]) => (
                  <div key={flag} className={`flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-medium ${
                    enabled
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                      : 'bg-canvas border-hairline text-ink-mute'
                  }`}>
                    {enabled ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                    {flag}
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-ink-mute italic">No feature flags registered.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const CardHeader: React.FC<{ title: string; icon: React.ReactNode; children?: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="px-3 py-2 border-b border-hairline bg-canvas-soft/30 flex items-center justify-between">
    <div className="flex items-center gap-1.5">
      {icon}
      <span className="text-[11px] font-semibold text-ink">{title}</span>
    </div>
    {children}
  </div>
)

const StatusBadge: React.FC<{ label: string; ok?: boolean }> = ({ label, ok = false }) => (
  <div className="flex items-center gap-1">
    {ok ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> : <XCircle className="w-2.5 h-2.5 text-rose-500" />}
    <span className={`text-[10px] font-semibold font-mono ${ok ? 'text-emerald-600' : 'text-rose-500'}`}>{label}</span>
  </div>
)

const DarkCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, badge, children }) => (
  <div className="bg-white rounded-lg border border-black shadow-sm overflow-hidden">
    <CardHeader title={title} icon={icon}>{badge}</CardHeader>
    <div className="px-3 divide-y divide-hairline">{children}</div>
  </div>
)

const DbRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ icon, label, value, highlight = false }) => (
  <div className="flex items-center justify-between gap-2 py-1.5">
    <div className="flex items-center gap-1.5 shrink-0">
      {icon}
      <span className="text-[9px] font-semibold text-ink-mute uppercase tracking-wide font-mono">{label}</span>
    </div>
    <span className={`text-[10px] font-mono text-right truncate max-w-[60%] ${highlight ? 'text-ink font-semibold' : 'text-ink-mute'}`}>
      {value}
    </span>
  </div>
)

const AlgoBlock: React.FC<{ accent: string; title: string; body: string }> = ({ accent, title, body }) => (
  <div className="px-1.5 py-1 rounded bg-canvas border border-hairline/60">
    <h4 className={`text-[9px] font-semibold text-ink border-l-2 ${accent} pl-1 mb-0.5`}>{title}</h4>
    <p className="text-[9px] text-ink-mute leading-snug pl-1">{body}</p>
  </div>
)
