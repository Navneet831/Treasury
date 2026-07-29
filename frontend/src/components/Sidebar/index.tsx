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
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, mobileOpen = false, onMobileClose }) => {
  const { collapsed, toggle, expand, query, setQuery } = useSidebar()
  const { user, setUser, setAuthenticated } = useAuthStore()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setAuthenticated(false)
  }

  const isFeatureEnabled = (id: string) => {
    if (!user || !user.features) return true
    const mapping: Record<string, string[]> = {
      limit: ['Command Center'],
      calendar: ['calendar', 'Calendar'],
      cashflow: ['cashflow', 'Cashflow', 'Cash Flow'],
      fx: ['fx', 'FX', 'FX & Hedging'],
      interest: ['interest', 'Interest'],
      ops: ['ops', 'Ops', 'Operations'],
      lifecycle: ['lifecycle', 'Lifecycle', 'LC Lifecycle'],
      ai: ['GrewGpt', 'GrewGPT'],
      audit: ['audit', 'Audit'],
      ledger: ['ledger', 'Ledger'],
      dev: ['dev', 'Dev'],
      research: ['agentation', 'Agentation']
    }
    const featureKeys = mapping[id]
    if (!featureKeys) return true
    return featureKeys.some((key) => user.features[key] === true)
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
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`${
          mobileOpen
            ? 'fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-hairline bg-canvas shadow-lift animate-in-slide-left'
            : 'sticky top-[52px] z-40 hidden md:flex h-[calc(100vh-52px)] flex-col border-r border-hairline bg-canvas'
        } transition-[width] duration-200 ease-out ${
          !mobileOpen && collapsed ? 'w-[56px]' : !mobileOpen ? 'w-[220px]' : ''
        }`}
      >
      {/* Mobile close button */}
      {mobileOpen && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <span className="text-[13px] font-bold text-ink">Treasury</span>
          <button
            type="button"
            onClick={onMobileClose}
            className="flex h-9 w-9 items-center justify-center rounded-md text-ink-mute hover:bg-parchment hover:text-ink transition-colors"
            aria-label="Close menu"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      )}

      {/* Pinned top: collapse toggle (desktop only) */}
      <div className="hidden md:block px-2 pt-3">
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
      </div>

      {/* Search — full input, or an icon button that expands the rail when collapsed */}
      <div className={collapsed ? 'px-2 pb-3 pt-2' : 'px-4 pb-3 pt-2'}>
        {collapsed ? (
          <button
            type="button"
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
          type="button"
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
    </>
  )
}

export default Sidebar
