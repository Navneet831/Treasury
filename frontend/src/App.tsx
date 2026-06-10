import * as React from 'react';
import { useState, lazy } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import { DomainSandbox } from './shared/DomainSandbox'
import { Agentation } from 'agentation'

// Lazy load domain modules for true sandboxing
const TreasuryCommand = lazy(() => import('./components/TreasuryCommand'))
const TransactionList = lazy(() => import('./components/TransactionList'))
const AICopilot = lazy(() => import('./components/AICopilot'))

// Domain components
const ExecutiveOverview = lazy(() => import('./domains/executive').then(m => ({ default: m.ExecutiveOverview })))
const StrategicIntelligence = lazy(() => import('./domains/executive').then(m => ({ default: m.StrategicIntelligence })))
const AdvancedQuant = lazy(() => import('./domains/executive').then(m => ({ default: m.AdvancedQuant })))
const PETreasury = lazy(() => import('./domains/executive').then(m => ({ default: m.PETreasury })))
const RiskAlerts = lazy(() => import('./domains/executive').then(m => ({ default: m.RiskAlerts })))

const CalendarView   = lazy(() => import('./domains/calendar').then(m => ({ default: m.CalendarView })))
const FXExposure     = lazy(() => import('./domains/fx').then(m => ({ default: m.FXExposure })))
const HedgeCoverage  = lazy(() => import('./domains/fx').then(m => ({ default: m.HedgeCoverage })))

const BOEMonitoring = lazy(() => import('./domains/lc').then(m => ({ default: m.BOEMonitoring })))
const LifecycleTracker = lazy(() => import('./domains/lc').then(m => ({ default: m.LifecycleTracker })))
const ShipmentTracking = lazy(() => import('./domains/lc').then(m => ({ default: m.ShipmentTracking })))
const TrendAnalysis = lazy(() => import('./domains/lc').then(m => ({ default: m.TrendAnalysis })))

const SupplierAnalytics = lazy(() => import('./domains/payables').then(m => ({ default: m.SupplierAnalytics })))
const CashFlowForecast = lazy(() => import('./domains/payables').then(m => ({ default: m.CashFlowForecast })))

const BankExposure = lazy(() => import('./domains/utilization').then(m => ({ default: m.BankExposure })))
const LimitUtilization = lazy(() => import('./domains/utilization').then(m => ({ default: m.LimitUtilization })))

const App: React.FC = () => {
  const [activePage, setActivePage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'limit';
  });

  const renderPage = () => {
    switch (activePage) {
      case 'limit': return <DomainSandbox name="Limit Utilization"><LimitUtilization /></DomainSandbox>
      case 'overview': return <DomainSandbox name="Executive Overview"><ExecutiveOverview /></DomainSandbox>
      case 'calendar': return <DomainSandbox name="Calendar"><CalendarView /></DomainSandbox>
      case 'bank': return <DomainSandbox name="Bank Exposure"><BankExposure /></DomainSandbox>
      case 'supplier': return <DomainSandbox name="Supplier Analytics"><SupplierAnalytics /></DomainSandbox>
      case 'boe': return <DomainSandbox name="BOE Monitoring"><BOEMonitoring /></DomainSandbox>
      case 'lifecycle': return <DomainSandbox name="Lifecycle Tracker"><LifecycleTracker /></DomainSandbox>
      case 'forecast': return <DomainSandbox name="Cash Flow Forecast"><CashFlowForecast /></DomainSandbox>
      case 'risk': return <DomainSandbox name="Risk Alerts"><RiskAlerts /></DomainSandbox>
      case 'transactions': return <DomainSandbox name="Transaction List"><TransactionList /></DomainSandbox>
      case 'intelligence': return <DomainSandbox name="Strategic Intelligence"><StrategicIntelligence /></DomainSandbox>
      case 'quant': return <DomainSandbox name="Advanced Quant"><AdvancedQuant /></DomainSandbox>
      case 'pe': return <DomainSandbox name="PE Treasury"><PETreasury /></DomainSandbox>
      case 'shipment': return <DomainSandbox name="Shipment Tracking"><ShipmentTracking /></DomainSandbox>
      case 'ai': return <DomainSandbox name="AI Copilot"><AICopilot /></DomainSandbox>
      case 'fx':    return <DomainSandbox name="FX Exposure"><FXExposure /></DomainSandbox>
      case 'hedge': return <DomainSandbox name="Hedge Coverage"><HedgeCoverage /></DomainSandbox>
      case 'trend': return <DomainSandbox name="Trend Analysis"><TrendAnalysis /></DomainSandbox>
      default:
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-4 capitalize">{activePage.replace('-', ' ')}</h2>
            <p className="text-muted-foreground italic text-sm">Module coming soon.</p>
          </div>
        )
    }
  }

  const isEmbedded = window.self !== window.top;

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {!isEmbedded && <Header />}
      <div className="flex">
        {!isEmbedded && <Sidebar activePage={activePage} setActivePage={setActivePage} />}
        <main className="flex-1 overflow-x-hidden">
          {renderPage()}
        </main>
      </div>
      <Agentation />
    </div>
  )
}

export default App
