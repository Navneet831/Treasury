import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllEnterpriseModule } from 'ag-grid-enterprise'
import { ModuleRegistry } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { getDrillDown, getTablesList, getTableData } from '../../api'
import { useStore } from '../../store'
import { formatCurrency, formatDate } from '../../utils'
import { FileSpreadsheet, RotateCcw } from 'lucide-react'

// AG Grid v35 requires explicit module registration
ModuleRegistry.registerModules([AllEnterpriseModule])

export const TransactionLedger: React.FC = () => {
  const { fy } = useStore()
  const [tables, setTables] = useState<string[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('LC')
  const [rowData, setRowData] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [colDefs, setColDefs] = useState<any[]>([])

  const gridRef = useRef<any>(null)
  const isRestoringRef = useRef<boolean>(false)
  const [gridReady, setGridReady] = useState<boolean>(false)

  // Selection Subtotals
  const [selectedCount, setSelectedCount] = useState<number>(0)
  const [sumLcAmt, setSumLcAmt] = useState<number>(0)
  const [sumBoeAmt, setSumBoeAmt] = useState<number>(0)

  const onSelectionChanged = useCallback((event: any) => {
    const selectedRows = event.api.getSelectedRows()
    setSelectedCount(selectedRows.length)

    const lcSum = selectedRows.reduce((acc: number, row: any) => acc + (row['LC Amt (in INR)'] || row['LC Amt'] || 0), 0)
    const boeSum = selectedRows.reduce((acc: number, row: any) => acc + (row['BOE Bill Amt (in INR)'] || row['BOE Bill Amt'] || 0), 0)

    setSumLcAmt(lcSum)
    setSumBoeAmt(boeSum)
  }, [])


  // Auto-generate columns for arbitrary warehouse tables
  const generateColDefs = useCallback((firstRow: any) => {
    return Object.keys(firstRow).map((key) => {
      const val = firstRow[key]
      const isNumber = typeof val === 'number'
      const isDate = key.toLowerCase().includes('date') || key.toLowerCase().includes('time') || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val))
      
      let filterParams: any = undefined
      if (isNumber) {
        filterParams = {
          filters: [
            { filter: 'agNumberColumnFilter' },
            { filter: 'agSetColumnFilter' }
          ]
        }
      } else if (isDate) {
        filterParams = {
          filters: [
            { filter: 'agDateColumnFilter' },
            { filter: 'agSetColumnFilter' }
          ]
        }
      }

      return {
        field: key,
        headerName: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        filterParams,
        valueFormatter: (p: any) => {
          if (p.value === null || p.value === undefined) return '—'
          if (isNumber) {
            if (key.toLowerCase().includes('no') || key.toLowerCase().includes('id') || key.toLowerCase().includes('code') || key.toLowerCase().includes('ref') || key.toLowerCase().includes('po')) {
              return String(p.value)
            }
            return formatCurrency(p.value, 'INR')
          }
          if (isDate) {
            return formatDate(p.value)
          }
          return String(p.value)
        }
      }
    })
  }, [])

  // Fetch tables list once on mount
  useEffect(() => {
    getTablesList().then((list) => {
      // Show only ledgers that are relevant to this Treasury app
      const treasuryTables = [
        'LC', 'LC BG in Process', 'LC_BG_in_Process', 'SBLC', 
        'bank_limit', 'Bank_Limit', 'FDR_List', 'FDR List', 
        'Bank_Guarantee', 'Bank Guarantee'
      ]
      const filtered = list.filter((t) => 
        treasuryTables.some(item => 
          item.toLowerCase() === t.toLowerCase() || 
          item.toLowerCase().replace(/_/g, ' ') === t.toLowerCase().replace(/_/g, ' ')
        )
      )

      // Prioritize primary tables, alphabetical for remainder
      const sorted = [...filtered].sort((a, b) => {
        if (a === 'LC') return -1
        if (b === 'LC') return 1
        if (a === 'SBLC') return -1
        if (b === 'SBLC') return 1
        if (a === 'Bank_Guarantee') return -1
        if (b === 'Bank_Guarantee') return 1
        return a.localeCompare(b)
      })
      setTables(sorted)
    }).catch((err) => {
      console.error('Failed to load tables list', err)
    })
  }, [])

  const fetchLedgerData = useCallback(async () => {
    setLoading(true)
    try {
      // Reset sums on data fetch
      setSelectedCount(0)
      setSumLcAmt(0)
      setSumBoeAmt(0)

      const data = selectedTable === 'LC'
        ? await getDrillDown({ fy })
        : await getTableData(selectedTable)

      setRowData(data)
      if (data && data.length > 0) {
        setColDefs(generateColDefs(data[0]))
      } else {
        setColDefs([])
      }
    } catch (err) {
      console.error('Failed to fetch ledger data', err)
    } finally {
      setLoading(false)
    }
  }, [fy, selectedTable, generateColDefs])

  useEffect(() => {
    fetchLedgerData()
  }, [fetchLedgerData])

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 120,
    sortable: true,
    filter: 'agMultiColumnFilter', // Enterprise Multi Filter (Text/Number/Date + Set Filter checkboxes)
    floatingFilter: false, // Hide inline quick floating filters (as requested to remove search bars)
    resizable: true,
    enableRowGroup: true, // Allow row grouping
    enablePivot: true, // Allow pivot mode
    enableValue: true, // Allow aggregations
    suppressHeaderMenuButton: false, // Ensure column menu is accessible
    wrapHeaderText: true, // Word wrap for header text
    autoHeaderHeight: true, // Auto height adjustment for header rows to fit wrapped text
  }), [])

  const sideBar = useMemo(() => ({
    toolPanels: [
      {
        id: 'columns',
        labelDefault: 'Columns',
        labelKey: 'columns',
        iconKey: 'columns',
        toolPanel: 'agColumnsToolPanel',
        toolPanelParams: {
          syncLayoutWithGrid: true,
          shouldShowRowGroup: true,
          shouldShowValues: true,
          shouldShowPivot: true,
          shouldShowPivotMode: true,
        },
      },
      {
        id: 'filters',
        labelDefault: 'Filters',
        labelKey: 'filters',
        iconKey: 'filter',
        toolPanel: 'agFiltersToolPanel',
      },
    ],
    defaultToolPanel: '',
  }), [])

  const statusBar = useMemo(() => ({
    statusPanels: [
      { statusPanel: 'agSelectedRowCountComponent', align: 'left' },
      { statusPanel: 'agAggregationComponent', align: 'right' },
    ],
  }), [])

  const onGridReady = useCallback((params: any) => {
    gridRef.current = params.api
    setGridReady(true)
  }, [])

  const onStateUpdated = useCallback((event: any) => {
    if (isRestoringRef.current) return
    if (!event.api) return
    const state = event.api.getState()
    localStorage.setItem(`ag-grid-state-${selectedTable}`, JSON.stringify(state))
  }, [selectedTable])

  const resetLayout = useCallback(() => {
    if (gridRef.current) {
      localStorage.removeItem(`ag-grid-state-${selectedTable}`)
      gridRef.current.resetColumnState()
      gridRef.current.setFilterModel(null)
      gridRef.current.applyColumnState({
        defaultState: { sort: null },
      })
      gridRef.current.setRowGroupColumns([])
      gridRef.current.setPivotColumns([])
      gridRef.current.setValueColumns([])
      gridRef.current.setPivotMode(false)
      fetchLedgerData()
    }
  }, [selectedTable, fetchLedgerData])

  // Restore state when selectedTable/rowData/colDefs change
  useEffect(() => {
    if (gridReady && gridRef.current && rowData.length > 0 && colDefs.length > 0) {
      const savedStateStr = localStorage.getItem(`ag-grid-state-${selectedTable}`)
      if (savedStateStr) {
        try {
          const savedState = JSON.parse(savedStateStr)
          isRestoringRef.current = true
          gridRef.current.setState(savedState)
          setTimeout(() => {
            isRestoringRef.current = false
          }, 100)
        } catch (e) {
          console.error('Failed to restore grid state', e)
          isRestoringRef.current = false
        }
      } else {
        isRestoringRef.current = true
        gridRef.current.setState({})
        setTimeout(() => {
          isRestoringRef.current = false
        }, 100)
      }
    }
  }, [gridReady, selectedTable, rowData, colDefs])

  const showSums = useMemo(() => {
    return selectedTable === 'LC' || (rowData.length > 0 && ('LC Amt (in INR)' in rowData[0] || 'BOE Bill Amt (in INR)' in rowData[0]))
  }, [selectedTable, rowData])

  return (
    <div className="p-2 w-full bg-[#fafafa]">
      <div className="w-full space-y-2">
        
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#e2e8f0] pb-2">
          <div>
            <h1 className="text-[18px] font-bold text-[#0f172a] tracking-tight leading-none">Transaction Ledger</h1>
            <p className="text-[11px] text-[#64748b] mt-1">
              Explore raw transaction data across all facilities
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Table Selection Dropdown */}
            {tables.length > 0 && (
              <div className="flex items-center gap-2 bg-white border border-[#e2e8f0] px-3 py-1.5 rounded-xl shadow-sm">
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Source Table:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => {
                    setSelectedTable(e.target.value)
                  }}
                  className="bg-transparent text-[12px] font-bold text-[#0f172a] outline-none cursor-pointer"
                >
                  {tables.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Excel Export Button */}
            <button
              onClick={() => {
                if (gridRef.current) {
                  gridRef.current.exportDataAsExcel({
                    fileName: `Transaction_Ledger_${selectedTable}_${new Date().toISOString().split('T')[0]}`
                  })
                }
              }}
              className="flex items-center gap-2 bg-[#107c41] hover:bg-[#0b592e] text-white px-4 py-1.5 rounded-xl shadow-sm transition-all text-[12px] font-bold cursor-pointer"
              title="Export ledger data directly to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export to Excel</span>
            </button>

            {/* Reset Layout Button */}
            <button
              onClick={resetLayout}
              className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-[#e2e8f0] px-4 py-1.5 rounded-xl shadow-sm transition-all text-[12px] font-bold cursor-pointer"
              title="Reset column orders, visibility, sorting, and filters to default"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Reset Layout</span>
            </button>

            {/* Selection Subtotals Badge */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-4 px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-xl animate-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest leading-none">Selected</span>
                  <span className="text-[12px] font-black text-blue-800 text-center">{selectedCount}</span>
                </div>
                {showSums && (
                  <>
                    <div className="w-px h-6 bg-blue-200" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">Sum LC Amt</span>
                      <span className="text-[13px] font-black text-slate-900 leading-none">{formatCurrency(sumLcAmt, 'INR')}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight">Sum BOE Amt</span>
                      <span className="text-[13px] font-black text-slate-900 leading-none">{formatCurrency(sumBoeAmt, 'INR')}</span>
                    </div>
                  </>
                )}
              </div>
            )}



          </div>
        </div>

        {/* AG Grid Container */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm p-0.5">
          <div
            className="ag-theme-alpine w-full h-[calc(100vh-115px)]"
            style={{
              '--ag-header-background-color': '#f3f4f6',
              '--ag-header-foreground-color': '#111827',
              '--ag-header-cell-hover-background-color': '#e5e7eb',
              '--ag-border-color': '#e5e7eb',
              '--ag-row-border-color': '#eef0f2',
              '--ag-font-size': '12px',
            } as React.CSSProperties}
          >
            {loading && rowData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#64748b] text-[13px] font-medium">
                Loading table data...
              </div>
            ) : (
              <AgGridReact
                theme="legacy"
                ref={gridRef}
                rowData={rowData}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                rowSelection="multiple"
                onSelectionChanged={onSelectionChanged}
                animateRows={true}
                pagination={true}
                paginationPageSize={50}
                overlayNoRowsTemplate="<span class='text-sm text-slate-500'>No transactions found.</span>"
                sideBar={sideBar}
                statusBar={statusBar}
                rowGroupPanelShow="always"
                pivotPanelShow="always"
                enableRangeSelection={true}
                enableCharts={true}
                onGridReady={onGridReady}
                onStateUpdated={onStateUpdated}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
