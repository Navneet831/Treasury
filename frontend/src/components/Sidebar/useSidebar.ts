import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'treasury.sidebar.collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Owns sidebar UI state: collapsed (persisted to localStorage) and the search query.
 * Returns a stable `toggle` and an `expand` helper (used when a collapsed-rail action
 * needs the full sidebar back, e.g. clicking the search icon).
 */
export function useSidebar() {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed)
  const [query, setQuery] = useState('')

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore quota / privacy-mode failures */
    }
  }, [collapsed])

  const toggle = useCallback(() => setCollapsed((c) => !c), [])
  const expand = useCallback(() => setCollapsed(false), [])

  return { collapsed, toggle, expand, query, setQuery }
}
