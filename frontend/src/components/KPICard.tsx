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

const KPICard: React.FC<KPICardProps> = ({ title, value, description, icon, onClick, variant = 'default' }) => {
  const isDanger = variant === 'danger'
  const isWarning = variant === 'warning'
  
  return (
    <div
      onClick={onClick}
      className={`p-8 rounded-[18px] border transition-all duration-300 ${
        isDanger ? 'bg-red-50 border-red-200' : isWarning ? 'bg-orange-50 border-orange-100' : 'bg-white border-[#e0e0e0]'
      } ${
        onClick ? 'cursor-pointer hover:border-[#0066cc] group' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-6">
        <p className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">{title}</p>
        {icon && (
          <div className={`text-[#86868b] ${onClick ? 'group-hover:text-[#0066cc]' : ''} transition-colors`}>
            <span className="w-4 h-4 block [&>svg]:w-4 [&>svg]:h-4">{icon}</span>
          </div>
        )}
      </div>
      <h3 className={`text-[28px] font-bold tracking-tighter leading-none ${
        isDanger ? 'text-[#dc2626]' : 'text-[#1d1d1f]'
      }`}>{value}</h3>
      {description && (
        <p className="text-[12px] text-[#86868b] mt-4 font-medium leading-relaxed">{description}</p>
      )}
      {onClick && (
        <div className="mt-6 flex items-center gap-1 text-[11px] font-bold text-[#0066cc] opacity-0 group-hover:opacity-100 transition-opacity">
          DRILL DOWN →
        </div>
      )}
    </div>
  )
}

export default KPICard
