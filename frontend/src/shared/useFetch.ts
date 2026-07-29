import { useCallback, useEffect, useRef, useState } from 'react'

// ── SWR cache ──────────────────────────────────────────────────────────────────
// In-memory cache keyed by a deterministic hash of the serialized deps.
// Stale-while-revalidate: returns cached data immediately, refreshes in background.

interface CacheEntry<T> {
  data: T
  updatedAt: number
}

const cache = new Map<string, CacheEntry<any>>()
const TTL_MS = 120_000 // 2 minutes — warehouse is a daily Excel load

function depsKey(deps: unknown[]): string {
  // Key is derived ONLY from deps — not the function body — so that arrow
  // functions recreated on every render don't bust the cache.
  return JSON.stringify(deps)
}

// ── useFetch with SWR + stable fetcher ref ──────────────────────────────────────

export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track the latest request so stale resolutions are discarded
  const latestRef = useRef<symbol | null>(null)

  // Keep a stable ref to the latest fetcher so the load callback never
  // needs to list `fetcher` as a dependency (avoids infinite loops when the
  // caller passes an inline arrow function).
  const fetcherRef = useRef(fetcher)
  useEffect(() => { fetcherRef.current = fetcher })

  // Cache key derived from deps only
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const key = depsKey(deps)

  const load = useCallback(async () => {
    const token = Symbol()
    latestRef.current = token

    // 1. Check cache for fresh entry — show immediately while revalidating
    const cached = cache.get(key) as CacheEntry<T> | undefined
    if (cached && Date.now() - cached.updatedAt < TTL_MS) {
      setData(cached.data)
      setLoading(false)
      setError(null)
      // Background revalidation
      try {
        const fresh = await fetcherRef.current()
        if (latestRef.current !== token) return
        cache.set(key, { data: fresh, updatedAt: Date.now() })
        setData(fresh)
      } catch {
        // Stale data is still shown — swallow background error
      }
      return
    }

    // 2. Fresh fetch
    try {
      setLoading(true)
      setError(null)
      const result = await fetcherRef.current()
      if (latestRef.current !== token) return
      cache.set(key, { data: result, updatedAt: Date.now() })
      setData(result)
    } catch (e: any) {
      if (latestRef.current !== token) return
      // Network cancelled errors (AbortError / CanceledError) — silently ignore
      if (e?.name === 'CanceledError' || e?.name === 'AbortError' || e?.code === 'ERR_CANCELED') {
        return
      }
      // Fall back to stale cache if available
      const stale = cache.get(key) as CacheEntry<T> | undefined
      if (stale) {
        setData(stale.data)
        setError('Showing cached data — refresh failed: ' + (e?.message || 'Request failed'))
      } else {
        setError(e?.message || 'Request failed')
      }
    } finally {
      if (latestRef.current === token) {
        setLoading(false)
      }
    }
  }, [key]) // key (not fetcher) is the only dep — fetcher is read through fetcherRef

  useEffect(() => { load() }, [load])

  // Listen for app-refresh events (manual triggers)
  useEffect(() => {
    const onRefresh = () => {
      cache.delete(key)
      load()
    }
    window.addEventListener('app-refresh', onRefresh)
    return () => window.removeEventListener('app-refresh', onRefresh)
  }, [load, key])

  return { data, loading, error, reload: load }
}

// ── Dev helper: clear entire SWR cache ─────────────────────────────────────────
export function clearSWRCache() { cache.clear() }
