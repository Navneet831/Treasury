import React from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface SidebarToggleProps {
  collapsed: boolean
  onToggle: () => void
}

/** Pin / collapse control. Lives at the bottom of the rail. */
const SidebarToggle: React.FC<SidebarToggleProps> = ({ collapsed, onToggle }) => {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose
  return (
    <button
      type="button"
      onClick={onToggle}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className={`flex items-center rounded-md py-1.5 text-[12px] font-medium text-ink-mute transition-colors hover:bg-parchment hover:text-ink ${
        collapsed ? 'w-full justify-center px-0' : 'w-full gap-2.5 px-3'
      }`}
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-ink-faint" />
      {!collapsed && <span>Collapse</span>}
    </button>
  )
}

export default SidebarToggle
