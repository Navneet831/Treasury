import React from 'react'

interface KPICardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  onClick?: () => void
  variant?: 'default' | 'warning' | 'danger' | 'success'
  trend?: { value: number; label: string }
}

const variantStyles = {
  default: 'bg-white border',
  warning: 'bg-orange-50 border-orange-200',
  danger: 'bg-red-50 border-red-200',
  success: 'bg-green-50 border-green-100',
}

const iconStyles = {
  default: 'bg-primary/5 text-primary',
  warning: 'bg-orange-100 text-orange-600',
  danger: 'bg-red-100 text-red-600',
  success: 'bg-green-100 text-green-600',
}

const valueStyles = {
  default: 'text-foreground',
  warning: 'text-orange-800',
  danger: 'text-red-800',
  success: 'text-green-800',
}

const KPICard: React.FC<KPICardProps> = ({ title, value, description, icon, onClick, variant = 'default', trend }) => {
  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-xl shadow-sm transition-all ${variantStyles[variant]} ${
        onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider leading-tight pr-2">{title}</p>
        {icon && (
          <div className={`p-2 rounded-lg flex-shrink-0 ${iconStyles[variant]}`}>
            <span className="w-4 h-4 block [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
          </div>
        )}
      </div>
      <h3 className={`text-2xl font-black tracking-tight ${valueStyles[variant]}`}>{value}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{description}</p>
      )}
      {trend && (
        <div className={`mt-3 flex items-center gap-1 text-xs font-bold ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          <span>{trend.value >= 0 ? '▲' : '▼'}</span>
          <span>{Math.abs(trend.value).toFixed(1)}% {trend.label}</span>
        </div>
      )}
      {onClick && (
        <p className="text-[10px] text-muted-foreground/60 mt-2 italic">Click to drill down →</p>
      )}
    </div>
  )
}

export default KPICard
