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
      { id: 'command', label: 'Treasury Command', icon: LayoutDashboard },
      { id: 'overview', label: 'Intelligence', icon: Activity },
      { id: 'ai', label: 'AI Copilot', icon: Sparkles },
    ]
  },
  {
    label: 'Analytics',
    items: [
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'forecast', label: 'Cash Forecast', icon: Zap },
      { id: 'fx', label: 'FX Exposure', icon: Globe },
    ]
  },
  {
    label: 'Operations',
    items: [
      { id: 'lifecycle', label: 'LC Lifecycle', icon: RefreshCcw },
      { id: 'bank', label: 'Bank Exposure', icon: Building },
      { id: 'boe', label: 'BOE Monitoring', icon: FileCheck },
    ]
  }
]

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  return (
    <aside className="w-64 bg-[#f5f5f7] h-[calc(100vh-52px)] flex flex-col sticky top-[52px] z-40">
      <div className="p-6">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b] group-focus-within:text-[#0066cc] transition-colors" />
          <input
            type="text"
            placeholder="Search"
            className="w-full pl-9 pr-4 py-1.5 bg-[#e8e8ed] border-none rounded-full text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-[#0066cc]/20 transition-all placeholder:text-[#86868b]"
          />
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-8 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-4 mb-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#86868b]">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActivePage(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
                    activePage === item.id
                      ? 'bg-white text-[#0066cc] shadow-sm'
                      : 'text-[#1d1d1f] hover:bg-[#e8e8ed]'
                  }`}
                >
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${activePage === item.id ? 'text-[#0066cc]' : 'text-[#86868b]'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-6 border-t border-[#e0e0e0]">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0066cc]" />
          <span className="text-[10px] text-[#86868b] uppercase font-bold tracking-widest">
            SECURE ACCESS
          </span>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
