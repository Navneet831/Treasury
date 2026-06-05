import React, { useEffect, useState, useMemo } from 'react'
import { getTransactions } from '../api'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { Download, Search } from 'lucide-react'

import { useStore } from '../store'

const TransactionList: React.FC = () => {
  const { fy } = useStore()
  const [rowData, setRowData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [gridApi, setGridApi] = useState<any>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const data = await getTransactions(fy)
        setRowData(data)
      } catch (error) {
        console.error('Error fetching transactions:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [fy])

  const columnDefs: ColDef[] = useMemo(() => [
    { field: 'LC no.', headerName: 'LC Number', pinned: 'left', filter: true },
    { field: 'Bank Name', filter: true },
    { field: 'Supplier Name', filter: true },
    { field: 'LC Op. Date', headerName: 'Opening Date', filter: 'agDateColumnFilter' },
    { field: 'LC Amt (in INR)', headerName: 'Amount (INR)', valueFormatter: (params: any) => params.value?.toLocaleString('en-IN') },
    { field: 'Currency', width: 100 },
    { field: 'Final LC Amt (in FC)', headerName: 'Amount (FC)' },
    { field: 'LC Status', filter: true, cellClass: (params: any) => params.value === 'Open' ? 'text-green-600 font-bold' : 'text-gray-600' },
    { field: 'BOE Status', filter: true },
    { field: 'Payment Status', filter: true },
    { field: 'Product Name', tooltipField: 'Product Name' },
    { 
      field: 'risk_flag', 
      headerName: 'Risk Flag', 
      filter: true, 
      pinned: 'right',
      cellClass: (params: any) => {
        if (params.value === 'Safe') return 'text-green-600 font-bold bg-green-50 text-xs px-2 py-1 rounded'
        if (params.value === 'Expiry Risk') return 'text-orange-600 font-bold bg-orange-50 text-xs px-2 py-1 rounded'
        return 'text-red-600 font-bold bg-red-50 text-xs px-2 py-1 rounded'
      }
    }
  ], [])

  const onGridReady = (params: any) => {
    setGridApi(params.api)
  }

  const onExport = () => {
    gridApi?.exportDataAsCsv()
  }

  const onFilterTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    gridApi?.setQuickFilter(e.target.value)
  }

  if (loading) return <div className="p-8 text-center">Loading transaction ledger...</div>

  return (
    <div className="p-8 space-y-6 h-[calc(100vh-64px)] flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Transaction Command Center</h2>
          <p className="text-sm text-muted-foreground">Comprehensive view of all Letter of Credit records</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Quick Filter..." 
              onChange={onFilterTextChange}
              className="pl-10 pr-4 py-2 bg-white border rounded-lg text-sm w-64 focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <button 
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm font-bold hover:bg-muted transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 ag-theme-alpine rounded-xl overflow-hidden border shadow-sm">
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
            sortable: true,
            flex: 1,
            minWidth: 120
          }}
          pagination={true}
          paginationPageSize={20}
          onGridReady={onGridReady}
          animateRows={true}
          rowSelection="single"
        />
      </div>
    </div>
  )
}

export default TransactionList
