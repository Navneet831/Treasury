export const formatCurrencyAbsolute = (value: number | null | undefined, currency: string): string => {
  if (value === null || value === undefined || isNaN(value)) return '—'
  
  const currencyCode = currency === 'INR' ? 'INR' : 'USD'
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value)
}

export const formatCurrency = (value: number | null | undefined, currency: string): string => {
  if (value === null || value === undefined || isNaN(value)) return '—'
  
  // Map FC to USD for display; actual currency-specific display would need the actual currency code
  const currencyCode = currency === 'INR' ? 'INR' : 'USD'
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value)
}

export const formatCurrencyCompact = (value: number | null | undefined, currency: string): string => {
  if (value === null || value === undefined || isNaN(value)) return '—'
  const abs = Math.abs(value)
  const currencyCode = currency === 'INR' ? 'INR' : currency === 'EUR' ? 'EUR' : currency === 'GBP' ? 'GBP' : 'USD'
  
  const symbolMap: Record<string, string> = {
    'INR': '₹',
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'AED': 'DH',
    'CNY': '¥'
  }
  const symbol = symbolMap[currency] || '$'
  
  if (abs >= 1e7) return `${symbol}${(value / 1e7).toFixed(2)} Cr`
  if (abs >= 1e5) return `${symbol}${(value / 1e5).toFixed(2)} L`
  if (abs >= 1e3) return `${symbol}${(value / 1e3).toFixed(1)}K`
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(value)
}

export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '0'
  return new Intl.NumberFormat('en-IN').format(value)
}

export const formatPercent = (value: number | null | undefined, decimals = 1): string => {
  if (value === null || value === undefined || isNaN(value)) return '—'
  return `${value.toFixed(decimals)}%`
}

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const daysFromNow = (dateStr: string | null | undefined): number | null => {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}
