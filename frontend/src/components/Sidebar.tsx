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
  Sparkles
} from 'lucide-react'

interface SidebarProps {
  activePage: string
  setActivePage: (page: string) => void
}

const navItems = [
  { id: 'overview', label: 'Executive Overview', icon: LayoutDashboard },
  { id: 'ai', label: 'AI Copilot', icon: Sparkles },
  { id: 'calendar', label: 'Calendar Command', icon: Calendar },
  { id: 'transactions', label: 'All Transactions', icon: BarChart3 },
  { id: 'lifecycle', label: 'LC Lifecycle', icon: RefreshCcw },
  { id: 'forecast', label: 'Cash Forecast', icon: Zap },
  { id: 'bank', label: 'Bank Exposure', icon: Building },
  { id: 'supplier', label: 'Supplier Analytics', icon: UsersIcon }, // UsersIcon is handled below
  { id: 'boe', label: 'BOE Monitoring', icon: FileCheck },
  { id: 'shipment', label: 'Shipment Tracking', icon: Truck },
  { id: 'risk', label: 'Risk & Alerts', icon: ShieldCheck },
]

// Fixing the missing Users icon or using Building as placeholder if needed
import { Users as UsersIcon } from 'lucide-react'

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

      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activePage === item.id 
                ? 'bg-primary text-primary-foreground' 
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
        System Health: Online
      </div>
    </aside>
  )
}

export default Sidebar
