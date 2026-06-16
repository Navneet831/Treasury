import * as React from 'react';
import { useState, lazy } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
import { DomainSandbox } from './shared/DomainSandbox'
import { Agentation } from 'agentation'

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

  const renderPage = () => {
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
      default:
        return (
          <div className="p-8">
            <h2 className="text-xl font-semibold mb-2 capitalize">{activePage.replace('-', ' ')}</h2>
            <p className="text-[#707070] text-sm">This view has been consolidated — pick a module from the sidebar.</p>
          </div>
        )
    }
  }

  const isEmbedded = embedded

  return (
    <div className="min-h-screen bg-[#fafafa] pb-8">
      {!isEmbedded && <Header />}
      <div className="flex">
        {!isEmbedded && <Sidebar activePage={activePage} setActivePage={setActivePage} />}
        <main className="flex-1 overflow-x-auto">
          {renderPage()}
        </main>
      </div>
      <Agentation />
      {!isEmbedded && <Footer />}
    </div>
  )
}

export default App
