import React, { useEffect, useState, useCallback } from 'react'
import {
  Terminal, Database, RefreshCw, CheckCircle2, XCircle,
  Server, User, Hash, Layers, GitBranch, GitCommit, Clock,
  ArrowRight, Code2, Filter, BarChart3, Info, Cpu, Settings,
  Shield, UserCheck, Tag, Table2
} from 'lucide-react'
import { useStore } from '../../store'
import { useAuthStore, supabase } from '@grew/auth'
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

  // DB Tables state
  const [dbTables, setDbTables] = useState<string[]>([])
  const [loadingTables, setLoadingTables] = useState(true)
  const [tablesError, setTablesError] = useState<string | null>(null)

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

  const fetchTables = useCallback(async () => {
    setLoadingTables(true)
    setTablesError(null)
    try {
      const res = await api.get('/tables')
      setDbTables(res.data || [])
    } catch (err: any) {
      setTablesError(err.response?.data?.detail || err.message || 'Failed to load tables.')
    } finally {
      setLoadingTables(false)
    }
  }, [])

  const [switchingBranch, setSwitchingBranch] = useState(false)
  const [branchMessage, setBranchMessage] = useState<string | null>(null)
  const [branchError, setBranchError] = useState<string | null>(null)

  const handleBranchChange = async (newBranch: string) => {
    if (!newBranch || newBranch === git?.branch) return
    if (!window.confirm(`Are you sure you want to switch to branch "${newBranch}"?`)) return
    
    setSwitchingBranch(true)
    setBranchMessage(null)
    setBranchError(null)
    try {
      const res = await api.post('/git-branch', { branch: newBranch })
      setBranchMessage(res.data.message || `Successfully switched to ${newBranch}`)
      setTimeout(() => {
        fetchConfig()
      }, 1000)
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to switch branch.'
      setBranchError(errMsg)
    } finally {
      setSwitchingBranch(false)
    }
  }

  // State for Git Console
  const [gitCmd, setGitCmd] = useState('git status')
  const [gitOutput, setGitOutput] = useState('')
  const [runningGitCmd, setRunningGitCmd] = useState(false)
  const [gitCmdExitCode, setGitCmdExitCode] = useState<number | null>(null)

  const handleRunGitCmd = async (cmdToRun: string) => {
    if (!cmdToRun.trim()) return
    setRunningGitCmd(true)
    setGitCmdExitCode(null)
    try {
      const res = await api.post('/git-command', { command: cmdToRun })
      const { stdout, stderr, returncode } = res.data
      let outputStr = ''
      if (stdout) outputStr += stdout
      if (stderr) outputStr += (outputStr ? '\n' : '') + 'STDERR:\n' + stderr
      if (!stdout && !stderr) outputStr = '(No output)'
      setGitOutput(outputStr)
      setGitCmdExitCode(returncode)
    } catch (err: any) {
      const status = err.response?.status
      const detail = err.response?.data?.detail
      const errMsg = detail
        ? `HTTP ${status}: ${detail}`
        : (err.message || 'Failed to execute command.')
      setGitOutput(`Error: ${errMsg}`)
      setGitCmdExitCode(1)
    } finally {
      setRunningGitCmd(false)
    }
  }

  useEffect(() => {
    fetchConfig()
    fetchWhitelist()
    fetchTables()
  }, [fetchConfig, fetchWhitelist, fetchTables])

  const conn = config?.connection
  const stats = config?.dataStats
  const logic = config?.dataLogic
  const git = config?.gitInfo

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
            onClick={() => { fetchConfig(); fetchWhitelist(); fetchTables(); }}
            disabled={loading || loadingWhitelist || loadingTables}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-hairline text-[10px] font-medium text-ink hover:bg-canvas transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-2.5 h-2.5 ${loading || loadingWhitelist || loadingTables ? 'animate-spin' : ''}`} />
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
            {/* Prominent branch row */}
            <div className="flex items-center justify-between py-1 border-b border-hairline/30 pb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Tag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[10px] font-bold text-ink-mute uppercase font-mono">BRANCH</span>
              </div>
              <div className="flex items-center gap-1.5">
                {git?.branches && git.branches.length > 0 ? (
                  <select
                    disabled={switchingBranch}
                    value={git.branch || ''}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5 text-emerald-700 outline-none hover:bg-emerald-500/20 transition-all cursor-pointer font-mono"
                  >
                    {git.branches.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                ) : (
                  <span className="font-mono text-ink font-semibold">{git?.branch || '—'}</span>
                )}
                {switchingBranch && <RefreshCw className="w-3 h-3 text-emerald-600 animate-spin" />}
              </div>
            </div>

            {/* Status messages for branch switching */}
            {branchMessage && (
              <div className="mt-1 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[9px] font-mono">
                {branchMessage}
              </div>
            )}
            {branchError && (
              <div className="mt-1 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[9px] font-mono">
                {branchError}
              </div>
            )}
            {git?.commits?.length ? (
              <div className="divide-y divide-hairline">
                {git.commits.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5">
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

          {/* ── Git Console Card ── */}
          <DarkCard
            title="Git Console"
            icon={<Terminal className="w-3.5 h-3.5 text-violet-600" />}
            badge={gitCmdExitCode !== null ? (
              <StatusBadge ok={gitCmdExitCode === 0} label={gitCmdExitCode === 0 ? 'exit 0' : `exit ${gitCmdExitCode}`} />
            ) : null}
          >
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={gitCmd}
                  onChange={(e) => setGitCmd(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRunGitCmd(gitCmd)
                  }}
                  placeholder="e.g. git status"
                  className="flex-1 text-[10px] font-mono bg-canvas border border-hairline rounded px-2 py-1 text-ink outline-none focus:border-violet-500 transition-colors"
                />
                <button
                  onClick={() => handleRunGitCmd(gitCmd)}
                  disabled={runningGitCmd}
                  className="flex items-center gap-1 px-3 py-1 bg-violet-600 border border-violet-700 text-white rounded text-[10px] font-semibold hover:bg-violet-700 transition-colors disabled:opacity-40"
                >
                  {runningGitCmd ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : 'Run'}
                </button>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-1.5 py-0.5 border-b border-hairline/30 pb-1.5">
                <button
                  onClick={() => { setGitCmd('git status'); handleRunGitCmd('git status'); }}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono text-[9px] font-medium transition-colors"
                >
                  git status
                </button>
                <button
                  onClick={() => { setGitCmd('git diff'); handleRunGitCmd('git diff'); }}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono text-[9px] font-medium transition-colors"
                >
                  git diff
                </button>
                <button
                  onClick={() => { setGitCmd('git branch -a'); handleRunGitCmd('git branch -a'); }}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono text-[9px] font-medium transition-colors"
                >
                  git branch -a
                </button>
                <button
                  onClick={() => { setGitCmd('git log -n 5 --oneline'); handleRunGitCmd('git log -n 5 --oneline'); }}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-mono text-[9px] font-medium transition-colors"
                >
                  git log -5
                </button>
              </div>

              {/* Output terminal window */}
              <div className="bg-slate-950 rounded border border-slate-800 p-2 min-h-[140px] max-h-[220px] overflow-auto font-mono text-[10px] text-emerald-400 custom-scrollbar-vertical whitespace-pre-wrap selection:bg-emerald-500/25">
                {gitOutput || 'Type a git command above and click Run.'}
              </div>
            </div>
          </DarkCard>

          {/* ── Supabase Whitelist ── */}
          <DarkCard
            title="Whitelist"
            icon={<Shield className="w-3.5 h-3.5 text-emerald-600" />}
            badge={loadingWhitelist
              ? <span className="text-[10px] text-ink-mute font-mono animate-pulse">…</span>
              : <StatusBadge ok={whitelist.length > 0} label={`${whitelist.length} user`} />}
          >
            {whitelistError ? (
              <p className="py-1 text-[10px] text-danger font-mono">{whitelistError}</p>
            ) : whitelist.length > 0 ? (
              <div className="max-h-20 overflow-y-auto custom-scrollbar-vertical divide-y divide-hairline">
                {whitelist.map((w, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="text-[10px] font-mono font-medium text-ink truncate">{w.email}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 shrink-0 max-w-[60%] justify-end">
                      {Object.entries(w)
                        .filter(([k, v]) => k !== 'email' && k !== 'id' && k !== 'created_at' && typeof v === 'boolean')
                        .map(([k, v]) => (
                          <span key={k} className={`text-[9px] font-semibold px-1.5 py-px rounded-full border ${v ? 'bg-emerald-50 text-emerald-700 border-emerald-500/15' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                            {k}
                          </span>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-1 text-[10px] text-ink-faint font-mono">No whitelist entries found.</p>
            )}
          </DarkCard>

          {/* ── DB Tables ── */}
          <DarkCard
            title="DB Tables"
            icon={<Table2 className="w-3.5 h-3.5 text-blue-600" />}
            badge={loadingTables
              ? <span className="text-[10px] text-ink-mute font-mono animate-pulse">…</span>
              : <StatusBadge ok={dbTables.length > 0} label={`${dbTables.length} tables`} />}
          >
            {tablesError ? (
              <p className="py-1 text-[10px] text-danger font-mono">{tablesError}</p>
            ) : (
              <div className="max-h-40 overflow-y-auto custom-scrollbar-vertical divide-y divide-hairline">
                {dbTables.length > 0 ? dbTables.map((tbl, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 py-1">
                    <Database className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                    <span className="text-[10px] font-mono text-ink truncate" title={tbl}>{tbl}</span>
                  </div>
                )) : (
                  <p className="py-1 text-[10px] text-ink-faint font-mono">No tables found.</p>
                )}
              </div>
            )}
          </DarkCard>

          {/* ── Live Data Stats ── */}
          <DarkCard title="Data Stats" icon={<BarChart3 className="w-3.5 h-3.5 text-violet-600" />}>
            <DbRow icon={<Layers className="w-3 h-3 text-emerald-600" />} label="TOTAL RECORDS (LC)" value={stats?.totalRecords != null ? stats.totalRecords.toLocaleString('en-IN') : '—'} highlight={stats?.totalRecords != null} />
            <DbRow icon={<Clock className="w-3 h-3 text-sky-600" />} label="MIN DATE" value={stats?.minDate || '—'} />
            <DbRow icon={<Clock className="w-3 h-3 text-amber-600" />} label="MAX DATE" value={stats?.maxDate || '—'} />
            <DbRow icon={<Server className="w-3 h-3 text-teal-600" />} label="FETCH ENGINE" value="Direct PostgreSQL" highlight />
            <DbRow icon={<CheckCircle2 className="w-3 h-3 text-violet-600" />} label="ROW CACHE" value={stats?.cacheStatus === 'warm' ? 'warm' : stats?.cacheStatus === 'cold' ? 'cold' : 'error'} />
          </DarkCard>

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

          {/* ── DB Schema ── */}
          <DarkCard title="DB Schema" icon={<Database className="w-3.5 h-3.5 text-blue-600" />}>
            <div className="max-h-24 overflow-y-auto custom-scrollbar-vertical divide-y divide-hairline w-full">
              {config?.dbSchema && config.dbSchema.length > 0 ? (
                config.dbSchema.map((col, idx) => (
                  <SchemaRow key={idx} table={col.table} col={col.column} type={col.type} />
                ))
              ) : (
                <p className="py-1 text-[10px] text-ink-mute font-mono">No schema information loaded.</p>
              )}
            </div>
          </DarkCard>

          {/* ── Column Mapping ── */}
          <div className="bg-white rounded-lg border border-hairline shadow-sm overflow-hidden xl:col-span-2">
            <CardHeader title="Column Mapping (DB → App)" icon={<ArrowRight className="w-3.5 h-3.5 text-teal-600" />} />
            <div className="p-2 grid grid-cols-2 lg:grid-cols-3 gap-1">
              {logic?.columnMapping
                ? Object.entries(logic.columnMapping).map(([db, app]) => (
                  <div key={db} className="flex items-center gap-1 px-2 py-1 rounded bg-canvas border border-hairline/60 text-[10px]">
                    <span className="font-mono text-sky-600 shrink-0 truncate">{db}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-ink-mute shrink-0" />
                    <span className="font-mono text-emerald-600 truncate">{app}</span>
                  </div>
                ))
                : <span className="text-xs text-ink-mute font-mono">Loading…</span>
              }
            </div>
          </div>

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

          {/* ── SQL Query ── */}
          <div className="bg-white rounded-lg border border-hairline shadow-sm overflow-hidden xl:col-span-2">
            <CardHeader title="SQL Query (Data Fetch)" icon={<Code2 className="w-3.5 h-3.5 text-violet-600" />} />
            <div className="p-2">
              <pre className="text-[10px] font-mono text-emerald-700 bg-canvas rounded p-2 overflow-x-auto whitespace-pre-wrap leading-snug border border-hairline">
                {logic?.sqlQuery || 'Loading…'}
              </pre>
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

const SchemaRow: React.FC<{ table: string; col: string; type: string }> = ({ table, col, type }) => (
  <div className="flex items-start gap-2 py-1 border-b border-hairline last:border-0">
    <span className="text-[9px] font-mono text-blue-600 font-semibold shrink-0 w-20">{table}</span>
    <span className="text-[10px] font-semibold text-ink shrink-0 w-28 font-mono">{col}</span>
    <span className="text-[10px] text-ink-mute font-mono truncate">{type}</span>
  </div>
)

const AlgoBlock: React.FC<{ accent: string; title: string; body: string }> = ({ accent, title, body }) => (
  <div className="px-1.5 py-1 rounded bg-canvas border border-hairline/60">
    <h4 className={`text-[9px] font-semibold text-ink border-l-2 ${accent} pl-1 mb-0.5`}>{title}</h4>
    <p className="text-[9px] text-ink-mute leading-snug pl-1">{body}</p>
  </div>
)
