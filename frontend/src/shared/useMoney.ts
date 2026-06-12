import { useCallback } from 'react'
import { useStore } from '../store'
import { formatCurrencyCompact } from '../utils'

/**
 * The one money formatter (DRY): respects the global unit toggle.
 * Pass 'INR' for backend values that are always rupees regardless of the
 * currency toggle (risk models, limits).
 */
export function useMoney(force?: 'INR') {
  const { currency, amountUnit } = useStore()
  const ccy = force || currency
  return useCallback(
    (v: number | null | undefined) => formatCurrencyCompact(v, ccy, amountUnit),
    [ccy, amountUnit],
  )
}
