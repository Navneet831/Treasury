import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: API_BASE_URL,
})

export const getExecutiveOverview = async (currency: string) => {
  const response = await api.get('/executive-overview', { params: { currency } })
  return response.data
}

export const getCalendarData = async (month: number, year: number, currency: string) => {
  const response = await api.get('/calendar', { params: { month, year, currency } })
  return response.data
}

export const getBankExposure = async (currency: string) => {
  const response = await api.get('/bank-exposure', { params: { currency } })
  return response.data
}

export const getSupplierExposure = async (currency: string) => {
  const response = await api.get('/supplier-exposure', { params: { currency } })
  return response.data
}

export const getBOEMonitoring = async (currency: string) => {
  const response = await api.get('/boe-monitoring', { params: { currency } })
  return response.data
}

export const getCashFlowForecast = async (currency: string) => {
  const response = await api.get('/cash-flow-forecast', { params: { currency } })
  return response.data
}

export const getLifecycleTracker = async () => {
  const response = await api.get('/lifecycle-tracker')
  return response.data
}

export const getRiskAlerts = async () => {
  const response = await api.get('/risk-alerts')
  return response.data
}

export const getTransactions = async () => {
  const response = await api.get('/transactions')
  return response.data
}

export const askAICopilot = async (query: string) => {
  const response = await api.post('/ai-copilot', { query })
  return response.data
}

export default api
