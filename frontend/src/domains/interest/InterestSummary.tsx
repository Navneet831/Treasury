import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Percent, ArrowDownToLine, RefreshCw, Grid, Table, CheckCircle2, XCircle, HelpCircle,
  TrendingUp, CreditCard, AlertTriangle, Building, BookOpen, Layers, Search
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

export const InterestSummary: React.FC = () => {
  const [data, setData] = useState<InterestSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters State
  const [selectedType, setSelectedType] = useState<string>('All')
  const [selectedBank, setSelectedBank] = useState<string>('All')
  const [selectedAccount, setSelectedAccount] = useState<string>('All')
  const [selectedFy, setSelectedFy] = useState<string>('All FYs')
  const [selectedMonth, setSelectedMonth] = useState<string>('All')
  const [showEmptyAccounts, setShowEmptyAccounts] = useState<boolean>(false)

  // Drill-down FY state (which FY is expanded in the FY→Month tree)
  const [drilldownFy, setDrilldownFy] = useState<string>('')
  // Drill-down month state (which month is expanded to show accounts)
  const [drilldownMonthExpanded, setDrilldownMonthExpanded] = useState<string>('')

  // Account search within Account Interest Analysis panel
  const [acctSearch, setAcctSearch] = useState<string>('')
  const [acctSearchOpen, setAcctSearchOpen] = useState<boolean>(false)

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


  // Clean month filter selection if FY changes
  useEffect(() => {
    setSelectedMonth('All')
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
            <div className="bg-white rounded-xl border border-hairline p-2 px-3 shadow-sm grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 items-start">
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
                <label className="block text-[10px] font-bold text-ink-mute uppercase tracking-wide mb-0.5 font-mono">FY / Month</label>
                <div className="border border-hairline bg-canvas rounded-lg p-1 h-[130px] overflow-y-auto flex flex-col gap-0.5 custom-scrollbar-vertical">
                  {/* All option */}
                  <button
                    onClick={() => {
                      setSelectedFy('All FYs')
                      setSelectedMonth('All')
                      setDrilldownFy('')
                      setDrilldownMonth('all')
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
                  {(data?.fyList ?? []).map(fy => {
                    const isExpanded = drilldownFy === fy
                    const fyMonths = (data?.months ?? []).filter(mk =>
                      data?.rows.some(r => r.monthKey === mk && r.fy === fy)
                    )
                    const isFySelected = selectedFy === fy && selectedMonth === 'All'
                    return (
                      <div key={fy}>
                        {/* Level 1: FY row */}
                        <button
                          onClick={() => {
                            const toggled = isExpanded ? '' : fy
                            setDrilldownFy(toggled)
                            setSelectedFy(toggled ? fy : 'All FYs')
                            setSelectedMonth('All')
                            setDrilldownMonth('all')
                            setDrilldownMonthExpanded('')
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
                          const isMExpanded = drilldownMonthExpanded === mKey
                          // Accounts for this FY+month
                          const mAccounts = (data?.rows ?? []).filter(
                            r => r.monthKey === mKey && r.fy === fy && r.tableFound
                          )
                          return (
                            <div key={mKey}>
                              {/* Month toggle button */}
                              <button
                                onClick={() => {
                                  setSelectedMonth(mKey)
                                  setDrilldownMonth(mKey)
                                  setDrilldownMonthExpanded(isMExpanded ? '' : mKey)
                                }}
                                className={`w-full text-left text-[10px] pl-4 pr-2 py-0.5 rounded font-mono font-semibold transition-all flex items-center gap-1 border ${
                                  isMSelected
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700'
                                    : 'bg-white border-transparent text-ink-mute hover:bg-canvas'
                                }`}
                              >
                                <span className="opacity-60 text-[9px]">{isMExpanded ? '▾' : '▸'}</span>
                                {label}
                              </button>

                              {/* Level 3: Account buttons */}
                              {isMExpanded && mAccounts.map(r => {
                                const isAcctSelected = drilldownAccount === r.account
                                return (
                                  <button
                                    key={r.account}
                                    onClick={() => {
                                      setDrilldownAccount(r.account)
                                      setDrilldownMonth(mKey)
                                      fetchTransactions(r.account)
                                    }}
                                    className={`w-full text-left text-[10px] pl-8 pr-2 py-0.5 rounded font-mono transition-all border ${
                                      isAcctSelected
                                        ? 'bg-violet-500/10 border-violet-500/20 text-violet-700 font-bold'
                                        : 'bg-white border-transparent text-ink-mute hover:bg-canvas'
                                    }`}
                                  >
                                    {r.account}
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center h-8 pb-1">
                <label className="flex items-center gap-1.5 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEmptyAccounts}
                    onChange={(e) => setShowEmptyAccounts(e.target.checked)}
                    className="accent-emerald-600 rounded"
                  />
                  <span className="text-[10px] font-semibold text-ink-mute">Show empty accounts</span>
                </label>
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
            <div className="bg-white rounded-xl border border-hairline shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-auto max-h-[350px] custom-scrollbar-horizontal custom-scrollbar-vertical">
                
                {viewMode === 'all' && (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-hairline text-[10px] font-mono text-ink-mute uppercase">
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-left cursor-pointer select-none" onClick={() => handleSort('type')}>Type {renderSortIndicator('type')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-left cursor-pointer select-none" onClick={() => handleSort('account')}>Account {renderSortIndicator('account')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-left cursor-pointer select-none" onClick={() => handleSort('bank')}>Bank {renderSortIndicator('bank')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-left cursor-pointer select-none" onClick={() => handleSort('fy')}>FY {renderSortIndicator('fy')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-left cursor-pointer select-none" onClick={() => handleSort('monthKey')}>Month {renderSortIndicator('monthKey')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-right cursor-pointer select-none" onClick={() => handleSort('openingBal')}>Opening Bal {renderSortIndicator('openingBal')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-right cursor-pointer select-none" onClick={() => handleSort('closingBal')}>Closing Bal {renderSortIndicator('closingBal')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-right cursor-pointer select-none" onClick={() => handleSort('roi')}>ROI (%) {renderSortIndicator('roi')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-right cursor-pointer select-none" onClick={() => handleSort('intRecovered')}>Int Recovered {renderSortIndicator('intRecovered')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-right cursor-pointer select-none" onClick={() => handleSort('intCalculated')}>Int Calculated {renderSortIndicator('intCalculated')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-right cursor-pointer select-none" onClick={() => handleSort('variance')}>Variance {renderSortIndicator('variance')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-right cursor-pointer select-none" onClick={() => handleSort('variancePct')}>Var % {renderSortIndicator('variancePct')}</th>
                        <th className="sticky top-0 bg-slate-100 z-10 p-2 font-bold text-center">Data</th>
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
                          className={`hover:bg-canvas-soft/40 transition-colors ${
                            r.tableFound ? 'cursor-pointer' : 'opacity-60'
                          } ${drilldownAccount === r.account ? 'bg-emerald-500/5' : ''}`}
                        >
                          <td className="p-2 text-ink-mute">{r.type}</td>
                          <td className="p-2 font-mono font-medium text-ink">{r.account}</td>
                          <td className="p-2 font-semibold text-ink-mute">{r.bank}</td>
                          <td className="p-2 text-ink-mute font-mono">{r.fy}</td>
                          <td className="p-2 text-ink font-mono">{r.month}</td>
                          <td className="p-2 text-right font-mono text-ink-mute">{formatAmt(r.openingBal)}</td>
                          <td className="p-2 text-right font-mono text-ink-mute">{formatAmt(r.closingBal)}</td>
                          <td className="p-2 text-right font-mono font-semibold text-sky-600">{r.roi !== null ? `${r.roi.toFixed(2)}%` : '-'}</td>
                          <td className="p-2 text-right font-mono font-medium text-emerald-600">{formatAmt(r.intRecovered)}</td>
                          <td className="p-2 text-right font-mono text-ink">{formatAmt(r.intCalculated)}</td>
                          <td className={`p-2 text-right font-mono font-semibold ${
                            r.variance < 0 ? 'text-amber-600' : r.variance > 0 ? 'text-emerald-700' : 'text-ink-mute'
                          }`}>
                            {formatAmt(r.variance)}
                          </td>
                          <td className="p-2 text-right font-mono text-ink-mute">{r.roi !== null && r.openingBal !== null ? `${r.variancePct.toFixed(1)}%` : '-'}</td>
                          <td className="p-2 text-center">
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
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-hairline text-[10px] font-mono text-ink-mute uppercase">
                        <th rowSpan={2} className="sticky top-0 bg-slate-100 z-20 p-1.5 font-bold text-left border-b border-hairline cursor-pointer select-none" onClick={() => handleSort('type')}>Type {renderSortIndicator('type')}</th>
                        <th rowSpan={2} className="sticky top-0 bg-slate-100 z-20 p-1.5 font-bold text-left border-b border-hairline cursor-pointer select-none" onClick={() => handleSort('account')}>Account {renderSortIndicator('account')}</th>
                        <th rowSpan={2} className="sticky top-0 bg-slate-100 z-20 p-1.5 font-bold text-left border-b border-hairline cursor-pointer select-none" onClick={() => handleSort('bank')}>Bank {renderSortIndicator('bank')}</th>
                        {activeMonthsList.map(m => (
                          <th key={m} colSpan={2} className="sticky top-0 bg-sky-50 z-10 p-1.5 font-bold text-ink border-l border-hairline text-center">
                            {data?.monthLabels[m]}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-slate-50 border-b border-hairline text-[9px] font-mono text-ink-mute uppercase">
                        {activeMonthsList.map(m => (
                          <React.Fragment key={m}>
                            <th className="sticky top-[28px] bg-slate-50 z-10 p-1 border-l border-hairline text-right">Open</th>
                            <th className="sticky top-[28px] bg-slate-50 z-10 p-1 text-right">Close</th>
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
                          <td className="p-2 text-ink-mute font-sans" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.type}</td>
                          <td className="p-2 font-semibold text-ink" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.account}</td>
                          <td className="p-2 text-ink-mute font-sans" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.bank}</td>
                          {activeMonthsList.map(m => (
                            <React.Fragment key={m}>
                              <td className="p-2 text-right text-ink-mute hover:bg-sky-500/10 transition-colors" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth(m); }}>{formatAmt(acctRow[`open_${m}`])}</td>
                              <td className="p-2 text-right text-ink-mute hover:bg-amber-500/10 transition-colors" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth(m); }}>{formatAmt(acctRow[`close_${m}`])}</td>
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
                      <tr className="bg-slate-100 border-b border-hairline text-[10px] font-mono text-ink-mute uppercase">
                        <th rowSpan={2} className="sticky top-0 bg-slate-100 z-20 p-1.5 font-bold text-left border-b border-hairline cursor-pointer select-none" onClick={() => handleSort('type')}>Type {renderSortIndicator('type')}</th>
                        <th rowSpan={2} className="sticky top-0 bg-slate-100 z-20 p-1.5 font-bold text-left border-b border-hairline cursor-pointer select-none" onClick={() => handleSort('account')}>Account {renderSortIndicator('account')}</th>
                        <th rowSpan={2} className="sticky top-0 bg-slate-100 z-20 p-1.5 font-bold text-left border-b border-hairline cursor-pointer select-none" onClick={() => handleSort('bank')}>Bank {renderSortIndicator('bank')}</th>
                        {activeMonthsList.map(m => (
                          <th key={m} colSpan={6} className="sticky top-0 bg-emerald-50 z-10 p-1.5 font-bold text-ink border-l border-hairline text-center">
                            {data?.monthLabels[m]}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-slate-50 border-b border-hairline text-[9px] font-mono text-ink-mute uppercase">
                        {activeMonthsList.map(m => (
                          <React.Fragment key={m}>
                            <th className="sticky top-[28px] bg-slate-50 z-10 p-1 border-l border-hairline text-right">ROI</th>
                            <th className="sticky top-[28px] bg-slate-50 z-10 p-1 text-right">Open</th>
                            <th className="sticky top-[28px] bg-slate-50 z-10 p-1 text-right">Close</th>
                            <th className="sticky top-[28px] bg-slate-50 z-10 p-1 text-right">Recov.</th>
                            <th className="sticky top-[28px] bg-slate-50 z-10 p-1 text-right">Calc.</th>
                            <th className="sticky top-[28px] bg-slate-50 z-10 p-1 text-right">Var</th>
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
                          <td className="p-2 text-ink-mute font-sans" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.type}</td>
                          <td className="p-2 font-semibold text-ink" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.account}</td>
                          <td className="p-2 text-ink-mute font-sans" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth('all'); }}>{acctRow.bank}</td>
                          {activeMonthsList.map(m => {
                            const v = acctRow[`variance_${m}`]
                            return (
                              <React.Fragment key={m}>
                                <td className="p-2 border-l border-hairline text-right text-sky-600 font-semibold hover:bg-emerald-500/10 transition-colors" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth(m); }}>
                                  {acctRow[`roi_${m}`] !== null ? `${acctRow[`roi_${m}`].toFixed(1)}%` : '-'}
                                </td>
                                <td className="p-2 text-right text-ink-mute hover:bg-emerald-500/10 transition-colors" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth(m); }}>{formatAmt(acctRow[`open_${m}`])}</td>
                                <td className="p-2 text-right text-ink-mute hover:bg-emerald-500/10 transition-colors" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth(m); }}>{formatAmt(acctRow[`close_${m}`])}</td>
                                <td className="p-2 text-right text-emerald-600 font-medium hover:bg-emerald-500/10 transition-colors" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth(m); }}>{formatAmt(acctRow[`recovered_${m}`])}</td>
                                <td className="p-2 text-right text-ink hover:bg-emerald-500/10 transition-colors" onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth(m); }}>{formatAmt(acctRow[`calculated_${m}`])}</td>
                                <td className={`p-2 text-right font-semibold hover:bg-emerald-500/10 transition-colors ${v < 0 ? 'text-amber-600' : v > 0 ? 'text-emerald-700' : 'text-ink-mute'}`} onClick={() => { setDrilldownAccount(acctRow.account); setDrilldownMonth(m); }}>
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
              <div className="bg-white rounded-xl border border-hairline shadow-sm overflow-hidden flex flex-col xl:flex-row gap-3 p-3">
                
                {/* Account Details Box — compact left panel */}
                <div className="w-full xl:w-[280px] shrink-0 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <h3 className="text-[10px] font-bold text-ink tracking-wide uppercase font-mono">Account Interest Analysis</h3>
                  </div>

                  {/* Account Search Combobox */}
                  <div className="relative">
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
                          placeholder="Search account no..."
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
                      const allAccts = Array.from(new Set(processedRows.map(r => r.account)))
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

                  {/* Key facts */}
                  <div className="bg-canvas rounded-lg px-2 py-1.5 text-[10px] divide-y divide-hairline/50 font-mono">
                    {processedRows.filter(r => r.account === drilldownAccount).slice(0, 1).map((info, idx) => (
                      <React.Fragment key={idx}>
                        <div className="flex justify-between py-1">
                          <span className="text-ink-mute">Type / Bank</span>
                          <span className="font-semibold text-ink">{info.type} | {info.bank}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-ink-mute">ROI</span>
                          <span className="font-bold text-sky-600">{info.roi !== null ? `${info.roi.toFixed(2)}%` : '—'}</span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>

                  {/* Monthly splits — compact table style */}
                  <div>
                    <div className="text-[9px] font-bold text-ink-mute uppercase tracking-wide font-mono mb-1">Monthly Splits <span className="font-normal normal-case">(click row to load statements)</span></div>
                    <div className="border border-hairline rounded-lg overflow-hidden">
                      <div className="overflow-y-auto max-h-[280px] custom-scrollbar-vertical">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-[9px] font-mono text-ink-mute uppercase">
                              <th className="sticky top-0 bg-slate-100 p-1.5 font-bold">Month</th>
                              <th className="sticky top-0 bg-slate-100 p-1.5 font-bold text-right">ROI</th>
                              <th className="sticky top-0 bg-slate-100 p-1.5 font-bold text-right text-emerald-700">Rec</th>
                              <th className="sticky top-0 bg-slate-100 p-1.5 font-bold text-right">Calc</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-hairline text-[10px] font-mono">
                            {processedRows.filter(r => r.account === drilldownAccount).map((r, idx) => {
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
                                  <td className="p-1.5 text-right text-sky-600">{r.roi !== null ? `${r.roi.toFixed(2)}%` : '-'}</td>
                                  <td className="p-1.5 text-right text-emerald-600 font-medium">{formatAmt(r.intRecovered)}</td>
                                  <td className="p-1.5 text-right text-ink-mute">{formatAmt(r.intCalculated)}</td>
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
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-100 border-b border-hairline text-[9px] font-bold text-ink-mute uppercase font-mono">
                              <th className="sticky top-0 bg-slate-100 z-10 p-1.5">Date</th>
                              <th className="sticky top-0 bg-slate-100 z-10 p-1.5">Description</th>
                              <th className="sticky top-0 bg-slate-100 z-10 p-1.5 text-right">Debit</th>
                              <th className="sticky top-0 bg-slate-100 z-10 p-1.5 text-right">Credit</th>
                              <th className="sticky top-0 bg-slate-100 z-10 p-1.5 text-right">Balance</th>
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
