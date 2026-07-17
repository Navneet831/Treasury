import React, { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from 'react'
import {
  Percent, ArrowDownToLine, RefreshCw, Grid, Table, CheckCircle2, XCircle, HelpCircle,
  BookOpen, Layers, Search
} from 'lucide-react'
import api from '../../api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalcBreakdown {
  daysInMonth: number;
  actualCharged: number | null;
  actualRecovered: number | null;
  rawClosingBal: number | null;
  adjustedClosingBal: number | null;
  dailyBalCount: number;
  avgDailyBalance: number | null;
  openingBalUsed: number | null;
  roiUsed: number | null;
}

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
  calcBreakdown?: CalcBreakdown;
}

interface InterestSummaryData {
  rows: InterestRow[];
  months: string[];
  monthLabels: Record<string, string>;
  fyList: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Format currency in Lakhs/Crores (module-level so tooltip builder can use it)
const formatAmt = (val: number | null) => {
  if (val === null || isNaN(val)) return '-'
  if (val === 0) return '0.00'
  return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Data Cell — display with hover tooltip showing calculation formula ──────
const dataCell = (value: number | null, className: string, fmt?: (v: number | null) => string, tooltip?: string) => {
  const safe: number | null = value === undefined ? null : value
  const disp = fmt ? fmt(safe) : (value !== null && value !== undefined ? String(value) : '-')
  return (
    <td className={className} title={tooltip || ''}>
      <span className="px-0.5">{disp}</span>
    </td>
  )
}

// ─── Tooltip Builder ──────────────────────────────────────────────────────────

const buildCalcTooltip = (r: InterestRow, field: string): string => {
  const c = r.calcBreakdown
  const lines: string[] = []
  switch (field) {
    case 'closingBal': {
      if (c && c.rawClosingBal !== null) {
        lines.push(`Closing Balance (raw): ${formatAmt(c.rawClosingBal)}`)
      } else {
        lines.push('Closing Balance')
      }
      break
    }
    case 'intCalculated': {
      lines.push('Interest = |Opening| x ROI% / 100 x Days/365')
      if (c) {
        const ob = c.openingBalUsed ?? r.openingBal ?? 0
        const roi = c.roiUsed ?? r.roi ?? 0
        const dim = c.daysInMonth
        lines.push(`|${formatAmt(ob)}| x ${roi}% / 100 x ${dim}/365`)
        lines.push(`= ${formatAmt(r.intCalculated ?? 0)}`)
        lines.push(`Daily balances used: ${c.dailyBalCount} days`)
        if (c.avgDailyBalance !== null) lines.push(`Avg daily balance: ${formatAmt(c.avgDailyBalance)}`)
      }
      break
    }
    case 'variance': {
      lines.push('Variance = Recovered - Calculated')
      lines.push(`Recovered: ${formatAmt(r.intRecovered)}`)
      lines.push(`Calculated: ${formatAmt(r.intCalculated ?? 0)}`)
      lines.push(`= ${formatAmt(r.variance)}`)
      break
    }
    case 'variancePct': {
      lines.push(`Var% = (Variance / Calculated) x 100`)
      lines.push(`= (${formatAmt(r.variance)} / ${formatAmt(r.intCalculated ?? 0)}) x 100`)
      lines.push(`= ${r.variancePct != null ? r.variancePct.toFixed(1) + '%' : '-'}`)
      break
    }
  }
  return lines.join(' | ')
}

interface StatementTxn {
  txn_date: string;
  value_date?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number | null;
}

const matchTxnMonth = (txnDateStr: string, monthKey: string) => {
  if (!txnDateStr || !monthKey) return false
  const parts = monthKey.split('_')
  if (parts.length !== 2) return false
  const mStr = parts[0].toLowerCase()
  const yStr = parts[1]

  let dateObj: Date | null = null
  if (txnDateStr.includes('T')) {
    dateObj = new Date(txnDateStr)
  } else {
    const cleanDate = txnDateStr.replace(/\//g, '-').replace(/\s+/g, '')
    const sub = cleanDate.split('-')
    if (sub.length === 3) {
      if (sub[0].length === 4) {
        dateObj = new Date(Number(sub[0]), Number(sub[1]) - 1, Number(sub[2]))
      } else {
        const yr = sub[2].length === 2 ? 2000 + Number(sub[2]) : Number(sub[2])
        dateObj = new Date(yr, Number(sub[1]) - 1, Number(sub[0]))
      }
    }
  }

  if (!dateObj || isNaN(dateObj.getTime())) return false

  const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const txnMonth = shortMonths[dateObj.getMonth()]
  const txnYear = String(dateObj.getFullYear()).slice(-2)

  return txnMonth === mStr && txnYear === yStr
}

const getCurrentFy = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed
  if (month >= 3) {
    const start = year % 100
    const end = (year + 1) % 100
    return `FY${start.toString().padStart(2, '0')}-${end.toString().padStart(2, '0')}`
  } else {
    const start = (year - 1) % 100
    const end = year % 100
    return `FY${start.toString().padStart(2, '0')}-${end.toString().padStart(2, '0')}`
  }
}

export const InterestSummary: React.FC = () => {
  const [data, setData] = useState<InterestSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Refs for frozen column measurement
  const summaryTableRef = useRef<HTMLDivElement>(null)
  const pivotTableRef = useRef<HTMLDivElement>(null)



  // Filters State
  const [selectedType, _setSelectedType] = useState<string>('All')
  const [selectedBank, _setSelectedBank] = useState<string>('All')
  const [selectedAccount, setSelectedAccount] = useState<string>('All')
  const [selectedFy, setSelectedFy] = useState<string>('All FYs')
  const [selectedMonth, setSelectedMonth] = useState<string>('All')
  const [showEmptyAccounts, _setShowEmptyAccounts] = useState<boolean>(false)

  // Drill-down FY state (which FY is expanded in the FY→Month tree)
  const [drilldownFy, setDrilldownFy] = useState<string>('')

  // Account search within Account Interest Analysis panel
  const [acctSearch, setAcctSearch] = useState<string>('')
  const [acctSearchOpen, setAcctSearchOpen] = useState<boolean>(false)
  const [drilldownTypeFilter, setDrilldownTypeFilter] = useState<string>('All')

  // Sorting State
  const [sortColumn, setSortColumn] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

  // UI View Modes: 'pivot' | 'summary' | 'all'
  const [viewMode, setViewMode] = useState<'all' | 'summary' | 'pivot'>('pivot')

  // Selected Account for Bottom Drilldown
  const [drilldownAccount, setDrilldownAccount] = useState<string>('')
  const [drilldownMonth, setDrilldownMonth] = useState<string>('all')
  const [txnList, setTxnList] = useState<StatementTxn[]>([])
  const [loadingTxns, setLoadingTxns] = useState(false)
  const [txnError, setTxnError] = useState<string | null>(null)
  const [fyList, setFyList] = useState<string[]>([])

  // (no editable cell state — removed per user feedback)

  // Load data for a specific FY (or All FYs), with optional recompute
  const loadFyData = useCallback(async (fyToLoad?: string, shouldRecompute?: boolean) => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, any> = {}
      if (fyToLoad && fyToLoad !== 'All FYs') {
        params.fy = fyToLoad
      }
      if (shouldRecompute) {
        params.recompute = true
      }
      const res = await api.get('/interest-summary', { params })
      const payload: InterestSummaryData = res.data
      setData(payload)

      // Sync FY list from payload (already sorted descending in backend)
      if (payload.fyList && payload.fyList.length > 0) {
        setFyList(payload.fyList)
        
        // Auto-select default FY if not already selected
        setSelectedFy(prev => {
          if (prev && prev !== 'All FYs' && payload.fyList.includes(prev)) {
            return prev
          }
          const currentFy = getCurrentFy()
          const defaultFy = payload.fyList.includes(currentFy) ? currentFy : payload.fyList[0]
          setDrilldownFy(defaultFy)
          return defaultFy
        })

        // Show all months of the selected FY by default
        setSelectedMonth('All')
        setDrilldownMonth('all')
      }

      // Auto-select first account (prioritise one with statement table found)
      if (payload.rows.length > 0) {
        const matched = payload.rows.find(r => r.tableFound)
        const defaultAcct = matched ? matched.account : payload.rows[0].account
        setDrilldownAccount(defaultAcct)
      }
    } catch (err: any) {
      console.error('Error fetching interest summary:', err)
      setError(err.message || 'Failed to load interest summary data.')
    } finally {
      setLoading(false)
    }
  }, [])

