import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
})

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

export const getTransactions = async (fy: string) => {
  const response = await api.get('/transactions', { params: { fy } })
  return response.data
}

export const getDrillDown = async (params: { 
  status?: string, 
  bank?: string, 
  boe_status?: string, 
  date?: string,
  lifecycle_stage?: string,
  kpi?: string,
  alert_type?: string,
  fy?: string
}) => {
  const response = await api.get('/drill-down', { params })
  return response.data
}

export const askAICopilot = async (query: string) => {
  const response = await api.post('/ai-copilot', { query })
  return response.data
}

export default api
