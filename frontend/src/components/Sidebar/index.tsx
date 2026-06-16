import React, { useMemo } from 'react'
import { Search } from 'lucide-react'
import { navGroups, bottomItems } from './navConfig'
import { useSidebar } from './useSidebar'
import NavItem from './NavItem'
import SidebarToggle from './SidebarToggle'

interface SidebarProps {
  activePage: string
  setActivePage: (page: string) => void
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const { collapsed, toggle, expand, query, setQuery } = useSidebar()

  const filtered = useMemo(() => {
    if (!query.trim()) return navGroups
    const q = query.toLowerCase()
    return navGroups
      .map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0)
  }, [query])

  return (
    <aside
      className={`sticky top-[52px] z-40 flex h-[calc(100vh-52px)] flex-col border-r border-hairline bg-canvas transition-[width] duration-200 ease-out ${
        collapsed ? 'w-[56px]' : 'w-[220px]'
      }`}
    >
      {/* Pinned top: collapse toggle */}
      <div className="px-2 pt-3">
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
      </div>

      {/* Search — full input, or an icon button that expands the rail when collapsed */}
      <div className={collapsed ? 'px-2 pb-3 pt-2' : 'px-4 pb-3 pt-2'}>
        {collapsed ? (
          <button
            onClick={expand}
            title="Search modules"
            aria-label="Search modules"
            className="flex w-full items-center justify-center rounded-md py-2 text-ink-faint transition-colors hover:bg-parchment hover:text-ink-mute"
          >
            <Search className="h-4 w-4" />
          </button>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search modules"
              className="w-full rounded-md border border-hairline bg-canvas py-1.5 pl-9 pr-3 text-[12px] text-ink transition-all placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        )}
      </div>

      {/* Scrollable nav */}
      <nav className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-2 pb-2">
        {filtered.map((group, gi) => (
          <div key={group.label}>
            {collapsed ? (
              gi > 0 && <div className="mx-2 mb-2 border-t border-hairline-cool" />
            ) : (
              <p className="mb-1 flex items-center gap-1.5 px-3 text-[9px] font-black uppercase tracking-[0.12em] text-ink-faint">
                {/* Mastercard eyebrow signal: tiny accent dot before the section label
                    (using our emerald accent, not Mastercard's orange) */}
                <span className="h-1 w-1 flex-shrink-0 rounded-full bg-accent" />
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((def) => (
                <NavItem
                  key={def.id}
                  def={def}
                  active={activePage === def.id}
                  collapsed={collapsed}
                  onSelect={setActivePage}
                />
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && !collapsed && (
          <p className="px-3 text-[12px] italic text-ink-faint">No modules match "{query}"</p>
        )}
      </nav>

      {/* Pinned bottom: secondary items */}
      <div className="space-y-0.5 border-t border-hairline px-2 py-3">
        {bottomItems.map((def) => (
          <NavItem
            key={def.id}
            def={def}
            active={activePage === def.id}
            collapsed={collapsed}
            onSelect={setActivePage}
          />
        ))}
      </div>
    </aside>
  )
}

export default Sidebar
