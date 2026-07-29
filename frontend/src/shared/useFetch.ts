import { useCallback, useEffect, useRef, useState } from 'react'

// ── SWR cache ──────────────────────────────────────────────────────────────────
// In-memory cache keyed by a deterministic hash of the fetcher + deps.
// Stale-while-revalidate: returns cached data immediately, refreshes in background.

interface CacheEntry<T> {
  data: T
  updatedAt: number
}

const cache = new Map<string, CacheEntry<any>>()
const TTL_MS = 60_000 // 60 seconds — warehouse is a daily Excel load, so stale is safe

function cacheKey(fn: Function, deps: unknown[]): string {
  // Derive a key from the function's source and the serialized deps
  const src = fn.toString().replace(/\s+/g, ' ').slice(0, 200)
  return `${src}|${JSON.stringify(deps)}`
}

// ── useFetch with SWR + AbortController ────────────────────────────────────────

export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Track the latest request so stale resolutions are discarded
  const latestRef = useRef<symbol | null>(null)
  // Cache key for this specific fetcher+deps combo
  const key = cacheKey(fetcher, deps)

  const load = useCallback(async () => {
    const token = Symbol()
    latestRef.current = token

    // 1. Check cache for fresh entry
    const cached = cache.get(key) as CacheEntry<T> | undefined
    if (cached && Date.now() - cached.updatedAt < TTL_MS) {
      setData(cached.data)
      setLoading(false)
      setError(null)
      // Revalidate in background (skip if token changed)
      try {
        const fresh = await fetcher()
        if (latestRef.current !== token) return // aborted by newer call
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
      const result = await fetcher()
      if (latestRef.current !== token) return // stale — discard
      cache.set(key, { data: result, updatedAt: Date.now() })
      setData(result)
    } catch (e: any) {
      if (latestRef.current !== token) return // stale — discard
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
  }, [fetcher, key])

  useEffect(() => { load() }, [load])

  // Listen for app-refresh events (manual triggers)
  useEffect(() => {
    const onRefresh = () => {
      // Force clear cache for this key on explicit refresh
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