  // On mount: load latest FY (backend caches result — fast on repeat visits)
  useEffect(() => {
    loadFyData(getCurrentFy())
  }, [loadFyData])

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
      if (selectedMonth !== 'All' && r.monthKey !== selectedMonth) return false
      // 6. Has statement data filter
      if (!showEmptyAccounts && !r.tableFound) return false
      return true
    })
  }, [data, selectedType, selectedBank, selectedAccount, selectedFy, selectedMonth, showEmptyAccounts])

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
  // Pivot formatting functions
  const activeMonthsList = useMemo(() => {
    if (!data) return []
    const baseList = selectedFy === 'All FYs' ? data.months : data.months.filter(m => {
      const match = data.rows.find(r => r.monthKey === m && r.fy === selectedFy)
      return !!match
    })
    
    // Sort baseList from current to past (newest month first)
    const sorted = [...baseList].sort((a, b) => {
      const parseMk = (mk: string) => {
        const parts = mk.split('_')
        if (parts.length !== 2) return 0
        const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
        const monthIdx = shortMonths.indexOf(parts[0].toLowerCase())
        const yr = 2000 + Number(parts[1])
        return new Date(yr, monthIdx, 1).getTime()
      }
      return parseMk(b) - parseMk(a) // descending order
    })

    if (selectedMonth !== 'All') {
      return sorted.filter(m => m === selectedMonth)
    }
    return sorted
  }, [data, selectedFy, selectedMonth])

  // Sorting Logic and Memo
  const sortedRows = useMemo(() => {
    let temp = [...processedRows]
    
    const parseMk = (mk: string) => {
      if (!mk) return 0
      const parts = mk.split('_')
      if (parts.length !== 2) return 0
      const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      const monthIdx = shortMonths.indexOf(parts[0].toLowerCase())
      const yr = 2000 + Number(parts[1])
      return new Date(yr, monthIdx, 1).getTime()
    }

    if (sortColumn) {
      temp.sort((a, b) => {
        let valA = (a as any)[sortColumn]
        let valB = (b as any)[sortColumn]
        
        if (valA === null || valA === undefined) return sortDirection === 'asc' ? 1 : -1
        if (valB === null || valB === undefined) return sortDirection === 'asc' ? -1 : 1
        
        if (sortColumn === 'monthKey') {
          const tA = parseMk(valA)
          const tB = parseMk(valB)
          return sortDirection === 'asc' ? tA - tB : tB - tA
        }

        if (typeof valA === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB) 
            : valB.localeCompare(valA)
        } else {
          return sortDirection === 'asc'
            ? valA - valB
            : valB - valA
        }
      })
    } else {
      // Default sorting: Newest month first, then Account Type, then Account No.
      temp.sort((a, b) => {
        const tA = parseMk(a.monthKey)
        const tB = parseMk(b.monthKey)
        if (tA !== tB) return tB - tA
        
        const typeCompare = a.type.localeCompare(b.type)
        if (typeCompare !== 0) return typeCompare
        
        return a.account.localeCompare(b.account)
      })
    }
    return temp
  }, [processedRows, sortColumn, sortDirection])

  const handleSort = (colName: string) => {
    if (sortColumn === colName) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(colName)
      setSortDirection('asc')
    }
  }

  const renderSortIndicator = (colName: string) => {
    if (sortColumn !== colName) return <span className="opacity-30 ml-1">⇅</span>
    return sortDirection === 'asc' ? <span className="text-emerald-600 ml-1">▲</span> : <span className="text-emerald-600 ml-1">▼</span>
  }

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

    let list = Object.values(acctMap)
    
    // Sort
    if (sortColumn && (sortColumn === 'type' || sortColumn === 'account' || sortColumn === 'bank')) {
      list.sort((a, b) => {
        let valA = (a as any)[sortColumn] || ''
        let valB = (b as any)[sortColumn] || ''
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      })
    } else {
      list.sort((a, b) => a.account.localeCompare(b.account))
    }
    return list
  }, [processedRows, sortColumn, sortDirection])

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

    let list = Object.values(acctMap)
    
    // Sort
    if (sortColumn && (sortColumn === 'type' || sortColumn === 'account' || sortColumn === 'bank')) {
      list.sort((a, b) => {
        let valA = (a as any)[sortColumn] || ''
        let valB = (b as any)[sortColumn] || ''
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      })
    } else {
      list.sort((a, b) => a.account.localeCompare(b.account))
    }
    return list
  }, [processedRows, sortColumn, sortDirection])

  const drilldownAccountRows = useMemo(() => {
    if (!data || !drilldownAccount) return []
    let rows = data.rows.filter(r => r.account === drilldownAccount)
    if (selectedFy !== 'All FYs') {
      rows = rows.filter(r => r.fy === selectedFy)
    }
    
    // De-duplicate by monthKey to ensure unique months
    const seen = new Set()
    rows = rows.filter(r => {
      if (seen.has(r.monthKey)) return false
      seen.add(r.monthKey)
      return true
    })
    const parseMkLocal = (mk: string) => {
      const parts = mk.split('_')
      if (parts.length !== 2) return 0
      const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      const monthIdx = shortMonths.indexOf(parts[0].toLowerCase())
      const yr = 2000 + Number(parts[1])
      return new Date(yr, monthIdx, 1).getTime()
    }
    return [...rows].sort((a, b) => parseMkLocal(b.monthKey) - parseMkLocal(a.monthKey))
  }, [data, drilldownAccount, selectedFy])

  // Load drilldown transactions
  const fetchTransactions = useCallback(async (accountNo: string) => {
    if (!accountNo) return
    
    // Find resolved table name from row data
    const matchedRow = data?.rows.find(r => r.account === accountNo)
    if (!matchedRow || !matchedRow.tableFound) {
      setTxnList([])
      setTxnError(null)
      return
    }
    
    const tblName = matchedRow.tableName || accountNo

    setLoadingTxns(true)
    setTxnError(null)
    setTxnList([])

    try {
      const res = await api.get(`/tables/${encodeURIComponent(tblName)}`)
      const rawTxns = res.data
      
      // Format transactions
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

  // Filter transactions by selected drilldown month
  const filteredTxns = useMemo(() => {
    if (drilldownMonth === 'all') return txnList
    return txnList.filter(t => matchTxnMonth(t.txn_date, drilldownMonth))
  }, [txnList, drilldownMonth])

  // CSV Exporter
  const handleDownloadCsv = () => {
    if (processedRows.length === 0) return

    let csvContent = "data:text/csv;charset=utf-8,"
    csvContent += "Type,Account,Bank,FY,Month,Opening Bal,Closing Bal,ROI (%),Int Recovered,Int Calculated,Variance,Var %\n"

    processedRows.forEach(r => {
      const row = [
        r.type,
        r.account,
        r.bank,
        r.fy,
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

  // Measure column widths after data loads to set proper sticky left offsets
  const measureColumns = useCallback((container: HTMLDivElement | null) => {
    if (!container) return
    const table = container.querySelector('table')
    if (!table) return
    const cells = table.querySelectorAll('thead tr:first-child th')
    if (cells.length < 3) return
    const w0 = (cells[0] as HTMLElement).offsetWidth
    const w1 = w0 + (cells[1] as HTMLElement).offsetWidth
    ;(table as HTMLElement).style.setProperty('--c1', '0px')
    ;(table as HTMLElement).style.setProperty('--c2', w0 + 'px')
    ;(table as HTMLElement).style.setProperty('--c3', w1 + 'px')
  }, [])

  useLayoutEffect(() => {
    if (!data) return
    requestAnimationFrame(() => {
      measureColumns(summaryTableRef.current)
      measureColumns(pivotTableRef.current)
    })
  }, [data, measureColumns])

  return (
    <div className="flex-1 flex flex-col bg-canvas overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Header */}
      <div className="px-4 py-2 border-b border-hairline flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
            <Percent className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xs font-semibold text-ink leading-none">Interest</h1>

            </div>
            <p className="text-[10px] text-ink-mute mt-0.5">
               Reconciliation between interest charged vs calculated simple interest on daily statement balances.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => loadFyData(selectedFy === 'All FYs' ? undefined : selectedFy, true)}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-hairline text-[11px] font-medium text-ink hover:bg-canvas transition-colors disabled:opacity-40 shadow-sm font-mono cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Recompute
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
            <div className="bg-white rounded-xl border border-black py-1.5 px-3 shadow-sm flex gap-3 items-center">
              {/* KPI Chips */}
              <div className="flex gap-2 items-end flex-wrap flex-1">
                <div className="flex gap-2 items-stretch flex-wrap w-full">
                  <div className="flex-1 flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2 justify-center" 
                    title={`Total Interest Recovered across ${metrics.accountCount} active accounts. Sum of intRecovered column: Rs ${formatAmt(metrics.totalRecovered)}`}>
                    <Percent className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[9px] font-bold text-ink-mute uppercase font-mono leading-none">Recovered</div>
                      <div className="text-xs font-bold text-emerald-700 font-mono">Rs {formatAmt(metrics.totalRecovered)}</div>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center gap-2 bg-violet-500/5 border border-violet-500/15 rounded-lg px-3 py-2 justify-center"
                    title={`Total Interest Calculated across ${metrics.accountCount} active accounts. Sum of intCalculated column: Rs ${formatAmt(metrics.totalCalculated)}`}>
                    <Layers className="w-4 h-4 text-violet-600 shrink-0" />
                    <div>
                      <div className="text-[9px] font-bold text-ink-mute uppercase font-mono leading-none">Calculated</div>
                      <div className="text-xs font-bold text-violet-700 font-mono">Rs {formatAmt(metrics.totalCalculated)}</div>
                    </div>
                  </div>
                  <div className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2 justify-center ${metrics.totalVariance < 0 ? 'bg-amber-500/5 border-amber-500/15' : 'bg-sky-500/5 border-sky-500/15'}`}
                    title={`Variance = Recovered - Calculated = Rs ${formatAmt(metrics.totalRecovered)} - Rs ${formatAmt(metrics.totalCalculated)} = Rs ${formatAmt(metrics.totalVariance)}`}>
                    <ArrowDownToLine className={`w-4 h-4 shrink-0 ${metrics.totalVariance < 0 ? 'text-amber-600' : 'text-sky-600'}`} />
                    <div>
                      <div className="text-[9px] font-bold text-ink-mute uppercase font-mono leading-none">Variance</div>
                      <div className={`text-xs font-bold font-mono ${metrics.totalVariance < 0 ? 'text-amber-700' : 'text-sky-700'}`}>Rs {formatAmt(metrics.totalVariance)}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: FY / Month drill-down */}
              <div className="shrink-0 w-[150px]">
                <label className="block text-[9px] font-bold text-ink-mute uppercase tracking-wide mb-0.5 font-mono">FY / Month</label>
                <div className="border border-hairline bg-canvas rounded-lg p-1 h-[90px] overflow-y-auto flex flex-col gap-0.5 custom-scrollbar-vertical">
                  {/* All option */}
                  <button
                    onClick={() => {
                      setSelectedFy('All FYs')
                      setSelectedMonth('All')
                      setDrilldownFy('')
                      setDrilldownMonth('all')
                      loadFyData('All FYs')
                    }}
                    className={`w-full text-left text-[10px] px-2 py-0.5 rounded font-mono font-semibold transition-all border ${
                      selectedFy === 'All FYs'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
                        : 'bg-white border-transparent text-ink-mute hover:bg-canvas'
                    }`}
                  >
                    All FYs
                  </button>

                  {/* FY rows — each expands into months, then accounts */}
                  {(fyList ?? []).map(fy => {
                    const isExpanded = drilldownFy === fy
                     const parseMk = (mk: string) => {
                       const parts = mk.split('_')
                       if (parts.length !== 2) return 0
                       const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
                       const monthIdx = shortMonths.indexOf(parts[0].toLowerCase())
                       const yr = 2000 + Number(parts[1])
                       return new Date(yr, monthIdx, 1).getTime()
                     }
                     const fyMonths = (data?.months ?? []).filter(mk =>
                       data?.rows.some(r => r.monthKey === mk && r.fy === fy)
                     ).sort((a, b) => parseMk(b) - parseMk(a))
                    const isFySelected = selectedFy === fy && selectedMonth === 'All'
                    return (
                      <div key={fy}>
                        {/* Level 1: FY row */}
                        <button
                          onClick={() => {
                            const isFyAlreadyActive = selectedFy === fy
                            if (isFyAlreadyActive) {
                              // Toggle — deselect
                              setDrilldownFy('')
                              setSelectedFy('')
                              setSelectedMonth('All')
                              setDrilldownMonth('all')
                            } else {
                              // Select this FY — load its data
                              setDrilldownFy(fy)
                              setSelectedFy(fy)
                              setSelectedMonth('All')
                              setDrilldownMonth('all')
                              loadFyData(fy)
                            }
                          }}
                          className={`w-full text-left text-[10px] px-2 py-0.5 rounded font-mono font-bold transition-all flex items-center justify-between border ${
                            isFySelected
                              ? 'bg-sky-500/10 border-sky-500/20 text-sky-700'
                              : 'bg-white border-transparent text-ink-mute hover:bg-canvas'
                          }`}
                        >
                          <span>{isExpanded ? '▾' : '▸'} {fy}</span>
                        </button>

                        {/* Level 2: Month rows under expanded FY */}
                        {isExpanded && fyMonths.map(mKey => {
                          const label = data?.monthLabels[mKey] || mKey
                          const isMSelected = selectedMonth === mKey
                          return (
                            <div key={mKey}>
                              <button
                                onClick={() => {
                                  setSelectedMonth(mKey)
                                  setDrilldownMonth(mKey)
                                }}
                                className={`w-full text-left text-[10px] pl-4 pr-2 py-0.5 rounded font-mono font-semibold transition-all flex items-center gap-1 border ${
                                  isMSelected
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
                                    : 'bg-white border-transparent text-ink-mute hover:bg-canvas'
                                }`}
                              >
                                {label}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Empty state: prompt user to select an FY */}
            {!data ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-xl border border-black shadow-sm">
                <Search className="w-8 h-8 text-ink-mute" />
                <p className="text-xs text-ink-mute font-mono text-center max-w-md">
                  Select a fiscal year from the <span className="font-bold">FY / Month</span> panel to load interest reconciliation data.
                </p>
              </div>
            ) : (<React.Fragment>
            {/* View Mode Selector Tabs */}
            <div className="flex border-b border-hairline shrink-0 gap-4">
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
            </div>

            {/* Table Area */}
            <div className="bg-white rounded-xl border border-black shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-auto max-h-[250px] custom-scrollbar-horizontal custom-scrollbar-vertical">
                
                {viewMode === 'all' && (
                  <table className="min-w-full w-max text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-canvas-soft border-b border-hairline text-[9px] font-mono text-ink-mute uppercase">
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-left cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('type')}>Type {renderSortIndicator('type')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-left cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('account')}>Account {renderSortIndicator('account')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-left cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('bank')}>Bank {renderSortIndicator('bank')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-left cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('fy')}>FY {renderSortIndicator('fy')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-left cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('monthKey')}>Month {renderSortIndicator('monthKey')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('openingBal')}>Opening Bal {renderSortIndicator('openingBal')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('closingBal')}>Closing Bal {renderSortIndicator('closingBal')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('roi')}>ROI% {renderSortIndicator('roi')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('intRecovered')}>Int Rec. {renderSortIndicator('intRecovered')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('intCalculated')}>Int Calc. {renderSortIndicator('intCalculated')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('variance')}>Variance {renderSortIndicator('variance')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-right cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('variancePct')}>Var% {renderSortIndicator('variancePct')}</th>
                        <th className="sticky top-0 bg-canvas-soft z-10 px-2 py-1 font-bold text-center whitespace-nowrap">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline text-xs">
                      {sortedRows.map((r, idx) => (
                        <tr
                          key={idx}
                          onClick={() => {
                            if (r.tableFound) {
                              setDrilldownAccount(r.account)
                              setDrilldownMonth(r.monthKey)
                            }
                          }}
                          className={`transition-colors ${
                            r.tableFound 
                              ? 'cursor-pointer hover:bg-canvas-soft/40' 
                              : 'opacity-40 text-ink-faint pointer-events-none'
                          } ${drilldownAccount === r.account ? 'bg-emerald-500/5' : ''}`}
                        >
                          <td className="px-2 py-1 text-ink-mute whitespace-nowrap">{r.type}</td>
                          <td className="px-2 py-1 font-mono font-medium text-ink whitespace-nowrap">{r.account}</td>
                          <td className="px-2 py-1 font-semibold text-ink-mute whitespace-nowrap">{r.bank}</td>
                          <td className="px-2 py-1 text-ink-mute font-mono whitespace-nowrap">{r.fy}</td>
                          <td className="px-2 py-1 text-ink font-mono whitespace-nowrap">{r.month}</td>
                          {dataCell(r.openingBal, 'px-2 py-1 text-right font-mono text-ink-mute whitespace-nowrap', formatAmt)}
                          {dataCell(r.closingBal, 'px-2 py-1 text-right font-mono text-ink-mute whitespace-nowrap', formatAmt, buildCalcTooltip(r, 'closingBal'))}
                          {dataCell(r.roi, 'px-2 py-1 text-right font-mono font-semibold text-sky-600 whitespace-nowrap', v => v !== null ? `${v.toFixed(2)}%` : '-')}
                          {dataCell(r.intRecovered, 'px-2 py-1 text-right font-mono font-medium text-emerald-600 whitespace-nowrap', formatAmt)}
                          {dataCell(r.intCalculated, 'px-2 py-1 text-right font-mono text-ink whitespace-nowrap', formatAmt, buildCalcTooltip(r, 'intCalculated'))}
                          {dataCell(r.variance, `px-2 py-1 text-right font-mono font-semibold whitespace-nowrap ${r.variance < 0 ? 'text-amber-600' : r.variance > 0 ? 'text-emerald-700' : 'text-ink-mute'}`, formatAmt, buildCalcTooltip(r, 'variance'))}
                          {dataCell(r.roi !== null && r.openingBal !== null ? r.variancePct : null, 'px-2 py-1 text-right font-mono text-ink-mute whitespace-nowrap', v => v !== null ? `${v.toFixed(1)}%` : '-', buildCalcTooltip(r, 'variancePct'))}
                          <td className="px-2 py-1 text-center">
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
                      {sortedRows.length === 0 && (
                        <tr>
                          <td colSpan={13} className="p-8 text-center text-xs text-ink-mute italic">
                            No rows matched the active filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {viewMode === 'summary' && (
                  <div ref={summaryTableRef}>
                  <table className="min-w-full w-max text-left border-collapse table-auto whitespace-nowrap">
                    <thead>
                      <tr className="bg-canvas-soft border-b border-hairline text-[10px] font-mono text-ink-mute uppercase">
                        <th rowSpan={2} className="sticky top-0 left-0 z-30 bg-canvas-soft p-1.5 font-bold text-left border-r border-b border-hairline cursor-pointer select-none" onClick={() => handleSort('type')}>Type {renderSortIndicator('type')}</th>
                        <th rowSpan={2} className="sticky top-0 z-30 bg-canvas-soft p-1.5 font-bold text-left border-r border-b border-hairline cursor-pointer select-none" style={{left: 'var(--c2, 100px)'}} onClick={() => handleSort('account')}>Account {renderSortIndicator('account')}</th>
                        <th rowSpan={2} className="sticky top-0 z-30 bg-canvas-soft p-1.5 font-bold text-left border-r border-b border-hairline cursor-pointer select-none" style={{left: 'var(--c3, 280px)'}} onClick={() => handleSort('bank')}>Bank {renderSortIndicator('bank')}</th>
                        {activeMonthsList.map(m => (
                          <th key={m} colSpan={2} className="sticky top-0 bg-canvas-soft z-10 p-1.5 font-bold text-ink border-l border-hairline text-center">
                            {data?.monthLabels[m]}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-canvas-soft border-b border-hairline text-[9px] font-mono text-ink-mute uppercase">
                        {activeMonthsList.map(m => (
                          <React.Fragment key={m}>
                            <th className="sticky top-[28px] bg-canvas-soft z-10 p-1 border-l border-hairline text-right">Open</th>
                            <th className="sticky top-[28px] bg-canvas-soft z-10 p-1 text-right">Close</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline text-xs font-mono">
                      {openingClosingSummary.map((acctRow, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-canvas-soft/40 cursor-pointer transition-colors ${
                            drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''
                          }`}
                        >
                          <td className={`sticky left-0 z-20 bg-white p-2 text-ink-mute font-sans border-r border-hairline hover:bg-canvas-soft/40 ${drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''}`} onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.type}</td>
                          <td className={`sticky z-20 bg-white p-2 font-semibold text-ink border-r border-hairline hover:bg-canvas-soft/40 ${drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''}`} style={{left: 'var(--c2, 100px)'}} onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.account}</td>
                          <td className={`sticky z-20 bg-white p-2 text-ink-mute font-sans border-r border-hairline hover:bg-canvas-soft/40 ${drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''}`} style={{left: 'var(--c3, 280px)'}} onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.bank}</td>
                          {activeMonthsList.map(m => {
                            const origRow = processedRows.find(r => r.account === acctRow.account && r.monthKey === m)
                            return (
                              <React.Fragment key={m}>
                                {dataCell(acctRow[`open_${m}`], 'p-2 text-right text-ink-mute whitespace-nowrap', formatAmt)}
                                {dataCell(acctRow[`close_${m}`], 'p-2 text-right text-ink-mute whitespace-nowrap', formatAmt, origRow ? buildCalcTooltip(origRow, 'closingBal') : undefined)}
                              </React.Fragment>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}

                {viewMode === 'pivot' && (
                  <div ref={pivotTableRef}>
                  <table className="min-w-full w-max text-left border-collapse table-auto whitespace-nowrap">
                    <thead>
                      <tr className="bg-canvas-soft border-b border-hairline text-[10px] font-mono text-ink-mute uppercase">
                        <th rowSpan={2} className="sticky top-0 left-0 z-30 bg-canvas-soft p-1.5 font-bold text-left border-r border-b border-hairline cursor-pointer select-none" onClick={() => handleSort('type')}>Type {renderSortIndicator('type')}</th>
                        <th rowSpan={2} className="sticky top-0 z-30 bg-canvas-soft p-1.5 font-bold text-left border-r border-b border-hairline cursor-pointer select-none" style={{left: 'var(--c2, 100px)'}} onClick={() => handleSort('account')}>Account {renderSortIndicator('account')}</th>
                        <th rowSpan={2} className="sticky top-0 z-30 bg-canvas-soft p-1.5 font-bold text-left border-r border-b border-hairline cursor-pointer select-none" style={{left: 'var(--c3, 280px)'}} onClick={() => handleSort('bank')}>Bank {renderSortIndicator('bank')}</th>
                        {activeMonthsList.map(m => (
                          <th key={m} colSpan={6} className="sticky top-0 bg-canvas-soft z-10 p-1.5 font-bold text-ink border-l border-hairline text-center">
                            {data?.monthLabels[m]}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-canvas-soft border-b border-hairline text-[9px] font-mono text-ink-mute uppercase">
                        {activeMonthsList.map(m => (
                          <React.Fragment key={m}>
                            <th className="sticky top-[28px] bg-canvas-soft z-10 p-1 border-l border-hairline text-right">ROI</th>
                            <th className="sticky top-[28px] bg-canvas-soft z-10 p-1 text-right">Open</th>
                            <th className="sticky top-[28px] bg-canvas-soft z-10 p-1 text-right">Close</th>
                            <th className="sticky top-[28px] bg-canvas-soft z-10 p-1 text-right">Recov.</th>
                            <th className="sticky top-[28px] bg-canvas-soft z-10 p-1 text-right">Calc.</th>
                            <th className="sticky top-[28px] bg-canvas-soft z-10 p-1 text-right">Var</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline text-xs font-mono">
                      {widePivotRows.map((acctRow, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-canvas-soft/40 cursor-pointer transition-colors ${
                            drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''
                          }`}
                        >
                          <td className={`sticky left-0 z-20 bg-white p-2 text-ink-mute font-sans border-r border-hairline hover:bg-canvas-soft/40 ${drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''}`} onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.type}</td>
                          <td className={`sticky z-20 bg-white p-2 font-semibold text-ink border-r border-hairline hover:bg-canvas-soft/40 ${drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''}`} style={{left: 'var(--c2, 100px)'}} onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.account}</td>
                          <td className={`sticky z-20 bg-white p-2 text-ink-mute font-sans border-r border-hairline hover:bg-canvas-soft/40 ${drilldownAccount === acctRow.account ? 'bg-emerald-500/5' : ''}`} style={{left: 'var(--c3, 280px)'}} onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.bank}</td>
                          {activeMonthsList.map(m => {
                            const v = acctRow[`variance_${m}`]
                            // Find original row for calc breakdown info
                            const origRow = processedRows.find(r => r.account === acctRow.account && r.monthKey === m)
                            return (
                              <React.Fragment key={m}>
                                {dataCell(acctRow[`roi_${m}`], 'p-2 border-l border-hairline text-right text-sky-600 font-semibold whitespace-nowrap', v2 => v2 !== null ? `${v2.toFixed(2)}%` : '-')}
                                {dataCell(acctRow[`open_${m}`], 'p-2 text-right text-ink-mute whitespace-nowrap', formatAmt)}
                                {dataCell(acctRow[`close_${m}`], 'p-2 text-right text-ink-mute whitespace-nowrap', formatAmt, origRow ? buildCalcTooltip(origRow, 'closingBal') : undefined)}
                                {dataCell(acctRow[`recovered_${m}`], 'p-2 text-right text-emerald-600 font-medium whitespace-nowrap', formatAmt)}
                                {dataCell(acctRow[`calculated_${m}`], 'p-2 text-right text-ink whitespace-nowrap', formatAmt, origRow ? buildCalcTooltip(origRow, 'intCalculated') : undefined)}
                                {dataCell(v, `p-2 text-right font-semibold whitespace-nowrap ${v < 0 ? 'text-amber-600' : v > 0 ? 'text-emerald-700' : 'text-ink-mute'}`, formatAmt, origRow ? buildCalcTooltip(origRow, 'variance') : undefined)}
                              </React.Fragment>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )}

              </div>
            </div>

            {/* Drilldown Section */}
            {drilldownAccount && (
              <div className="bg-white rounded-xl border border-black shadow-sm overflow-hidden flex flex-col xl:flex-row gap-3 p-3">
                
                {/* Account Details Box — compact left panel */}
                <div className="w-full xl:w-[336px] shrink-0 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <h3 className="text-[10px] font-bold text-ink tracking-wide uppercase font-mono">Account Interest Analysis</h3>
                  </div>

                  {/* Account Search Combobox with Account Type Filter */}
                  <div className="flex gap-1.5">
                    <div className="w-[85px] shrink-0">
                      <select
                        value={drilldownTypeFilter}
                        onChange={(e) => setDrilldownTypeFilter(e.target.value)}
                        className="w-full text-[10px] font-mono bg-canvas border border-hairline rounded px-1 py-1 text-ink outline-none cursor-pointer focus:border-emerald-500 transition-colors"
                      >
                        <option value="All">All Types</option>
                        {Array.from(new Set(data?.rows.map(r => r.type) ?? [])).sort().map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative flex-1">
                      <div
                        className="flex items-center gap-1 border border-hairline bg-canvas rounded-lg px-2 py-1 cursor-text"
                        onClick={() => { setAcctSearchOpen(true); setAcctSearch('') }}
                      >
                        <Search className="w-3 h-3 text-ink-mute shrink-0" />
                        {acctSearchOpen ? (
                          <input
                            autoFocus
                            value={acctSearch}
                            onChange={e => setAcctSearch(e.target.value)}
                            onBlur={() => setTimeout(() => setAcctSearchOpen(false), 150)}
                            placeholder="Search acct..."
                            className="flex-1 text-[10px] font-mono bg-transparent outline-none text-ink placeholder-ink-faint"
                          />
                        ) : (
                          <span className="flex-1 text-[10px] font-mono font-semibold text-ink truncate" title={drilldownAccount}>
                            {drilldownAccount}
                          </span>
                        )}
                      </div>

                      {/* Dropdown results */}
                      {acctSearchOpen && (() => {
                        const allAccts = Array.from(new Set(
                          (processedRows.length > 0 ? processedRows : (data?.rows ?? []))
                            .filter(r => drilldownTypeFilter === 'All' || r.type === drilldownTypeFilter)
                            .map(r => r.account)
                        ))
                        const filtered = acctSearch
                          ? allAccts.filter(a => a.toLowerCase().includes(acctSearch.toLowerCase()))
                          : allAccts
                        return filtered.length > 0 ? (
                          <div className="absolute z-30 top-full left-0 right-0 mt-0.5 bg-white border border-hairline rounded-lg shadow-lg overflow-y-auto max-h-40 custom-scrollbar-vertical">
                          {filtered.map(acct => {
                            const info = processedRows.find(r => r.account === acct)
                            const isSelected = drilldownAccount === acct
                            return (
                              <button
                                key={acct}
                                onMouseDown={() => {
                                  setDrilldownAccount(acct)
                                  setAcctSearch('')
                                  setAcctSearchOpen(false)
                                  fetchTransactions(acct)
                                }}
                                className={`w-full text-left px-2 py-1 text-[10px] font-mono flex items-center justify-between transition-colors ${
                                  isSelected
                                    ? 'bg-emerald-500/10 text-emerald-700 font-bold'
                                    : 'hover:bg-canvas text-ink'
                                }`}
                              >
                                <span className="truncate">{acct}</span>
                                {info && <span className="text-[9px] text-ink-mute ml-1 shrink-0">{info.bank}</span>}
                              </button>
                            )
                          })}
                        </div>
                        ) : null
                      })()}
                    </div>
                  </div>

                  {/* Monthly splits — compact table style */}
                  <div>
                    <div className="text-[9px] font-bold text-ink-mute uppercase tracking-wide font-mono mb-1">Monthly Splits <span className="font-normal normal-case">(click row to load statements)</span></div>
                    <div className="border border-hairline rounded-lg overflow-hidden">
                      <div className="overflow-y-auto max-h-[280px] custom-scrollbar-vertical">
                        <table className="min-w-full w-max text-left border-collapse table-auto whitespace-nowrap">
                          <thead>
                            <tr className="bg-canvas-soft text-[9px] font-mono text-ink-mute uppercase">
                              <th className="sticky top-0 bg-canvas-soft p-1.5 font-bold">Month</th>
                              <th className="sticky top-0 bg-canvas-soft p-1.5 font-bold text-right">ROI</th>
                              <th className="sticky top-0 bg-canvas-soft p-1.5 font-bold text-right text-emerald-700">Rec</th>
                              <th className="sticky top-0 bg-canvas-soft p-1.5 font-bold text-right">Calc</th>
                              <th className="sticky top-0 bg-canvas-soft p-1.5 font-bold text-right">Var</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline text-[10px] font-mono">
                            {drilldownAccountRows.map((r, idx) => {
                              const isActive = drilldownMonth === r.monthKey
                              return (
                                <tr
                                  key={idx}
                                  onClick={() => {
                                    setDrilldownMonth(r.monthKey)
                                    fetchTransactions(r.account)
                                  }}
                                  className={`cursor-pointer transition-colors hover:bg-emerald-500/5 ${isActive ? 'bg-emerald-500/10' : ''}`}
                                >
                                  <td className="p-1.5 font-semibold text-ink">{r.month}</td>
                                  <td className="p-1.5 text-right text-sky-600">{r.roi != null ? `${r.roi.toFixed(2)}%` : '-'}</td>
                                  <td className="p-1.5 text-right text-emerald-600 font-medium">{formatAmt(r.intRecovered)}</td>
                                  <td className="p-1.5 text-right text-ink-mute" title={buildCalcTooltip(r, 'intCalculated') || 'Int Calculated = |Opening| x ROI% / 100 x Days/365'}>{formatAmt(r.intCalculated)}</td>
                                  <td className={`p-1.5 text-right font-semibold ${
                                    r.variance < 0 ? 'text-amber-600' : r.variance > 0 ? 'text-emerald-700' : 'text-ink-mute'
                                  }`} title={buildCalcTooltip(r, 'variance') || 'Variance = Recovered - Calculated'}>{formatAmt(r.variance)}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transactions list Box — wider, taller */}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table className="w-3.5 h-3.5 text-emerald-600" />
                      <h3 className="text-[10px] font-bold text-ink tracking-wide uppercase font-mono">Statement Transactions</h3>
                      {drilldownAccount && (
                        <span className="text-[9px] font-mono text-ink-mute bg-canvas border border-hairline rounded px-1.5 py-0.5">
                          {drilldownAccount}
                        </span>
                      )}
                      {drilldownMonth !== 'all' && data?.monthLabels[drilldownMonth] && (
                        <span className="text-[9px] font-mono text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
                          {data.monthLabels[drilldownMonth]}
                        </span>
                      )}
                    </div>
                    {filteredTxns.length > 0 && (
                      <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-mono">
                        {filteredTxns.length === txnList.length 
                          ? `${txnList.length} rows` 
                          : `${filteredTxns.length} / ${txnList.length} rows`}
                      </span>
                    )}
                  </div>

                  {loadingTxns ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 bg-canvas rounded-xl border border-hairline border-dashed flex-1">
                      <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin" />
                      <p className="text-[10px] text-ink-mute font-mono">Loading transaction statements...</p>
                    </div>
                  ) : txnError ? (
                    <div className="p-6 text-center text-xs text-rose-500 bg-rose-500/5 rounded-xl border border-rose-500/10 font-mono">
                      {txnError}
                    </div>
                  ) : txnList.length > 0 ? (
                    <div className="border border-hairline rounded-xl overflow-hidden bg-canvas flex-1">
                      <div className="overflow-auto max-h-[420px] custom-scrollbar-vertical custom-scrollbar-horizontal">
                        <table className="min-w-full w-max text-left border-collapse table-auto whitespace-nowrap">
                          <thead>
                            <tr className="bg-canvas-soft border-b border-hairline text-[9px] font-bold text-ink-mute uppercase font-mono">
                              <th className="sticky top-0 bg-canvas-soft z-10 p-1.5">Date</th>
                              <th className="sticky top-0 bg-canvas-soft z-10 p-1.5">Description</th>
                              <th className="sticky top-0 bg-canvas-soft z-10 p-1.5 text-right">Debit</th>
                              <th className="sticky top-0 bg-canvas-soft z-10 p-1.5 text-right">Credit</th>
                              <th className="sticky top-0 bg-canvas-soft z-10 p-1.5 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline text-[10px] font-mono bg-white">
                            {filteredTxns.map((t, idx) => (
                              <tr key={idx} className="hover:bg-canvas-soft/35 transition-colors">
                                <td className="p-1.5 text-ink-mute whitespace-nowrap">{t.txn_date}</td>
                                <td className="p-1.5 text-ink max-w-[300px] truncate" title={t.description}>{t.description}</td>
                                <td className="p-1.5 text-right text-rose-600">{t.debit > 0 ? formatAmt(t.debit) : '-'}</td>
                                <td className="p-1.5 text-right text-emerald-600 font-medium">{t.credit > 0 ? formatAmt(t.credit) : '-'}</td>
                                <td className="p-1.5 text-right text-ink font-semibold">{t.balance !== null ? formatAmt(t.balance) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-10 text-center text-xs text-ink-mute italic bg-canvas rounded-xl border border-hairline border-dashed font-mono flex-1 flex items-center justify-center">
                      {txnList.length === 0 && !loadingTxns
                        ? 'Click a month row on the left or an account in the drill-down tree to load statements.'
                        : `No transactions for ${data?.monthLabels[drilldownMonth] || drilldownMonth}.`}
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* About Box */}
            <div className="bg-white rounded-xl border border-black p-4 shadow-sm text-xs space-y-2">
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
          </React.Fragment>
        )}
      </>
    )}

      </div>
    </div>
  )
}
