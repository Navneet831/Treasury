import React from 'react'
import { useStore } from '../store'
import { Coins } from 'lucide-react'

const Header: React.FC = () => {
  const { currency, setCurrency } = useStore()

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-2">
        <Coins className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold">LC Analytics Command Center</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex bg-muted p-1 rounded-md">
          <button
            onClick={() => setCurrency('INR')}
            className={`px-3 py-1 text-sm font-medium rounded-sm transition-all ${
              currency === 'INR' ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            INR
          </button>
          <button
            onClick={() => setCurrency('FC')}
            className={`px-3 py-1 text-sm font-medium rounded-sm transition-all ${
              currency === 'FC' ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            USD/FC
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header
