import React, { useState, useMemo } from 'react'
import {
  Calendar, RefreshCcw, Building, FileCheck,
  Zap, Search, Sparkles, Activity, Globe, ShieldAlert,
  TrendingUp, Gauge, Package, FileSpreadsheet,
  BookOpen, ShieldCheck
} from 'lucide-react'

interface SidebarProps {
  activePage: string
  setActivePage: (page: string) => void
}

const navGroups = [
  {
    label: 'Command',
    items: [
      { id: 'limit',    label: 'Limit Utilization', icon: Gauge },
      { id: 'overview', label: 'Executive Intel',   icon: Activity },
      { id: 'risk',     label: 'Risk Alerts',        icon: ShieldAlert },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { id: 'calendar', label: 'Calendar',       icon: Calendar },
      { id: 'forecast', label: 'Cash Forecast',  icon: Zap },
      { id: 'fx',       label: 'FX Exposure',    icon: Globe },
      { id: 'hedge',    label: 'Hedge Coverage', icon: ShieldCheck },
      { id: 'trend',    label: 'Trend Analysis', icon: TrendingUp },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'lifecycle', label: 'LC Lifecycle',      icon: RefreshCcw },
      { id: 'bank',      label: 'Bank Exposure',     icon: Building },
      { id: 'boe',       label: 'BOE Monitoring',    icon: FileCheck },
      { id: 'track',     label: 'Track & Suppliers', icon: Package },
    ],
  },
  {
    label: 'Reports',
    items: [
      { id: 'research', label: 'Intelligence & Models', icon: BookOpen },
    ],
  },
]

const bottomItems = [
  { id: 'ai',           label: 'AI Copilot',         icon: Sparkles },
  { id: 'transactions', label: 'Transaction Ledger', icon: FileSpreadsheet },
]

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query.trim()) return navGroups
    const q = query.toLowerCase()
    return navGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.items.length > 0)
  }, [query])

  const renderBtn = (item: { id: string; label: string; icon: React.FC<any> }) => {
    const isActive = activePage === item.id
    return (
      <button
        key={item.id}
        onClick={() => setActivePage(item.id)}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-[8px] text-[13px] font-medium transition-all duration-150 ${
          isActive
            ? 'bg-white text-[#1d4ed8] shadow-sm border border-[#e2e8f0]'
            : 'text-[#475569] hover:bg-white hover:text-[#0f172a]'
        }`}
      >
        <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#1d4ed8]' : 'text-[#94a3b8]'}`} />
        <span className="truncate">{item.label}</span>
        {item.id === 'risk' && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#dc2626]" />
        )}
      </button>
    )
  }

  return (
    <aside className="w-[220px] bg-[#f8fafc] h-[calc(100vh-52px)] flex flex-col sticky top-[52px] z-40 border-r border-[#e2e8f0]">
      {/* Search */}
      <div className="px-4 pt-5 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94a3b8]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules"
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#e2e8f0] rounded-lg text-[12px] text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]/20 focus:border-[#1d4ed8] transition-all placeholder:text-[#94a3b8]"
          />
        </div>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 px-3 pb-2 space-y-4 overflow-y-auto">
        {filtered.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#94a3b8]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(renderBtn)}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 text-[12px] text-[#94a3b8] italic">No modules match "{query}"</p>
        )}
      </nav>

      {/* Pinned bottom: Transactions + AI */}
      <div className="px-3 py-3 border-t border-[#e2e8f0] space-y-0.5">
        {bottomItems.map(renderBtn)}
      </div>
    </aside>
  )
}

export default Sidebar
