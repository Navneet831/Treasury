import React, { useState } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
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

const App: React.FC = () => {
  const [activePage, setActivePage] = useState('overview')

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return <ExecutiveOverview />
      case 'calendar':
        return <CalendarView />
      case 'bank':
        return <BankExposure />
      case 'supplier':
        return <SupplierAnalytics />
      case 'boe':
        return <BOEMonitoring />
      case 'lifecycle':
        return <LifecycleTracker />
      case 'forecast':
        return <CashFlowForecast />
      case 'risk':
        return <RiskAlerts />
      case 'transactions':
        return <TransactionList />
      case 'ai':
        return <AICopilot />
      default:
        return (
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-4 capitalize">{activePage.replace('-', ' ')}</h2>
            <p className="text-muted-foreground italic text-sm">Module coming soon in the next development cycle.</p>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header />
      <div className="flex">
        <Sidebar activePage={activePage} setActivePage={setActivePage} />
        <main className="flex-1 overflow-x-hidden">
          {renderPage()}
        </main>
      </div>
    </div>
  )
}

export default App
