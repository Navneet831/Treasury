import React, { useMemo } from 'react'
import { Search, LogOut } from 'lucide-react'
import { navGroups, bottomItems } from './navConfig'
import { useSidebar } from './useSidebar'
import { supabase, useAuthStore } from '@grew/auth'
import NavItem from './NavItem'
import SidebarToggle from './SidebarToggle'

interface SidebarProps {
  activePage: string
  setActivePage: (page: string) => void
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage }) => {
  const { collapsed, toggle, expand, query, setQuery } = useSidebar()
  const { user, setUser, setAuthenticated } = useAuthStore()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAuthenticated(false)
  }

  const isFeatureEnabled = (id: string) => {
    if (!user || !user.features) return true
    const mapping: Record<string, string> = {
      ai: 'GrewGpt',
      audit: 'audit',
      ledger: 'Ledger',
      dev: 'Dev',
      research: 'agentation'
    }
    const featureKey = mapping[id]
    if (!featureKey) return true
    return user.features[featureKey] !== false
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return navGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => {
          const matchesQuery = !q || i.label.toLowerCase().includes(q)
          const matchesFeature = isFeatureEnabled(i.id)
          return matchesQuery && matchesFeature
        })
      }))
      .filter((g) => g.items.length > 0)
  }, [query, user])

  const visibleBottomItems = useMemo(() => {
    return bottomItems.filter((i) => isFeatureEnabled(i.id))
  }, [user])

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
      <nav className="custom-scrollbar-vertical flex-1 space-y-4 overflow-y-auto px-2 pb-2">
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
        {visibleBottomItems.map((def) => (
          <NavItem
            key={def.id}
            def={def}
            active={activePage === def.id}
            collapsed={collapsed}
            onSelect={setActivePage}
          />
        ))}
      </div>

      {/* Logout */}
      <div className="border-t border-hairline px-2 pb-3 pt-2">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          aria-label="Sign out"
          className={`group flex w-full items-center rounded-md text-[13px] font-medium text-ink-mute transition-colors duration-150 hover:bg-danger-bg hover:text-danger ${
            collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-1.5'
          }`}
        >
          <LogOut className="h-4 w-4 flex-shrink-0 transition-colors group-hover:text-danger" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
