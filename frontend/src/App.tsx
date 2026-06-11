import * as React from 'react';
import { useState, lazy } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import Footer from './components/Footer'
import { DomainSandbox } from './shared/DomainSandbox'
import { Agentation } from 'agentation'

// Lazy load domain modules for true sandboxing
const TransactionList = lazy(() => import('./components/TransactionList'))
const AICopilot       = lazy(() => import('./components/AICopilot'))

const ExecutiveOverview     = lazy(() => import('./domains/executive').then(m => ({ default: m.ExecutiveOverview })))
const StrategicIntelligence = lazy(() => import('./domains/executive').then(m => ({ default: m.StrategicIntelligence })))
const AdvancedQuant         = lazy(() => import('./domains/executive').then(m => ({ default: m.AdvancedQuant })))
const PETreasury            = lazy(() => import('./domains/executive').then(m => ({ default: m.PETreasury })))
const RiskAlerts            = lazy(() => import('./domains/executive').then(m => ({ default: m.RiskAlerts })))

const CalendarView    = lazy(() => import('./domains/calendar').then(m => ({ default: m.CalendarView })))
const FXExposure      = lazy(() => import('./domains/fx').then(m => ({ default: m.FXExposure })))
const HedgeCoverage   = lazy(() => import('./domains/fx').then(m => ({ default: m.HedgeCoverage })))

const BOEMonitoring   = lazy(() => import('./domains/lc').then(m => ({ default: m.BOEMonitoring })))
const LifecycleTracker = lazy(() => import('./domains/lc').then(m => ({ default: m.LifecycleTracker })))
const ShipmentTracking = lazy(() => import('./domains/lc').then(m => ({ default: m.ShipmentTracking })))
const TrendAnalysis    = lazy(() => import('./domains/lc').then(m => ({ default: m.TrendAnalysis })))

const SupplierAnalytics = lazy(() => import('./domains/payables').then(m => ({ default: m.SupplierAnalytics })))
const CashFlowForecast  = lazy(() => import('./domains/payables').then(m => ({ default: m.CashFlowForecast })))

const BankExposure      = lazy(() => import('./domains/utilization').then(m => ({ default: m.BankExposure })))
const LimitUtilization  = lazy(() => import('./domains/utilization').then(m => ({ default: m.LimitUtilization })))

// ── Sub-tab styles ─────────────────────────────────────────────────────────────
const SubTabBar: React.FC<{
  tabs: { id: string; label: string }[]
  active: string
  onChange: (id: string) => void
}> = ({ tabs, active, onChange }) => (
  <div className="bg-white border-b border-[#e2e8f0] px-6 py-2 flex items-center gap-0.5 sticky top-0 z-20">
    <div className="flex items-center gap-0.5 bg-[#f1f5f9] rounded-lg p-0.5">
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
            active === id
              ? 'bg-white text-[#0f172a] shadow-sm'
              : 'text-[#64748b] hover:text-[#0f172a]'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
)

// ── Merged: Strategic Intelligence + Advanced Quant ────────────────────────────
const ResearchView: React.FC = () => {
  const [tab, setTab] = React.useState<'intelligence' | 'quant'>('intelligence')
  return (
    <div className="flex flex-col">
      <SubTabBar
        tabs={[
          { id: 'intelligence', label: 'Strategic View' },
          { id: 'quant',        label: 'Quant Models'   },
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'intelligence' | 'quant')}
      />
      {tab === 'intelligence' ? <StrategicIntelligence /> : <AdvancedQuant />}
    </div>
  )
}

// ── Merged: Shipment Tracking + Supplier Analytics ─────────────────────────────
const TrackView: React.FC = () => {
  const [tab, setTab] = React.useState<'shipment' | 'supplier'>('shipment')
  return (
    <div className="flex flex-col">
      <SubTabBar
        tabs={[
          { id: 'shipment',  label: 'Shipment Tracking'  },
          { id: 'supplier',  label: 'Supplier Analytics' },
        ]}
        active={tab}
        onChange={(id) => setTab(id as 'shipment' | 'supplier')}
      />
      {tab === 'shipment' ? <ShipmentTracking /> : <SupplierAnalytics />}
    </div>
  )
}

// ── App ────────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [activePage, setActivePage] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('view') || 'limit'
  })

  const renderPage = () => {
    switch (activePage) {
      case 'limit':        return <DomainSandbox name="Limit Utilization"><LimitUtilization /></DomainSandbox>
      case 'overview':     return <DomainSandbox name="Executive Overview"><ExecutiveOverview /></DomainSandbox>
      case 'calendar':     return <DomainSandbox name="Calendar"><CalendarView /></DomainSandbox>
      case 'bank':         return <DomainSandbox name="Bank Exposure"><BankExposure /></DomainSandbox>
      case 'boe':          return <DomainSandbox name="BOE Monitoring"><BOEMonitoring /></DomainSandbox>
      case 'lifecycle':    return <DomainSandbox name="Lifecycle Tracker"><LifecycleTracker /></DomainSandbox>
      case 'forecast':     return <DomainSandbox name="Cash Flow Forecast"><CashFlowForecast /></DomainSandbox>
      case 'risk':         return <DomainSandbox name="Risk Alerts"><RiskAlerts /></DomainSandbox>
      case 'transactions': return <DomainSandbox name="Transaction Ledger"><TransactionList /></DomainSandbox>
      case 'ai':           return <DomainSandbox name="AI Copilot"><AICopilot /></DomainSandbox>
      case 'fx':           return <DomainSandbox name="FX Exposure"><FXExposure /></DomainSandbox>
      case 'hedge':        return <DomainSandbox name="Hedge Coverage"><HedgeCoverage /></DomainSandbox>
      case 'trend':        return <DomainSandbox name="Trend Analysis"><TrendAnalysis /></DomainSandbox>
      case 'pe':           return <DomainSandbox name="PE Treasury"><PETreasury /></DomainSandbox>
      // Merged tabs
      case 'research':     return <DomainSandbox name="Intelligence & Models"><ResearchView /></DomainSandbox>
      case 'track':        return <DomainSandbox name="Track & Suppliers"><TrackView /></DomainSandbox>
      default:
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-4 capitalize">{activePage.replace('-', ' ')}</h2>
            <p className="text-muted-foreground italic text-sm">Module coming soon.</p>
          </div>
        )
    }
  }

  const isEmbedded = window.self !== window.top

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-8">
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
