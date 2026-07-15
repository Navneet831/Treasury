import React, { useEffect, useState, useCallback } from 'react'
import {
  Terminal, Database, RefreshCw, CheckCircle2, XCircle,
  Server, User, Hash, Layers, GitBranch, GitCommit, Clock,
  ArrowRight, Code2, Filter, BarChart3, Info, Cpu, Settings,
  Shield, UserCheck
} from 'lucide-react'
import { useStore } from '../../store'
import { useAuthStore, supabase } from '@grew/auth'

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
}

interface DataLogic {
  table: string;
  dateColumn: string;
  minDateFilter: string;
  sqlQuery: string;
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
}

// ─── Main View ────────────────────────────────────────────────────────────────

export const DevView: React.FC = () => {
  const { currency, fy, asOnDate, amountUnit } = useStore()
  const { user } = useAuthStore()
  const features = user?.features || {}

  const [config, setConfig] = useState<DbConfigResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Whitelist table state
  const [whitelist, setWhitelist] = useState<any[]>([])
  const [loadingWhitelist, setLoadingWhitelist] = useState(true)
  const [whitelistError, setWhitelistError] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/treasury/db-config')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setConfig(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchWhitelist = useCallback(async () => {
    if (!user?.email) {
      setWhitelist([])
      setLoadingWhitelist(false)
      return
    }
    setLoadingWhitelist(true)
    setWhitelistError(null)
    try {
      const { data, error } = await supabase
        .from('whitelist')
        .select('*')
        .ilike('email', user.email)

      if (error) throw error
      setWhitelist(data || [])
    } catch (err: any) {
      console.error('Error fetching whitelist:', err)
      setWhitelistError(err.message || 'Failed to load whitelist table.')
    } finally {
      setLoadingWhitelist(false)
    }
  }, [user])

  useEffect(() => {
    fetchConfig()
    fetchWhitelist()
  }, [fetchConfig, fetchWhitelist])

  const conn = config?.connection
  const stats = config?.dataStats
  const logic = config?.dataLogic
  const git = config?.gitInfo

  return (
    <div className="flex-1 flex flex-col bg-canvas overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="px-6 py-4 border-b border-hairline flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
            <Terminal className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-ink">Dev Console</h1>
            <p className="text-xs text-ink-mute mt-0.5">
              DB · Git · Data Logic · Schema · Algorithms · Filters
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchConfig(); fetchWhitelist(); }}
            disabled={loading || loadingWhitelist}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-hairline text-xs font-medium text-ink hover:bg-canvas transition-colors disabled:opacity-40 shadow-sm"
          >
            <RefreshCw className={`w-3 h-3 ${loading || loadingWhitelist ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar-vertical">
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            Failed to load dev config: {error}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-7xl mx-auto">

          {/* ── DB Connection ── */}
          <DarkCard
            title="DB Connection"
            icon={<Database className="w-4 h-4 text-emerald-600" />}
            badge={conn
              ? <StatusBadge ok label={config?.source === 'local_env' ? 'from .env' : 'from edge fn'} />
              : <StatusBadge label="not configured" />}
          >
            {conn ? (
              <>
                <DbRow icon={<Server className="w-3.5 h-3.5 text-sky-600" />} label="PG_HOST" value={conn.host} />
                <DbRow icon={<Hash className="w-3.5 h-3.5 text-violet-600" />} label="PG_PORT" value={String(conn.port)} />
                <DbRow icon={<User className="w-3.5 h-3.5 text-amber-600" />} label="PG_USER" value={conn.user} />
                {conn.masked_password && (
                  <DbRow icon={<Shield className="w-3.5 h-3.5 text-rose-500" />} label="PG_PASSWORD" value={conn.masked_password} />
                )}
                <DbRow icon={<Layers className="w-3.5 h-3.5 text-emerald-600" />} label="PG_DATABASE" value={conn.database} />
                <DbRow icon={<Info className="w-3.5 h-3.5 text-slate-500" />} label="SSL" value={conn.ssl ? 'enabled' : 'disabled'} />
                <DbRow
                  icon={<GitBranch className="w-3.5 h-3.5 text-teal-600" />}
                  label="SOURCE"
                  value={config?.source === 'local_env' ? 'local .env file' : 'Supabase edge function'}
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
            badge={git?.branch
              ? <StatusBadge ok label={git.branch} />
              : <StatusBadge label={git?.error || 'unavailable'} />}
          >
            {git?.commits?.length ? (
              <div className="py-1">
                {git.commits.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 py-3 border-b border-hairline last:border-0">
                    <GitCommit className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="text-[10px] font-mono text-violet-600 font-semibold">{c.hash}</span>
                        <span className="text-[10px] text-ink-faint font-mono">{c.date.slice(0, 10)}</span>
                        <span className="text-[10px] text-ink-faint">{c.author}</span>
                      </div>
                      <p className="text-xs text-ink-mute truncate" title={c.message}>{c.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-xs text-ink-faint">{git?.error || 'No commits found'}</p>
            )}
          </DarkCard>

          {/* ── Supabase Whitelist ── */}
          <DarkCard
            title="Supabase Whitelist Matrix"
            icon={<Shield className="w-4 h-4 text-emerald-600" />}
            badge={loadingWhitelist
              ? <span className="text-xs text-ink-mute font-mono animate-pulse">Loading…</span>
              : <StatusBadge ok={whitelist.length > 0} label={`${whitelist.length} users`} />}
          >
            {whitelistError ? (
              <p className="py-4 text-xs text-danger font-mono">{whitelistError}</p>
            ) : whitelist.length > 0 ? (
              <div className="py-1">
                {whitelist.map((w, idx) => (
                  <div key={idx} className="flex items-center justify-between py-3 border-b border-hairline last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="text-xs font-mono font-medium text-ink truncate" title={w.email}>
                        {w.email}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 max-w-[65%] justify-end">
                      {Object.entries(w)
                        .filter(([key, val]) => key !== 'email' && key !== 'id' && key !== 'created_at' && typeof val === 'boolean')
                        .map(([key, val]) => (
                          <span
                            key={key}
                            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all ${
                              val
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-500/15'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}
                          >
                            {key}: {val ? 'true' : 'false'}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-xs text-ink-faint font-mono">No whitelist entries found in Supabase.</p>
            )}
          </DarkCard>

          {/* ── Live Data Stats ── */}
          <DarkCard title="Live Data Stats" icon={<BarChart3 className="w-4 h-4 text-violet-600" />}>
            <DbRow
              icon={<Layers className="w-3.5 h-3.5 text-emerald-600" />}
              label="TOTAL RECORDS (LC)"
              value={stats?.totalRecords != null ? stats.totalRecords.toLocaleString('en-IN') : '—'}
              highlight={stats?.totalRecords != null}
            />
            <DbRow icon={<Clock className="w-3.5 h-3.5 text-sky-600" />} label="MIN DATE" value={stats?.minDate || '—'} />
            <DbRow icon={<Clock className="w-3.5 h-3.5 text-amber-600" />} label="MAX DATE" value={stats?.maxDate || '—'} />
            <DbRow
              icon={<Server className="w-3.5 h-3.5 text-teal-600" />}
              label="FETCH ENGINE"
              value="Direct PostgreSQL"
              highlight
            />
            <DbRow
              icon={<CheckCircle2 className="w-3.5 h-3.5 text-violet-600" />}
              label="ROW CACHE"
              value={stats?.cacheStatus === 'warm' ? 'warm (in-memory)' : stats?.cacheStatus === 'cold' ? 'cold (not loaded)' : 'error'}
            />
          </DarkCard>

          {/* ── Active Filters ── */}
          <DarkCard title="Active Filters" icon={<Filter className="w-4 h-4 text-amber-600" />}>
            <DbRow label="CURRENCY" value={currency} highlight />
            <DbRow label="FISCAL YEAR" value={fy} />
            <DbRow label="AS ON DATE" value={asOnDate || '—'} />
            <DbRow label="AMOUNT UNIT" value={amountUnit} />
          </DarkCard>

          {/* ── Data Logic ── */}
          <DarkCard title="Data Logic" icon={<Code2 className="w-4 h-4 text-sky-600" />}>
            <DbRow label="TABLE" value={logic?.table || '—'} />
            <DbRow label="DATE COLUMN" value={logic?.dateColumn || '—'} />
            <DbRow label="MIN DATE FILTER" value={logic?.minDateFilter || '—'} />
            <DbRow label="CURRENCY DIVIDER" value={logic?.currencyDivider || '—'} />
            <DbRow label="FISCAL YEAR START" value={logic?.fiscalYearStart || '—'} />
            <DbRow label="WEEK DEFINITION" value={logic?.weekDefinition || '—'} />
          </DarkCard>

          {/* ── DB Schema ── */}
          <DarkCard title="DB Schema" icon={<Database className="w-4 h-4 text-blue-600" />}>
            <div className="max-h-72 overflow-y-auto custom-scrollbar-vertical divide-y divide-hairline w-full">
              {config?.dbSchema && config.dbSchema.length > 0 ? (
                config.dbSchema.map((col, idx) => (
                  <SchemaRow key={idx} table={col.table} col={col.column} type={col.type} />
                ))
              ) : (
                <p className="py-4 text-xs text-ink-mute font-mono">No schema information loaded.</p>
              )}
            </div>
          </DarkCard>

          {/* ── Column Mapping ── */}
          <div className="bg-white rounded-xl border border-hairline shadow-sm overflow-hidden xl:col-span-2">
            <CardHeader title="Column Mapping (DB → App)" icon={<ArrowRight className="w-4 h-4 text-teal-600" />} />
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {logic?.columnMapping
                ? Object.entries(logic.columnMapping).map(([db, app]) => (
                  <div key={db} className="flex items-center justify-between px-3 py-2 rounded-lg bg-canvas border border-hairline/60">
                    <span className="text-xs font-mono text-sky-600 shrink-0">{db}</span>
                    <ArrowRight className="w-3 h-3 text-ink-mute shrink-0 mx-2" />
                    <span className="text-xs font-mono text-emerald-600 truncate">{app}</span>
                  </div>
                ))
                : <span className="text-xs text-ink-mute font-mono">Loading…</span>
              }
            </div>
          </div>

          {/* ── Algorithm Notes ── */}
          <div className="bg-white rounded-xl border border-hairline shadow-sm overflow-hidden xl:col-span-2">
            <CardHeader title="Algorithm Notes" icon={<Cpu className="w-4 h-4 text-amber-600" />} />
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <AlgoBlock accent="border-blue-500" title="Exposure Weighting"
                body={`"LC Amt" is processed relative to usance credit periods and margin ratios.\nMargin amounts are computed dynamically as LC Amt × Margin.`} />
              <AlgoBlock accent="border-emerald-500" title="BOE Reconciliation"
                body="Bill of Entry matching checks the 'Lodge date' and 'Acceptance date' to classify outstanding BOE bills as 'Lodge-only' or 'Accepted'." />
              <AlgoBlock accent="border-amber-500" title="Facility Limits"
                body="Available facility balance = total limit - open LCs - open BGs. Evaluated per bank per fiscal period." />
              <AlgoBlock accent="border-purple-500" title="Payables Maturity Pacing"
                body="Payment due date projections cluster future outflows into usance cohorts (30, 60, 90, 180 days maturity bucket allocations)." />
            </div>
          </div>

          {/* ── SQL Query ── */}
          <div className="bg-white rounded-xl border border-hairline shadow-sm overflow-hidden xl:col-span-2">
            <CardHeader title="SQL Query (Data Fetch)" icon={<Code2 className="w-4 h-4 text-violet-600" />} />
            <div className="p-4">
              <pre className="text-xs font-mono text-emerald-700 bg-canvas rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed border border-hairline">
                {logic?.sqlQuery || 'Loading…'}
              </pre>
            </div>
          </div>

          {/* ── Feature Flags ── */}
          <div className="bg-white rounded-xl border border-hairline shadow-sm overflow-hidden xl:col-span-2 mb-8">
            <CardHeader title="Feature Flags (Zustand Auth Store)" icon={<Settings className="w-4 h-4 text-amber-600" />} />
            <div className="p-4 flex flex-wrap gap-2">
              {Object.keys(features).length > 0 ? (
                Object.entries(features).map(([flag, enabled]) => (
                  <div key={flag} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    enabled
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                      : 'bg-canvas border-hairline text-ink-mute'
                  }`}>
                    {enabled ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                    {flag}
                  </div>
                ))
              ) : (
                <div className="text-xs text-ink-mute italic">No feature flags registered for the current user.</div>
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
  <div className="px-4 py-3 border-b border-hairline bg-canvas-soft/30 flex items-center justify-between">
    <div className="flex items-center gap-2.5">
      {icon}
      <span className="text-xs font-semibold text-ink tracking-wide">{title}</span>
    </div>
    {children}
  </div>
)

