import axios from 'axios'

// Single URL in every mode: same-origin /api. Standalone dev tunnels
// /api to the backend via the Vite proxy (see vite.config.ts); in the platform
// shell it's the /api/treasury module gateway.
const STANDALONE_DEV_PORTS = ['8000', '8001'];
const isStandaloneDev = STANDALONE_DEV_PORTS.includes(window.location.port) ||
  window.location.port === (import.meta.env.VITE_FRONTEND_PORT || '8001');
const API_BASE_URL = isStandaloneDev ? '/api' : '/api/treasury';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  // Trust ETags: if server returns 304, axios won't override our cached data
  validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
})

// ── Correlation ID ──────────────────────────────────────────────────────────────
// Generate a session-level correlation ID so all requests from this page load
// share a common trace. The backend will propagate this as X-Correlation-ID.
const SESSION_ID = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

api.interceptors.request.use((config) => {
  if (config.headers) {
    config.headers['X-Correlation-ID'] = SESSION_ID;
  }
  return config;
});

// ── ETag Cache ─────────────────────────────────────────────────────────────────
// Stores {data, etag} keyed by URL+params. On subsequent requests sends
// If-None-Match; server responds 304 Not Modified when data hasn't changed.
// This saves full serialization + network transfer even when Redis cache expires.
const etagCache = new Map<string, { data: any; etag: string }>()

function cacheKey(method: string = 'get', url: string = '', params: any = {}): string {
  return `${method}:${url}:${JSON.stringify(params || {})}`
}

// ── Request deduplication ──────────────────────────────────────────────────────
// First request stores a deferred in `inflight`. Duplicates override the per-request
// adapter to return the first response (adapted with the duplicate's config).
// This avoids two pitfalls of returning a bare promise from the request interceptor:
//   1. dispatchRequest receives a response object as `config` and crashes on
//      `config.method.toUpperCase()` (Axios 1.x adapter check).
//   2. The duplicate's response interceptors get a stale `response.config` from the
//      first request, breaking timing & ETag handlers.
interface Deferred {
  resolve: (value: any) => void
  reject: (reason: any) => void
  promise: Promise<any>
}
const inflight = new Map<string, Deferred>()

api.interceptors.request.use((config) => {
  // Performance timing: tag every request with start time
  ;(config as any)._startTime = performance.now()
  return config
})

api.interceptors.request.use((config) => {
  // Add ETag If-None-Match header if we have a cached ETag for this request
  const key = cacheKey(config.method, config.url, config.params)
  const cached = etagCache.get(key)
  if (cached && config.headers) {
    config.headers['If-None-Match'] = cached.etag
  }
  return config
})

api.interceptors.request.use((config) => {
  const key = cacheKey(config.method, config.url, config.params)
  const existing = inflight.get(key)

  if (!existing) {
    // ── First request ──────────────────────────────────────────────────────
    let resolve!: (v: any) => void
    let reject!: (e: any) => void
    const promise = new Promise<any>((res, rej) => { resolve = res; reject = rej })
    inflight.set(key, { resolve, reject, promise })
    return config
  }

  // ── Duplicate — short-circuit via adapter override ───────────────────────
  // dispatchRequest will call this function instead of making an HTTP call.
  config.adapter = async (cfg: any) => {
    const orig = await existing.promise
    return {
      data: orig.data,
      status: orig.status,
      statusText: orig.statusText,
      headers: orig.headers,
      config: cfg,          // Use the duplicate's config (fresh _startTime, etc.)
      request: orig.request,
    }
  }
  return config
})

// Response interceptor: fulfill the deferred so the duplicate's adapter can wait.
api.interceptors.response.use(
  (response) => {
    const key = cacheKey(response.config.method, response.config.url, response.config.params)
    const d = inflight.get(key)
    if (d) { d.resolve(response); inflight.delete(key) }
    return response
  },
  (error) => {
    const key = cacheKey(error.config?.method, error.config?.url, error.config?.params)
    const d = inflight.get(key)
    if (d) { d.reject(error); inflight.delete(key) }
    return Promise.reject(error)
  }
)

// ── API Timing, ETag & Error interceptor ───────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    const cfg = response.config
    const key = cacheKey(cfg.method, cfg.url, cfg.params)

    // Handle 304 Not Modified — return cached data with zero network transfer
    if (response.status === 304) {
      const cached = etagCache.get(key)
      if (cached) {
        console.log(`[API 304] ${cfg.method?.toUpperCase()} ${cfg.url} — cached (${cached.etag.slice(0, 12)}…)`)
        return Promise.resolve({ ...response, data: cached.data, _fromEtag: true })
      }
    }

    // Store ETag from 200 response
    const etag = response.headers['etag'] as string | undefined
    if (etag && response.status === 200) {
      etagCache.set(key, { data: response.data, etag })
    }

    // Log timing
    const start = (cfg as any)._startTime as number | undefined
    if (start) {
      const duration = performance.now() - start
      const url = cfg.url || 'unknown'
      const tag = response.status === 304 ? '304' : response.status.toString()
      console.log(`[API ${tag}] ${cfg.method?.toUpperCase()} ${url} — ${duration.toFixed(0)}ms`)
      performance.mark(`api-${cfg.method}-${url}-end`)
      performance.measure(`API ${url}`, `api-${cfg.method}-${url}-end`)
    }
    return response
  },
  (error) => {
    const start = (error.config?._startTime) as number | undefined
    if (start) {
      const duration = performance.now() - start
      console.error(`[API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} — ${duration.toFixed(0)}ms — ${error.message}`)
    } else {
      console.error('[API Error]', error.config?.url, error.message)
    }
    return Promise.reject(error)
  }
)

// ─── Core Domain Endpoints ────────────────────────────────────────────────────

export const getExecutiveOverview = async (currency: string, fy: string) => {
  const { data } = await api.get('/executive-overview', { params: { currency, fy } })
  return data
}

export const getCommandData = async (currency: string, fy: string, paymentStatus: string = 'Unpaid', facilityType: string = 'LC', lcStatus: string = 'Open') => {
  const { data } = await api.get('/command-data', { params: { currency, fy, payment_status: paymentStatus, facility_type: facilityType, lc_status: lcStatus } })
  return data
}

export const getLimitUtilisation = async (currency: string, fy: string, paymentStatus: string = 'Unpaid', facilityType: string = 'LC', lcStatus: string = 'Open') => {
  const { data } = await api.get('/limit-utilisation', { params: { currency, fy, payment_status: paymentStatus, facility_type: facilityType, lc_status: lcStatus } })
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

export const getTablesList = async (): Promise<string[]> => {
  const { data } = await api.get('/tables')
  return data
}

export const getTableData = async (tableName: string, page: number = 0, pageSize: number = 0): Promise<any[]> => {
  const { data } = await api.get(`/tables/${encodeURIComponent(tableName)}`, { params: { page, page_size: pageSize } })
  return data
}

/** Clear the ETag cache — forces fresh 200 responses on next load */
export function clearEtagCache() { etagCache.clear() }

export default api
