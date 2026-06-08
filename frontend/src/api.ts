import axios from 'axios'

const API_BASE_URL = window.location.origin === 'http://localhost:5173' ? 'http://localhost:8000/api/v1' : '/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// Add response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.config?.url, error.message)
    return Promise.reject(error)
  }
)

export const getExecutiveOverview = async (currency: string, fy: string) => {
  const response = await api.get('/executive-overview', { params: { currency, fy } })
  return response.data
}

export const getCalendarData = async (month: number, year: number, currency: string, fy: string) => {
  const response = await api.get('/calendar', { params: { month, year, currency, fy } })
  return response.data
}

export const getBankExposure = async (currency: string, fy: string) => {
  const response = await api.get('/bank-exposure', { params: { currency, fy } })
  return response.data
}

export const getSupplierExposure = async (currency: string, fy: string) => {
  const response = await api.get('/supplier-exposure', { params: { currency, fy } })
  return response.data
}

export const getBOEMonitoring = async (currency: string, fy: string) => {
  const response = await api.get('/boe-monitoring', { params: { currency, fy } })
  return response.data
}

export const getCashFlowForecast = async (currency: string, fy: string) => {
  const response = await api.get('/cash-flow-forecast', { params: { currency, fy } })
  return response.data
}

export const getLifecycleTracker = async (fy: string) => {
  const response = await api.get('/lifecycle-tracker', { params: { fy } })
  return response.data
}

export const getRiskAlerts = async (fy: string) => {
  const response = await api.get('/risk-alerts', { params: { fy } })
  return response.data
}

export const getStrategicIntelligence = async (currency: string, fy: string) => {
  const response = await api.get('/strategic-intelligence', { params: { currency, fy } })
  return response.data
}

export const getTreasuryRadar = async (currency: string, fy: string) => {
  const response = await api.get('/treasury-radar', { params: { currency, fy } })
  return response.data
}

export const getAdvancedQuant = async (currency: string, fy: string) => {
  const response = await api.get('/advanced-quant', { params: { currency, fy } })
  return response.data
}

export const getTransactions = async (fy: string) => {
  const response = await api.get('/transactions', { params: { fy } })
  return response.data
}

export const getPETreasury = async () => {
  const response = await api.get('/pe-treasury')
  return response.data
}

export const getDrillDown = async (params: {
  status?: string
  bank?: string
  boe_status?: string
  date?: string
  lifecycle_stage?: string
  kpi?: string
  alert_type?: string
  fy?: string
}) => {
  const response = await api.get('/drill-down', { params })
  return response.data
}

export const askAICopilot = async (query: string) => {
  const response = await api.post('/ai-copilot', { query })
  return response.data
}

// New endpoints
export const getFXExposure = async (fy: string) => {
  const response = await api.get('/fx-exposure', { params: { fy } })
  return response.data
}

export const getTrendAnalysis = async (currency: string, fy: string) => {
  const response = await api.get('/trend-analysis', { params: { currency, fy } })
  return response.data
}

export const getCohortAnalysis = async (currency: string, fy: string) => {
  const response = await api.get('/cohort-analysis', { params: { currency, fy } })
  return response.data
}

export const getBottleneckAnalysis = async (fy: string) => {
  const response = await api.get('/bottleneck-analysis', { params: { fy } })
  return response.data
}

export const getLimitUtilization = async (currency: string, fy: string) => {
  const response = await api.get('/limit-utilization', { params: { currency, fy } })
  return response.data
}

export default api
