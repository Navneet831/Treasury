import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Percent, ArrowDownToLine, RefreshCw, Grid, Table, CheckCircle2, XCircle, HelpCircle,
  TrendingUp, CreditCard, AlertTriangle, Building, BookOpen, Layers
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InterestRow {
  account: string;
  type: string;
  bank: string;
  month: string;
  monthKey: string;
  fy: string;
  openingBal: number | null;
  closingBal: number | null;
  roi: number | null;
  intRecovered: number;
  intCalculated: number | null;
  variance: number;
  variancePct: number;
  tableFound: boolean;
  tableName: string | null;
}

interface InterestSummaryData {
  rows: InterestRow[];
  months: string[];
  monthLabels: Record<string, string>;
  fyList: string[];
}

interface StatementTxn {
  txn_date: string;
  value_date?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
}

export const InterestSummary: React.FC = () => {
  const [data, setData] = useState<InterestSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters State
  const [selectedType, setSelectedType] = useState<string>('All')
  const [selectedBank, setSelectedBank] = useState<string>('All')
  const [selectedAccount, setSelectedAccount] = useState<string>('All')
  const [selectedFy, setSelectedFy] = useState<string>('All FYs')
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]) // empty means 'All'
  const [showEmptyAccounts, setShowEmptyAccounts] = useState<boolean>(false)

  // UI View Modes: 'all' | 'summary' | 'pivot'
  const [viewMode, setViewMode] = useState<'all' | 'summary' | 'pivot'>('all')

  // Selected Account for Bottom Drilldown
  const [drilldownAccount, setDrilldownAccount] = useState<string>('')
  const [txnList, setTxnList] = useState<StatementTxn[]>([])
  const [loadingTxns, setLoadingTxns] = useState(false)
  const [txnError, setTxnError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/treasury/interest-summary')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const payload: InterestSummaryData = await res.json()
      setData(payload)
      
      // Auto-select first account for drilldown if none selected
      if (payload.rows.length > 0) {
        const uniqueAccounts = Array.from(new Set(payload.rows.map(r => r.account)))
        if (uniqueAccounts.length > 0 && !drilldownAccount) {
          setDrilldownAccount(uniqueAccounts[0])
        }
      }
    } catch (err: any) {
      console.error('Error fetching interest summary:', err)
      setError(err.message || 'Failed to load interest summary data.')
    } finally {
      setLoading(false)
    }
  }, [drilldownAccount])

  useEffect(() => {
    fetchData()
  }, [])

  // Unique options for filters
  const accountTypes = useMemo(() => {
    if (!data) return []
    return ['All', ...Array.from(new Set(data.rows.map(r => r.type))).sort()]
  }, [data])

  const banks = useMemo(() => {
    if (!data) return []
    return ['All', ...Array.from(new Set(data.rows.map(r => r.bank))).sort()]
  }, [data])

  // Filter bank summary rows based on type/bank selection
  const filteredAccountsForSelect = useMemo(() => {
    if (!data) return []
    let temp = data.rows
    if (selectedType !== 'All') {
      temp = temp.filter(r => r.type === selectedType)
    }
    if (selectedBank !== 'All') {
      temp = temp.filter(r => r.bank === selectedBank)
    }
    return ['All', ...Array.from(new Set(temp.map(r => r.account))).sort()]
  }, [data, selectedType, selectedBank])

  // Reset selected account filter if it's not valid in current selection
  useEffect(() => {
    if (selectedAccount !== 'All' && !filteredAccountsForSelect.includes(selectedAccount)) {
      setSelectedAccount('All')
    }
  }, [filteredAccountsForSelect, selectedAccount])

  // Months available for selected FY
  const monthsForSelectedFy = useMemo(() => {
    if (!data) return []
    const months = data.months
    if (selectedFy === 'All FYs') return months
    return months.filter(mk => {
      // Find a row with this month key and selected FY to confirm match
      const matchingRow = data.rows.find(r => r.monthKey === mk && r.fy === selectedFy)
      return !!matchingRow
    })
  }, [data, selectedFy])

  // Clean months filter selection if FY changes
  useEffect(() => {
    setSelectedMonths([])
  }, [selectedFy])

  // Master filter application
  const processedRows = useMemo(() => {
    if (!data) return []
    return data.rows.filter(r => {
      // 1. Account type
      if (selectedType !== 'All' && r.type !== selectedType) return false
      // 2. Bank
      if (selectedBank !== 'All' && r.bank !== selectedBank) return false
      // 3. Account number
      if (selectedAccount !== 'All' && r.account !== selectedAccount) return false
      // 4. FY
      if (selectedFy !== 'All FYs' && r.fy !== selectedFy) return false
      // 5. Month
      if (selectedMonths.length > 0 && !selectedMonths.includes(r.monthKey)) return false
      // 6. Has statement data filter
      if (!showEmptyAccounts && !r.tableFound) return false
      return true
    })
  }, [data, selectedType, selectedBank, selectedAccount, selectedFy, selectedMonths, showEmptyAccounts])

  // Metrics calculations
  const metrics = useMemo(() => {
    const uniqueAccounts = new Set<string>()
    let totalRecovered = 0
    let totalCalculated = 0
    let totalVariance = 0

    processedRows.forEach(r => {
      uniqueAccounts.add(r.account)
      totalRecovered += r.intRecovered || 0
      totalCalculated += r.intCalculated || 0
      totalVariance += r.variance || 0
    })

    return {
      accountCount: uniqueAccounts.size,
      totalRecovered,
      totalCalculated,
      totalVariance
    }
  }, [processedRows])

  // Pivot formatting functions
  const activeMonthsList = useMemo(() => {
    if (!data) return []
    const baseList = selectedFy === 'All FYs' ? data.months : data.months.filter(m => {
      const match = data.rows.find(r => r.monthKey === m && r.fy === selectedFy)
      return !!match
    })
    if (selectedMonths.length > 0) {
      return baseList.filter(m => selectedMonths.includes(m))
    }
    return baseList
  }, [data, selectedFy, selectedMonths])

  // 1. Opening/Closing Summary Rows
  const openingClosingSummary = useMemo(() => {
    const acctMap: Record<string, { account: string; type: string; bank: string; [key: string]: any }> = {}
    
    processedRows.forEach(r => {
      if (!acctMap[r.account]) {
        acctMap[r.account] = { account: r.account, type: r.type, bank: r.bank }
      }
      acctMap[r.account][`open_${r.monthKey}`] = r.openingBal
      acctMap[r.account][`close_${r.monthKey}`] = r.closingBal
    })

    return Object.values(acctMap).sort((a, b) => a.account.localeCompare(b.account))
  }, [processedRows])

  // 2. Wide Account Pivot Rows
  const widePivotRows = useMemo(() => {
    const acctMap: Record<string, { account: string; type: string; bank: string; [key: string]: any }> = {}
    
    processedRows.forEach(r => {
      if (!acctMap[r.account]) {
        acctMap[r.account] = { account: r.account, type: r.type, bank: r.bank }
      }
      acctMap[r.account][`roi_${r.monthKey}`] = r.roi
      acctMap[r.account][`open_${r.monthKey}`] = r.openingBal
      acctMap[r.account][`close_${r.monthKey}`] = r.closingBal
      acctMap[r.account][`recovered_${r.monthKey}`] = r.intRecovered
      acctMap[r.account][`calculated_${r.monthKey}`] = r.intCalculated
      acctMap[r.account][`variance_${r.monthKey}`] = r.variance
    })

    return Object.values(acctMap).sort((a, b) => a.account.localeCompare(b.account))
  }, [processedRows])

  // Load drilldown transactions
  const fetchTransactions = useCallback(async (accountNo: string) => {
    if (!accountNo) return
    
    // Find resolved table name from row data
    const matchedRow = data?.rows.find(r => r.account === accountNo && r.tableName)
    const tblName = matchedRow ? matchedRow.tableName : accountNo

    setLoadingTxns(true)
    setTxnError(null)
    setTxnList([])

    try {
      const res = await fetch(`/api/treasury/tables/${tblName}`)
      if (!res.ok) {
        if (res.status === 400 || res.status === 500) {
          throw new Error('No statement data table matches this account number.')
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const rawTxns = await res.json()
      
      // Sort transactions by date
      const formattedTxns: StatementTxn[] = rawTxns.map((t: any) => ({
        txn_date: t.txn_date,
        value_date: t.value_date,
        description: t.description || '',
        debit: parseFloat(t.debit || 0),
        credit: parseFloat(t.credit || 0),
        balance: t.balance !== null ? parseFloat(t.balance) : null
      }))
      
      setTxnList(formattedTxns)
    } catch (err: any) {
      console.error('Error fetching statement transactions:', err)
      setTxnError(err.message || 'Failed to load statement details.')
    } finally {
      setLoadingTxns(false)
    }
  }, [data])

  useEffect(() => {
    if (drilldownAccount) {
      fetchTransactions(drilldownAccount)
    }
  }, [drilldownAccount, fetchTransactions])

  // CSV Exporter
  const handleDownloadCsv = () => {
    if (processedRows.length === 0) return

    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "Account,Type,Bank,Month,Opening Bal,Closing Bal,ROI (%),Int Recovered,Int Calculated,Variance,Var %\n"

    processedRows.forEach(r => {
      const row = [
        r.account,
        r.type,
        r.bank,
        r.month,
        r.openingBal ?? '',
        r.closingBal ?? '',
        r.roi ?? '',
        r.intRecovered,
        r.intCalculated ?? '',
        r.variance,
        r.variancePct
      ].map(val => `"${val}"`).join(",")
      csvContent += row + "\n"
    })

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", "bank_roi_analysis.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Format currency in Lakhs/Crores
  const formatAmt = (val: number | null) => {
    if (val === null || isNaN(val)) return '-'
    if (val === 0) return '0.00'
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  return (
    <div className="flex-1 flex flex-col bg-canvas overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Header */}
      <div className="px-4 py-2 border-b border-hairline flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Percent className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xs font-semibold text-ink leading-none">interest</h1>
            <p className="text-[10px] text-ink-mute mt-0.5">
              Reconciliation between interest charged vs calculated simple interest on daily statement balances.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-hairline text-[11px] font-medium text-ink hover:bg-canvas transition-colors disabled:opacity-40 shadow-sm font-mono"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={processedRows.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 border border-emerald-700 text-[11px] font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-40 shadow-sm"
          >
            <ArrowDownToLine className="w-3 h-3" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Main Content Pane */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar-vertical">

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs text-ink-mute font-mono">Computing interest reconciliation...</p>
          </div>
        ) : error ? (
          <div className="px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm flex items-center gap-2 max-w-2xl mx-auto">
            <XCircle className="w-4 h-4 shrink-0" />
            Failed to load data: {error}
          </div>
        ) : (
          <>
            {/* Filters Bar */}
            <div className="bg-white rounded-xl border border-hairline p-2 px-3 shadow-sm grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-2 items-end">
              <div>
                <label className="block text-[10px] font-bold text-ink-mute uppercase tracking-wide mb-0.5 font-mono">Account Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full text-xs bg-canvas border border-hairline rounded-lg px-2 py-1 text-ink outline-none focus:border-emerald-500 transition-colors"
                >
                  {accountTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-ink-mute uppercase tracking-wide mb-0.5 font-mono">Bank</label>
                <select
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full text-xs bg-canvas border border-hairline rounded-lg px-2 py-1 text-ink outline-none focus:border-emerald-500 transition-colors"
                >
                  {banks.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-ink-mute uppercase tracking-wide mb-0.5 font-mono">Filter by Account No.</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full text-xs bg-canvas border border-hairline rounded-lg px-2 py-1 text-ink outline-none focus:border-emerald-500 transition-colors"
                >
                  {filteredAccountsForSelect.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-ink-mute uppercase tracking-wide mb-0.5 font-mono">Fiscal Year</label>
                <select
                  value={selectedFy}
                  onChange={(e) => setSelectedFy(e.target.value)}
                  className="w-full text-xs bg-canvas border border-hairline rounded-lg px-2 py-1 text-ink outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="All FYs">All FYs</option>
                  {data?.fyList.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2 items-stretch">
                <label className="flex items-center gap-1.5 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEmptyAccounts}
                    onChange={(e) => setShowEmptyAccounts(e.target.checked)}
                    className="accent-emerald-600 rounded"
                  />
                  <span className="text-[10px] font-semibold text-ink-mute">Show empty accounts</span>
                </label>
                
                {/* Month Picker dropdown wrapper */}
                <div className="relative">
                  <div className="text-[10px] font-bold text-ink-mute uppercase tracking-wide mb-0.5 font-mono">Months Filter</div>
                  <div className="flex flex-wrap gap-1 border border-hairline bg-canvas rounded-lg px-2 py-1 text-[11px] text-ink max-h-16 overflow-y-auto">
                    {monthsForSelectedFy.map(mKey => {
                      const label = data?.monthLabels[mKey] || mKey
                      const isSelected = selectedMonths.includes(mKey)
                      return (
                        <button
                          key={mKey}
                          onClick={() => {
                            setSelectedMonths(prev =>
                              prev.includes(mKey) ? prev.filter(x => x !== mKey) : [...prev, mKey]
                            )
                          }}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-semibold border transition-all ${
                            isSelected
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
                              : 'bg-white border-hairline text-ink-mute hover:bg-canvas'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                    {monthsForSelectedFy.length === 0 && (
                      <span className="text-ink-faint italic text-[10px]">No months found</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics cards row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <MetricCard
                title="Accounts Selected"
                icon={<Building className="w-4 h-4 text-sky-600" />}
                value={String(metrics.accountCount)}
                subtitle="Unique accounts analyzed"
              />
              <MetricCard
                title="Total Int (Recovered)"
                icon={<CreditCard className="w-4 h-4 text-emerald-600" />}
                value={`₹ ${formatAmt(metrics.totalRecovered)}`}
                subtitle="Sum of statement credits"
              />
              <MetricCard
                title="Total Int (Calculated)"
                icon={<TrendingUp className="w-4 h-4 text-violet-600" />}
                value={`₹ ${formatAmt(metrics.totalCalculated)}`}
                subtitle="Based on opening balance & ROI"
              />
              <MetricCard
                title="Total Variance"
                icon={<AlertTriangle className="w-4 h-4 text-amber-600" />}
                value={`₹ ${formatAmt(metrics.totalVariance)}`}
                subtitle="Interest Recovered - Calculated"
                highlight={metrics.totalVariance !== 0}
                alertType={metrics.totalVariance < 0 ? 'warning' : 'info'}
              />
            </div>

            {/* View Mode Selector Tabs */}
            <div className="flex border-b border-hairline shrink-0 gap-4">
              <button
                onClick={() => setViewMode('all')}
                className={`py-2 px-1 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                  viewMode === 'all'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-ink-mute hover:text-ink'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                All Rows (Month-wise)
              </button>
              <button
                onClick={() => setViewMode('summary')}
                className={`py-2 px-1 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                  viewMode === 'summary'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-ink-mute hover:text-ink'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Opening/Closing Summary
              </button>
              <button
                onClick={() => setViewMode('pivot')}
                className={`py-2 px-1 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                  viewMode === 'pivot'
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-ink-mute hover:text-ink'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                Pivot by Account (Wide)
              </button>
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-xl border border-hairline shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto max-h-[500px] custom-scrollbar-horizontal custom-scrollbar-vertical">
                
                {viewMode === 'all' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-canvas-soft border-b border-hairline">
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Account</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Type</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Bank</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Month</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-right">Opening Bal</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-right">Closing Bal</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-right">ROI (%)</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-right">Int Recovered</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-right">Int Calculated</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-right">Variance</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-right">Var %</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-center">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline text-xs">
                      {processedRows.map((r, idx) => (
                        <tr
                          key={idx}
                          onClick={() => r.tableFound && setDrilldownAccount(r.account)}
                          className={`hover:bg-canvas-soft/40 transition-colors ${
                            r.tableFound ? 'cursor-pointer' : 'opacity-60'
                          } ${drilldownAccount === r.account ? 'bg-emerald-500/5' : ''}`}
                        >
                          <td className="p-3 font-mono font-medium text-ink">{r.account}</td>
                          <td className="p-3 text-ink-mute">{r.type}</td>
                          <td className="p-3 font-semibold text-ink-mute">{r.bank}</td>
                          <td className="p-3 text-ink font-mono">{r.month}</td>
                          <td className="p-3 text-right font-mono text-ink-mute">{formatAmt(r.openingBal)}</td>
                          <td className="p-3 text-right font-mono text-ink-mute">{formatAmt(r.closingBal)}</td>
                          <td className="p-3 text-right font-mono font-semibold text-sky-600">{r.roi !== null ? `${r.roi.toFixed(2)}%` : '-'}</td>
                          <td className="p-3 text-right font-mono font-medium text-emerald-600">{formatAmt(r.intRecovered)}</td>
                          <td className="p-3 text-right font-mono text-ink">{formatAmt(r.intCalculated)}</td>
                          <td className={`p-3 text-right font-mono font-semibold ${
                            r.variance < 0 ? 'text-amber-600' : r.variance > 0 ? 'text-emerald-700' : 'text-ink-mute'
                          }`}>
                            {formatAmt(r.variance)}
                          </td>
                          <td className="p-3 text-right font-mono text-ink-mute">{r.roi !== null && r.openingBal !== null ? `${r.variancePct.toFixed(1)}%` : '-'}</td>
                          <td className="p-3 text-center">
                            {r.tableFound ? (
                              <span className="inline-flex items-center justify-center p-1 bg-emerald-500/10 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center p-1 bg-rose-500/10 rounded-full" title="Statement table not found">
                                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {processedRows.length === 0 && (
                        <tr>
                          <td colSpan={12} className="p-8 text-center text-xs text-ink-mute italic">
                            No rows matched the active filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {viewMode === 'summary' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-canvas-soft border-b border-hairline">
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Account</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Type</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Bank</th>
                        {activeMonthsList.map(m => (
                          <React.Fragment key={m}>
                            <th className="sticky top-0 bg-sky-100 z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-right">Open ({data?.monthLabels[m]})</th>
                            <th className="sticky top-0 bg-amber-100 z-10 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono text-right">Close ({data?.monthLabels[m]})</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline text-xs font-mono">
                      {openingClosingSummary.map((acctRow, idx) => (
                        <tr
                          key={idx}
                          onClick={() => setDrilldownAccount(acctRow.account)}
                          className={`hover:bg-canvas-soft/40 cursor-pointer transition-colors ${
                            drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''
                          }`}
                        >
                          <td className="p-3 font-semibold text-ink">{acctRow.account}</td>
                          <td className="p-3 text-ink-mute font-sans">{acctRow.type}</td>
                          <td className="p-3 text-ink-mute font-sans">{acctRow.bank}</td>
                          {activeMonthsList.map(m => (
                            <React.Fragment key={m}>
                              <td className="p-3 text-right text-ink-mute bg-sky-500/5">{formatAmt(acctRow[`open_${m}`])}</td>
                              <td className="p-3 text-right text-ink-mute bg-amber-500/5">{formatAmt(acctRow[`close_${m}`])}</td>
                            </React.Fragment>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {viewMode === 'pivot' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-canvas-soft border-b border-hairline">
                        <th className="sticky top-0 bg-canvas-soft z-20 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Account</th>
                        <th className="sticky top-0 bg-canvas-soft z-20 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Type</th>
                        <th className="sticky top-0 bg-canvas-soft z-20 p-3 text-[10px] font-bold text-ink-mute uppercase font-mono">Bank</th>
                        {activeMonthsList.map(m => (
                          <th key={m} colSpan={6} className="sticky top-0 bg-emerald-100 z-10 p-3 text-[10px] font-bold text-ink border-l border-hairline text-center">
                            {data?.monthLabels[m]}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-canvas-soft/70 border-b border-hairline text-[9px] font-mono text-ink-mute uppercase">
                        <th colSpan={3} className="sticky top-[38px] bg-canvas-soft z-20"></th>
                        {activeMonthsList.map(m => (
                          <React.Fragment key={m}>
                            <th className="sticky top-[38px] bg-canvas-soft z-10 p-2 border-l border-hairline text-right">ROI</th>
                            <th className="sticky top-[38px] bg-canvas-soft z-10 p-2 text-right">Open</th>
                            <th className="sticky top-[38px] bg-canvas-soft z-10 p-2 text-right">Close</th>
                            <th className="sticky top-[38px] bg-canvas-soft z-10 p-2 text-right">Recov.</th>
                            <th className="sticky top-[38px] bg-canvas-soft z-10 p-2 text-right">Calc.</th>
                            <th className="sticky top-[38px] bg-canvas-soft z-10 p-2 text-right">Var</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline text-xs font-mono">
                      {widePivotRows.map((acctRow, idx) => (
                        <tr
                          key={idx}
                          onClick={() => setDrilldownAccount(acctRow.account)}
                          className={`hover:bg-canvas-soft/40 cursor-pointer transition-colors ${
                            drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''
                          }`}
                        >
                          <td className="p-3 font-semibold text-ink">{acctRow.account}</td>
                          <td className="p-3 text-ink-mute font-sans">{acctRow.type}</td>
                          <td className="p-3 text-ink-mute font-sans">{acctRow.bank}</td>
                          {activeMonthsList.map(m => {
                            const v = acctRow[`variance_${m}`]
                            return (
                              <React.Fragment key={m}>
                                <td className="p-2 border-l border-hairline text-right text-sky-600 font-semibold">
                                  {acctRow[`roi_${m}`] !== null ? `${acctRow[`roi_${m}`].toFixed(1)}%` : '-'}
                                </td>
                                <td className="p-2 text-right text-ink-mute">{formatAmt(acctRow[`open_${m}`])}</td>
                                <td className="p-2 text-right text-ink-mute">{formatAmt(acctRow[`close_${m}`])}</td>
                                <td className="p-2 text-right text-emerald-600 font-medium">{formatAmt(acctRow[`recovered_${m}`])}</td>
                                <td className="p-2 text-right text-ink">{formatAmt(acctRow[`calculated_${m}`])}</td>
                                <td className={`p-2 text-right font-semibold ${v < 0 ? 'text-amber-600' : v > 0 ? 'text-emerald-700' : 'text-ink-mute'}`}>
                                  {formatAmt(v)}
                                </td>
                              </React.Fragment>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

              </div>
            </div>

            {/* Drilldown Section */}
            {drilldownAccount && (
              <div className="bg-white rounded-xl border border-hairline shadow-sm overflow-hidden flex flex-col xl:flex-row gap-6 p-6">
                
                {/* Account Details Box */}
                <div className="w-full xl:w-2/5 space-y-4">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-ink tracking-wide uppercase font-mono">Account Interest Analysis</h3>
                  </div>

                  <div className="p-4 bg-canvas rounded-lg space-y-3.5 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-hairline/60">
                      <span className="text-ink-mute font-medium">Account Number</span>
                      <span className="font-mono font-semibold text-ink">{drilldownAccount}</span>
                    </div>
                    {processedRows.filter(r => r.account === drilldownAccount).slice(0, 1).map((info, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex justify-between py-1.5 border-b border-hairline/60">
                          <span className="text-ink-mute font-medium">Type / Bank</span>
                          <span className="text-ink font-semibold">{info.type} | {info.bank}</span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-hairline/60">
                          <span className="text-ink-mute font-medium">ROI rate</span>
                          <span className="font-mono font-bold text-sky-600">{info.roi !== null ? `${info.roi.toFixed(2)}%` : 'No ROI configured'}</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Monthly data cards */}
                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar-vertical">
                    <h4 className="text-[10px] font-bold text-ink-mute uppercase tracking-wide font-mono">Monthly Splits</h4>
                    {processedRows.filter(r => r.account === drilldownAccount).map((r, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-lg border border-hairline/60 hover:bg-canvas transition-colors">
                        <div>
                          <div className="text-xs font-bold text-ink font-mono">{r.month}</div>
                          <div className="text-[10px] text-ink-mute">ROI: {r.roi !== null ? `${r.roi.toFixed(2)}%` : '-'}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-bold text-emerald-600 font-mono">₹ {formatAmt(r.intRecovered)} <span className="text-[9px] text-ink-mute font-normal">Rec</span></div>
                          <div className="text-[10px] text-ink-mute font-mono">₹ {formatAmt(r.intCalculated)} <span className="text-[9px] text-ink-faint">Calc</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transactions list Box */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs font-bold text-ink tracking-wide uppercase font-mono">Statement Transactions</h3>
                    </div>
                    {txnList.length > 0 && (
                      <span className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-mono">
                        {txnList.length} rows
                      </span>
                    )}
                  </div>

                  {loadingTxns ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 bg-canvas rounded-xl border border-hairline border-dashed">
                      <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
                      <p className="text-[10px] text-ink-mute font-mono">Loading transaction statements...</p>
                    </div>
                  ) : txnError ? (
                    <div className="p-6 text-center text-xs text-rose-500 bg-rose-500/5 rounded-xl border border-rose-500/10 font-mono">
                      {txnError}
                    </div>
                  ) : txnList.length > 0 ? (
                    <div className="border border-hairline rounded-xl overflow-hidden bg-canvas">
                      <div className="overflow-x-auto max-h-72 custom-scrollbar-vertical custom-scrollbar-horizontal">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-white border-b border-hairline text-[9px] font-bold text-ink-mute uppercase font-mono">
                              <th className="sticky top-0 bg-white z-10 p-2.5">Date</th>
                              <th className="sticky top-0 bg-white z-10 p-2.5">Description</th>
                              <th className="sticky top-0 bg-white z-10 p-2.5 text-right">Debit</th>
                              <th className="sticky top-0 bg-white z-10 p-2.5 text-right">Credit</th>
                              <th className="sticky top-0 bg-white z-10 p-2.5 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline text-[11px] font-mono bg-white">
                            {txnList.map((t, idx) => (
                              <tr key={idx} className="hover:bg-canvas-soft/35 transition-colors">
                                <td className="p-2.5 text-ink-mute truncate max-w-[80px]" title={t.txn_date}>{t.txn_date}</td>
                                <td className="p-2.5 text-ink max-w-[200px] truncate" title={t.description}>{t.description}</td>
                                <td className="p-2.5 text-right text-rose-600">{t.debit > 0 ? formatAmt(t.debit) : '-'}</td>
                                <td className="p-2.5 text-right text-emerald-600 font-medium">{t.credit > 0 ? formatAmt(t.credit) : '-'}</td>
                                <td className="p-2.5 text-right text-ink font-semibold">{t.balance !== null ? formatAmt(t.balance) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-xs text-ink-mute italic bg-canvas rounded-xl border border-hairline border-dashed">
                      No transaction statements found for this account.
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* About Box */}
            <div className="bg-white rounded-xl border border-hairline p-4 shadow-sm text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-ink font-semibold">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                <span>How interest summary calculations work:</span>
              </div>
              <ul className="list-disc pl-5 text-ink-mute space-y-1.5">
                <li><strong>Opening Balance</strong>: The first balance entry discovered in the statement table for the given month.</li>
                <li><strong>Closing Balance</strong>: The final balance entry of the month, adjusted to exclude interest-charged debit items.</li>
                <li><strong>Interest Recovered</strong>: Sum of all credits matching standard interest recovery transaction descriptions.</li>
                <li><strong>Interest Calculated</strong>: Computed simple interest = <span className="font-mono bg-canvas px-1 rounded">|Opening Balance| × ROI% / 100 × (days in month / 365)</span>.</li>
                <li><strong>Variance</strong>: Interest Recovered minus Calculated Interest. Highlights over- or under-recovery.</li>
              </ul>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string;
  icon: React.ReactNode;
  value: string;
  subtitle: string;
  highlight?: boolean;
  alertType?: 'info' | 'warning';
}

const MetricCard: React.FC<MetricCardProps> = ({ title, icon, value, subtitle, highlight = false, alertType = 'info' }) => {
  return (
    <div className={`p-2.5 px-3 bg-white rounded-xl border shadow-sm transition-all flex items-center justify-between h-16 ${
      highlight
        ? alertType === 'warning'
          ? 'border-amber-500/20 bg-amber-50/10'
          : 'border-emerald-500/20 bg-emerald-50/10'
        : 'border-hairline'
    }`}>
      <div className="min-w-0 flex-1">
        <span className="text-[9px] font-bold text-ink-mute uppercase tracking-wide font-mono block leading-none mb-1">{title}</span>
        <div className={`text-xs font-bold font-mono tracking-tight ${
          highlight
            ? alertType === 'warning'
              ? 'text-amber-600'
              : 'text-emerald-700'
            : 'text-ink'
        }`}>{value}</div>
        <span className="text-[8px] text-ink-faint block truncate mt-0.5" title={subtitle}>{subtitle}</span>
      </div>
      <div className="p-1.5 bg-canvas rounded-lg shrink-0 ml-2">{icon}</div>
    </div>
  )
}
