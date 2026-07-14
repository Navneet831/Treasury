import * as React from 'react';
import { useState, lazy, useEffect } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
import { DomainSandbox } from './shared/DomainSandbox'
import { Agentation } from 'agentation'
import { supabase, verifyWhitelistAndSetUser, useAuthStore, Login } from '@grew/auth'
import { AuditProvider } from './shared/AuditContext'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

// Lazy load domain modules for true sandboxing
const AICopilot = lazy(() => import('./components/AICopilot'))
const AuditView = lazy(() => import('./components/AuditView'))

const IntelligenceView = lazy(() => import('./domains/executive/IntelligenceView'))

const CalendarView     = lazy(() => import('./domains/calendar').then(m => ({ default: m.CalendarView })))
const CashFlowView     = lazy(() => import('./domains/cashflow').then(m => ({ default: m.CashFlowView })))
const FXView           = lazy(() => import('./domains/fx').then(m => ({ default: m.FXView })))
const OperationsView   = lazy(() => import('./domains/ops').then(m => ({ default: m.OperationsView })))
const LifecycleTracker = lazy(() => import('./domains/lc').then(m => ({ default: m.LifecycleTracker })))
const LimitUtilization = lazy(() => import('./domains/utilization').then(m => ({ default: m.LimitUtilization })))
const TransactionLedger = lazy(() => import('./domains/ledger').then(m => ({ default: m.TransactionLedger })))
const DevView = lazy(() => import('./domains/dev/DevView').then(m => ({ default: m.DevView })))

// Legacy view ids (old shell links, bookmarks) → consolidated tabs
const LEGACY_ALIASES: Record<string, string> = {
  forecast: 'cashflow',
  trend: 'cashflow',
  hedge: 'fx',
  boe: 'ops',
  track: 'ops',
  risk: 'limit',
  bank: 'limit',
  pe: 'research',
  limits: 'limit',
  transactions: 'audit',
}

const BootSpinner: React.FC = () => (
  <div className="h-screen w-full bg-[#05070A] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-[3px] border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest animate-pulse">
        Verifying Access…
      </p>
    </div>
  </div>
)

// ── App ────────────────────────────────────────────────────────────────────────
// `embedded` is passed by the platform shell (which provides its own chrome);
// standalone dev renders Header/Sidebar/Footer. Never detect embedding via
// iframe checks — sub-apps are compiled into the shell bundle, not iframed.
const App: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const [activePage, setActivePage] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const view = params.get('view') || 'limit'
    return LEGACY_ALIASES[view] || view
  })

  // ── Auth ────────────────────────────────────────────────────────────────────
  const {
    isAuthenticated,
    isBootstrapping,
    setBootstrapping,
    user,
    setUser,
    setAuthenticated,
  } = useAuthStore()

  useEffect(() => {
    if (embedded) {
      // Shell has already verified the session — skip Treasury's own gate
      setBootstrapping(false)
      return
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (event === 'SIGNED_IN' && session) {
          await verifyWhitelistAndSetUser(session)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setAuthenticated(false)
        }
      }
    )

    const boot = async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const code = searchParams.get('code')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (error) {
        const msg = `Authentication error: ${errorDescription || error}`
        console.error(msg)
        useAuthStore.getState().setAuthError(msg)
        window.history.replaceState({}, document.title, '/')
        setBootstrapping(false)
        return
      }

      let currentSession: Session | null = null

      if (code) {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          currentSession = data.session
        } catch (err) {
          console.error('Error exchanging PKCE code for session:', err)
        }
      }

      if (!currentSession) {
        const { data: { session } } = await supabase.auth.getSession()
        currentSession = session
      }

      if (currentSession) {
        await verifyWhitelistAndSetUser(currentSession, { skipDelay: true })
      }
      setBootstrapping(false)
    }

    boot()
    return () => authListener.subscription.unsubscribe()
  }, [embedded, setBootstrapping, setUser, setAuthenticated])
  useEffect(() => {
    if (isAuthenticated && window.location.pathname === '/auth/callback') {
      window.history.replaceState({}, document.title, '/')
    }
  }, [isAuthenticated])

  // ────────────────────────────────────────────────────────────────────────────

  const isFeatureEnabled = (id: string) => {
    if (embedded) return true // skip check in embedded shell mode
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

  const renderPage = () => {
    if (!isFeatureEnabled(activePage)) {
      return (
        <div className="p-8">
          <h2 className="text-xl font-semibold mb-2 capitalize text-rose-600">Access Denied</h2>
          <p className="text-[#707070] text-sm">You do not have permission to access the {activePage.replace('-', ' ')} module.</p>
        </div>
      )
    }

    switch (activePage) {
      case 'limit':        return <DomainSandbox name="Command Center"><LimitUtilization /></DomainSandbox>
      case 'calendar':     return <DomainSandbox name="Calendar"><CalendarView /></DomainSandbox>
      case 'cashflow':     return <DomainSandbox name="Cash Flow"><CashFlowView /></DomainSandbox>
      case 'fx':           return <DomainSandbox name="FX & Hedging"><FXView /></DomainSandbox>
      case 'ops':          return <DomainSandbox name="Operations"><OperationsView /></DomainSandbox>
      case 'lifecycle':    return <DomainSandbox name="LC Lifecycle"><LifecycleTracker /></DomainSandbox>
      case 'research':     return <DomainSandbox name="Intelligence"><IntelligenceView /></DomainSandbox>
      case 'audit':        return <DomainSandbox name="Audit"><AuditView /></DomainSandbox>
      case 'ai':           return <DomainSandbox name="GrewGpt"><AICopilot /></DomainSandbox>
      case 'ledger':       return <DomainSandbox name="Transaction Ledger"><TransactionLedger /></DomainSandbox>
      case 'dev':          return <DomainSandbox name="Developer Options"><DevView /></DomainSandbox>
      default:
        return (
          <div className="p-8">
            <h2 className="text-xl font-semibold mb-2 capitalize">{activePage.replace('-', ' ')}</h2>
            <p className="text-[#707070] text-sm">This view has been consolidated — pick a module from the sidebar.</p>
          </div>
        )
    }
  }

  // Auth gate (standalone mode only)
  if (!embedded) {
    if (isBootstrapping) return <BootSpinner />
    if (!isAuthenticated) return <Login skipIntro />
  }

  const isEmbedded = embedded

  return (
    <AuditProvider>
      <div className="min-h-screen bg-[#fafafa] pb-8">
        {!isEmbedded && <Header />}
        <div className="flex">
          {!isEmbedded && <Sidebar activePage={activePage} setActivePage={setActivePage} />}
          <main className="flex-1 overflow-x-auto">
            {renderPage()}
          </main>
        </div>
        {!embedded && <Agentation />}
        {!isEmbedded && <Footer />}
      </div>
    </AuditProvider>
  )
}

export default App
