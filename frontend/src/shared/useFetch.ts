import { useCallback, useEffect, useState } from 'react'

/** Uniform data-loading contract for every domain view: parallel fetch,
 *  single loading flag, single error state, manual reload. */
export function useFetch<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setData(await fetcher())
    } catch (e: any) {
      setError(e?.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }, deps)

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onRefresh = () => load()
    window.addEventListener('app-refresh', onRefresh)
    return () => window.removeEventListener('app-refresh', onRefresh)
  }, [load])

  return { data, loading, error, reload: load }
}
