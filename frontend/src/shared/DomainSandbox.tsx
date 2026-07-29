import React, { Component, Suspense } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  name: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.name}:`, error.message, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-rose-50/50 border border-rose-100 rounded-xl gap-4">
          <AlertTriangle className="text-rose-500 w-10 h-10" />
          <div className="text-center">
            <h3 className="text-rose-900 font-bold">{this.props.name} Module Error</h3>
            <p className="text-rose-600 text-sm">Failed to load this section.</p>
            {this.state.error && (
              <p className="text-rose-500 text-[10px] font-mono mt-1 max-w-md truncate">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button 
            type="button"
            onClick={(e) => { e.preventDefault(); this.setState({ hasError: false, error: null }); }}
            className="flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors font-semibold text-sm"
          >
            <RefreshCcw size={16} />
            Retry Module
          </button>
        </div>
      )
    }

    return <>{this.props.children}</>
  }
}

interface DomainSandboxProps {
  children: React.ReactNode
  name: string
  fallback?: React.ReactNode
}

export const DomainSandbox: React.FC<DomainSandboxProps> = ({ children, name, fallback }) => {
  return (
    <ErrorBoundary name={name}>
      <Suspense fallback={fallback || <div className="p-8 text-slate-400 animate-pulse font-medium">Loading {name}...</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}
