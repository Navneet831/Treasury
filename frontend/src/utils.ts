export const formatCurrencyAbsolute = (value: number | null | undefined, currency: string): string => {
  if (value === null || value === undefined || isNaN(value)) return '—'
  
  return Math.round(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export const formatCurrency = (value: number | null | undefined, currency: string): string => {
  if (value === null || value === undefined || isNaN(value)) return '—'
  
  return Math.round(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export const formatCurrencyCompact = (value: number | null | undefined, currency: string, unit: 'Cr' | 'Absolute' = 'Cr'): string => {
  if (value === null || value === undefined || isNaN(value)) return '—'
  
  if (unit === 'Cr') {
    return (value / 1e7).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return Math.round(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
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
