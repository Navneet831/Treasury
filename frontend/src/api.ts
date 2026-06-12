import axios from 'axios'

// Embedded in the platform shell (any origin) → same-origin gateway /api/treasury.
// Standalone dev is the explicit exception: the Treasury UI dev server runs on
// :5175 (strictPort) against its own backend on :8001 (routes mounted at root).
const isStandaloneDev = window.location.port === '5175';
const API_BASE_URL = isStandaloneDev ? 'http://127.0.0.1:8001' : '/api/treasury';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.config?.url, error.message)
    return Promise.reject(error)
  }
)

// ─── Core Domain Endpoints ────────────────────────────────────────────────────

export const getExecutiveOverview = async (currency: string, fy: string) => {
  const { data } = await api.get('/executive-overview', { params: { currency, fy } })
  return data
}

export const getCommandData = async (currency: string, fy: string, paymentStatus: string = 'Unpaid', facilityType: string = 'LC') => {
  const { data } = await api.get('/command-data', { params: { currency, fy, payment_status: paymentStatus, facility_type: facilityType } })
  return data
}

export const getLimitUtilisation = async (currency: string, fy: string, paymentStatus: string = 'Unpaid', facilityType: string = 'LC') => {
  const { data } = await api.get('/limit-utilisation', { params: { currency, fy, payment_status: paymentStatus, facility_type: facilityType } })
  return data
}

export const getLCExposure = async (currency: string, fy: string) => {
  const { data } = await api.get('/lc-exposure', { params: { currency, fy } })
  return data
}


export const getSBLCModule = async (currency: string, fy: string) => {
  const { data } = await api.get('/sblc-module', { params: { currency, fy } })
  return data
}

export const getBOEAnalytics = async (currency: string, fy: string) => {
  const { data } = await api.get('/boe-analytics', { params: { currency, fy } })
  return data
}

export const getPayablesRisk = async (currency: string, fy: string) => {
  const { data } = await api.get('/payables-risk', { params: { currency, fy } })
  return data
}

export const getFXRisk = async (fy: string) => {
  const { data } = await api.get('/fx-risk', { params: { fy } })
  return data
}

// calendar: fy scopes which LCs to include; bank & payment_status are optional server-side filters
export const getCalendarData = async (month: number, year: number, currency: string, fy: string, bank?: string, status?: string, paymentStatus?: string) => {
  const { data } = await api.get('/calendar', { params: { month, year, currency, fy, bank, status, payment_status: paymentStatus || undefined } })
  return data
}

export const getDailyReco = async (date: string) => {
  const { data } = await api.get('/daily-reco', { params: { date } })
  return data
}

export const getFDModule = async () => {
  const { data } = await api.get('/fd-module')
  return data
}

export const getBGModule = async () => {
  const { data } = await api.get('/bg-module')
  return data
}


export const getTreasuryActions = async () => {
  const { data } = await api.get('/treasury-actions')
  return data
}

export const getTrendCohort = async (currency: string) => {
  const { data } = await api.get('/trend-cohort', { params: { currency } })
  return data
}

// ─── New Dedicated Endpoints ──────────────────────────────────────────────────

/** Returns distinct bank names from LC table — never hardcoded */
export const getBanksList = async (): Promise<string[]> => {
  const { data } = await api.get('/banks')
  return data
}

/** Returns distinct Payment Status values from LC table — never hardcoded */
export const getPaymentStatuses = async (): Promise<string[]> => {
  const { data } = await api.get('/payment-statuses')
  return data
}

/** Hedge coverage: per-product unpaid bills split by Hedged (CAPEX) vs Unhedged */
export const getHedgeCoverage = async (currency: string, fy: string) => {
  const { data } = await api.get('/hedge-coverage', { params: { currency, fy } })
  return data
}

/** Cash flow forecast with 95% CI bands, using BOE Bill Amt as payment basis */
export const getCashFlowForecast = async (currency: string, fy: string) => {
  const { data } = await api.get('/cash-flow-forecast', { params: { currency, fy } })
  return data
}

/** Monthly LC opening/closure trend + monthly due payment trend */
export const getTrendAnalysis = async (currency: string, fy: string) => {
  const { data } = await api.get('/trend-analysis', { params: { currency, fy } })
  return data
}

/** LC cohort analysis grouped by opening month */
export const getCohortAnalysis = async (currency: string, fy: string) => {
  const { data } = await api.get('/cohort-analysis', { params: { currency, fy } })
  return data
}

// ─── Shared / Utility Endpoints ───────────────────────────────────────────────

export const getLifecycleTracker = async (fy: string) => {
  const { data } = await api.get('/lifecycle-tracker', { params: { fy } })
  return data
}
export const getStrategicIntelligence = async (currency: string, fy: string) => {
  const { data } = await api.get('/strategic-intelligence', { params: { currency, fy } })
  return data
}
export const getTreasuryRadar = async (currency: string, fy: string) => {
  const { data } = await api.get('/treasury-radar', { params: { currency, fy } })
  return data
}
export const getAdvancedQuant = async (currency: string, fy: string) => {
  const { data } = await api.get('/advanced-quant', { params: { currency, fy } })
  return data
}
/** Computed McKinsey-style insights for a page: command | overview | cashflow | fx | operations */
export const getInsights = async (page: string, currency: string, fy: string) => {
  const { data } = await api.get('/insights', { params: { page, currency, fy } })
  return data
}

/** Fiscal years present in the warehouse — drives the FY selector, never hardcoded */
export const getFYList = async (): Promise<string[]> => {
  const { data } = await api.get('/fy-list')
  return data
}

/** Methodology register: formulas, sources, live config and row counts for the Audit tab */
export const getAuditCatalog = async () => {
  const { data } = await api.get('/audit-catalog')
  return data
}

export const getUSDINRRate = async () => {
  const { data } = await api.get('/usd-inr')
  return data
}

export const getMarketRates = async () => {
  const { data } = await api.get('/market-rates')
  return data
}

export const getShipmentTracking = async (fy: string) => {
  const { data } = await api.get('/shipment-tracking', { params: { fy } })
  return data
}
export const getDrillDown = async (params: any) => {
  const { data } = await api.get('/drill-down', { params })
  return data
}
export const askAICopilot = async (query: string) => {
  const { data } = await api.post('/ai-copilot', { query })
  return data
}

export default api
