import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { ClientSideRowModelModule, ModuleRegistry } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { getDrillDown } from '../../api'
import { useStore } from '../../store'
import { formatCurrency, formatDate } from '../../utils'

ModuleRegistry.registerModules([ClientSideRowModelModule])

export const TransactionLedger: React.FC = () => {
  const { fy } = useStore()
  const [activeTab, setActiveTab] = useState<'ALL' | 'LC' | 'SBLC' | 'CASH'>('ALL')
  const [rowData, setRowData] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const fetchLedgerData = useCallback(async () => {
    setLoading(true)
    try {
      // For a robust implementation, we might want dedicated endpoints,
      // but getDrillDown without major filters returns all LC table data.
      const data = await getDrillDown({ fy })
      let filteredData = data
      
      // Simple frontend filtering based on standard product/facility logic
      if (activeTab === 'SBLC') {
        filteredData = data.filter((row: any) => row['SBLC Status'] && row['SBLC Status'].startsWith('Yes'))
      } else if (activeTab === 'CASH') {
        filteredData = data.filter((row: any) => 
          (row['Product Name'] && row['Product Name'].includes('CASH')) || 
          (row['Type'] && row['Type'].includes('CASH'))
        )
      } else if (activeTab === 'LC') {
        filteredData = data.filter((row: any) => 
          !(row['SBLC Status'] && row['SBLC Status'].startsWith('Yes')) && 
          !(row['Product Name'] && row['Product Name'].includes('CASH'))
        )
      }
      
      setRowData(filteredData)
    } catch (err) {
      console.error('Failed to fetch ledger data', err)
    } finally {
      setLoading(false)
    }
  }, [fy, activeTab])

  useEffect(() => {
    fetchLedgerData()
  }, [fetchLedgerData])

  const [colDefs] = useState([
    { field: 'LC no.', headerName: 'LC No.', filter: 'agTextColumnFilter', sortable: true, resizable: true },
    { field: 'Bank Name', headerName: 'Bank', filter: 'agSetColumnFilter', sortable: true, resizable: true },
    { field: 'Supplier Name', headerName: 'Supplier', filter: 'agTextColumnFilter', sortable: true, resizable: true },
    { field: 'Product Name', headerName: 'Product', filter: 'agSetColumnFilter', sortable: true, resizable: true },
    { field: 'Type', headerName: 'Type', filter: 'agSetColumnFilter', sortable: true, resizable: true },
    { field: 'Status', headerName: 'LC Status', filter: 'agSetColumnFilter', sortable: true, resizable: true },
    { field: 'Payment Status', headerName: 'Payment Status', filter: 'agSetColumnFilter', sortable: true, resizable: true },
    { field: 'BOE Status', headerName: 'BOE Status', filter: 'agSetColumnFilter', sortable: true, resizable: true },
    { 
      field: 'LC Amt (in INR)', 
      headerName: 'LC Amt (INR)', 
      filter: 'agNumberColumnFilter',
      valueFormatter: (p: any) => formatCurrency(p.value, 'INR'),
      sortable: true, 
      resizable: true 
    },
    { 
      field: 'BOE Bill Amt (in INR)', 
      headerName: 'BOE Amt (INR)', 
      filter: 'agNumberColumnFilter',
      valueFormatter: (p: any) => formatCurrency(p.value, 'INR'),
      sortable: true, 
      resizable: true 
    },
    { 
      field: 'LC Payment Due Date', 
      headerName: 'Due Date', 
      filter: 'agDateColumnFilter',
      valueFormatter: (p: any) => formatDate(p.value),
      sortable: true, 
      resizable: true 
    },
    { 
      field: 'Date of Bill of Entry Submitted to Bank', 
      headerName: 'BOE Date', 
      filter: 'agDateColumnFilter',
      valueFormatter: (p: any) => formatDate(p.value),
      sortable: true, 
      resizable: true 
    }
  ])

  const defaultColDef = useMemo(() => ({
    flex: 1,
    minWidth: 120,
    filter: true,
    floatingFilter: true,
  }), [])

  return (
    <div className="p-4 md:p-6 lg:p-8 bg-[#fafafa] min-h-screen">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#e2e8f0] pb-4">
          <div>
            <h1 className="text-[24px] font-bold text-[#0f172a] tracking-tight leading-tight">Transaction Ledger</h1>
            <p className="text-[13px] text-[#64748b] mt-1">
              Explore and filter raw transaction data across all facilities
            </p>
          </div>
          
          <div className="flex bg-white border border-[#e2e8f0] p-1 rounded-xl shadow-sm w-fit">
            {(['ALL', 'LC', 'SBLC', 'CASH'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 text-[11px] font-bold uppercase rounded-lg transition-all ${
                  activeTab === tab
                    ? 'bg-[#0f172a] text-white shadow-sm'
                    : 'text-[#64748b] hover:text-[#0f172a] hover:bg-slate-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* AG Grid Container */}
        <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-sm p-1">
          <div className="ag-theme-alpine w-full h-[calc(100vh-220px)]" style={{ '--ag-border-color': 'transparent' } as React.CSSProperties}>
            {loading && rowData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#64748b] text-[13px] font-medium">
                Loading transaction data...
              </div>
            ) : (
              <AgGridReact
                rowData={rowData}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                rowSelection="multiple"
                animateRows={true}
                pagination={true}
                paginationPageSize={50}
                overlayNoRowsTemplate="<span class='text-sm text-slate-500'>No transactions found.</span>"
              />
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
