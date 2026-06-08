import React, { useState } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import TreasuryCommand from './components/TreasuryCommand'
import ExecutiveOverview from './components/ExecutiveOverview'
import CalendarView from './components/CalendarView'
import BankExposure from './components/BankExposure'
import SupplierAnalytics from './components/SupplierAnalytics'
import BOEMonitoring from './components/BOEMonitoring'
import CashFlowForecast from './components/CashFlowForecast'
import LifecycleTracker from './components/LifecycleTracker'
import RiskAlerts from './components/RiskAlerts'
import TransactionList from './components/TransactionList'
import AICopilot from './components/AICopilot'
import StrategicIntelligence from './components/StrategicIntelligence'
import ShipmentTracking from './components/ShipmentTracking'
import AdvancedQuant from './components/AdvancedQuant'
import PETreasury from './components/PETreasury'
import FXExposure from './components/FXExposure'
import TrendAnalysis from './components/TrendAnalysis'
import LimitUtilization from './components/LimitUtilization'

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: string }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Page error:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 flex flex-col items-center justify-center h-64 text-center gap-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <div>
            <h3 className="font-bold text-lg text-red-800">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">{this.state.error}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-bold text-sm hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const App: React.FC = () => {
  const [activePage, setActivePage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('view') || 'command';
  });

  const renderPage = () => {
    switch (activePage) {
      case 'command': return <TreasuryCommand />
      case 'overview': return <ExecutiveOverview />
      case 'calendar': return <CalendarView />
      case 'bank': return <BankExposure />
      case 'supplier': return <SupplierAnalytics />
      case 'boe': return <BOEMonitoring />
      case 'lifecycle': return <LifecycleTracker />
      case 'forecast': return <CashFlowForecast />
      case 'risk': return <RiskAlerts />
      case 'transactions': return <TransactionList />
      case 'intelligence': return <StrategicIntelligence />
      case 'quant': return <AdvancedQuant />
      case 'pe': return <PETreasury />
      case 'shipment': return <ShipmentTracking />
      case 'ai': return <AICopilot />
      case 'fx': return <FXExposure />
      case 'trend': return <TrendAnalysis />
      case 'limit': return <LimitUtilization />
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
    <div className="min-h-screen bg-[#F8FAFC]">
      {!isEmbedded && <Header />}
      <div className="flex">
        {!isEmbedded && <Sidebar activePage={activePage} setActivePage={setActivePage} />}
        <main className="flex-1 overflow-x-hidden">
          <ErrorBoundary key={activePage}>
            {renderPage()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

export default App