const StatusBadge: React.FC<{ label: string; ok?: boolean }> = ({ label, ok = false }) => (
  <div className="flex items-center gap-1.5">
    {ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-500" />}
    <span className={`text-xs font-semibold font-mono ${ok ? 'text-emerald-600' : 'text-rose-500'}`}>{label}</span>
  </div>
)

const DarkCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, badge, children }) => (
  <div className="bg-white rounded-xl border border-hairline shadow-sm overflow-hidden">
    <CardHeader title={title} icon={icon}>{badge}</CardHeader>
    <div className="px-4 py-1 divide-y divide-hairline">{children}</div>
  </div>
)

const DbRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ icon, label, value, highlight = false }) => (
  <div className="flex items-center justify-between gap-3 py-2.5">
    <div className="flex items-center gap-2 shrink-0">
      {icon}
      <span className="text-[10px] font-semibold text-ink-mute uppercase tracking-wide font-mono">{label}</span>
    </div>
    <span className={`text-xs font-mono text-right truncate max-w-[60%] ${highlight ? 'text-ink font-semibold' : 'text-ink-mute'}`}>
      {value}
    </span>
  </div>
)

const SchemaRow: React.FC<{ table: string; col: string; type: string }> = ({ table, col, type }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-hairline last:border-0">
    <span className="text-[10px] font-mono text-blue-600 font-semibold shrink-0 w-28 mt-0.5">{table}</span>
    <span className="text-xs font-semibold text-ink shrink-0 w-28 font-mono">{col}</span>
    <span className="text-xs text-ink-mute font-mono">{type}</span>
  </div>
)

const AlgoBlock: React.FC<{ accent: string; title: string; body: string }> = ({ accent, title, body }) => (
  <div className="space-y-2">
    <h4 className={`text-xs font-semibold text-ink border-l-2 ${accent} pl-2.5`}>{title}</h4>
    <p className="text-xs text-ink-mute leading-relaxed whitespace-pre-line pl-2.5">{body}</p>
  </div>
)
