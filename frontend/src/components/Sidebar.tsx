import React from 'react'
import {
  LayoutDashboard,
  Calendar,
  RefreshCcw,
  Building,
  Truck,
  FileCheck,
  Zap,
  ShieldCheck,
  Search,
  BarChart3,
  Sparkles,
  Activity,
  Cpu,
  Users,
  Globe,
  TrendingUp,
  Gauge
} from 'lucide-react'

interface SidebarProps {
  activePage: string
  setActivePage: (page: string) => void
}

const navGroups = [
  {
    label: 'Command',
    items: [
      { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
      { id: 'intelligence', label: 'Strategic Intel', icon: Activity },
      { id: 'quant', label: 'Advanced Quant', icon: Cpu },
      { id: 'ai', label: 'AI Copilot', icon: Sparkles },
    ]
  },
  {
    label: 'Analytics',
    items: [
      { id: 'calendar', label: 'Calendar Command', icon: Calendar },
      { id: 'forecast', label: 'Cash Forecast', icon: Zap },
      { id: 'fx', label: 'FX Exposure', icon: Globe },
      { id: 'trend', label: 'Trend & Cohort', icon: TrendingUp },
      { id: 'limit', label: 'Limit Utilization', icon: Gauge },
    ]
  },
  {
    label: 'Operations',
    items: [
      { id: 'lifecycle', label: 'LC Lifecycle', icon: RefreshCcw },
      { id: 'bank', label: 'Bank Exposure', icon: Building },
      { id: 'supplier', label: 'Supplier Analytics', icon: Users },
      { id: 'boe', label: 'BOE Monitoring', icon: FileCheck },
      { id: 'shipment', label: 'Shipment Tracking', icon: Truck },
    ]
  },
  {
    label: 'Risk & Compliance',
    items: [
      { id: 'risk', label: 'Risk & Alerts', icon: ShieldCheck },
      { id: 'pe', label: 'PE Portfolio Monitor', icon: Building },
    ]
  },
  {
    label: 'Data',
    items: [
      { id: 'transactions', label: 'All Transactions', icon: BarChart3 },
    ]
  }
]

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  return (
    <aside className="w-64 border-r bg-white h-[calc(100vh-64px)] flex flex-col sticky top-16">
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Global Search..."
            className="w-full pl-10 pr-4 py-2 bg-muted/50 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activePage === item.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
            System Online
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
