import React from 'react'
import type { NavItemDef } from './navConfig'

interface NavItemProps {
  def: NavItemDef
  active: boolean
  collapsed: boolean
  onSelect: (id: string) => void
}

/**
 * A single sidebar nav button. Emerald is the only chromatic event: it appears
 * as a 2px left rail + the icon tint on the active item, never as a flooded fill.
 * When collapsed, the label is hidden and surfaced as a hover tooltip.
 */
const NavItem: React.FC<NavItemProps> = ({ def, active, collapsed, onSelect }) => {
  const Icon = def.icon
  return (
    <button
      onClick={() => onSelect(def.id)}
      title={collapsed ? def.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex w-full items-center rounded-md text-[13px] font-medium transition-colors duration-150 ${
        collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-1.5'
      } ${
        active
          ? 'bg-parchment text-ink'
          : 'text-ink-mute hover:bg-parchment hover:text-ink'
      }`}
    >
      {/* Emerald active rail */}
      <span
        className={`absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-accent transition-opacity duration-150 ${
          active ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <Icon
        className={`h-4 w-4 flex-shrink-0 transition-colors ${
          active ? 'text-accent' : 'text-ink-faint group-hover:text-ink-mute'
        }`}
      />
      {!collapsed && <span className="truncate">{def.label}</span>}
    </button>
  )
}

export default NavItem
