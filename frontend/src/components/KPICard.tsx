import React from 'react'

interface KPICardProps {
  title: string
  value: string | number
  description?: string
  icon?: React.ReactNode
  onClick?: () => void
}

const KPICard: React.FC<KPICardProps> = ({ title, value, description, icon, onClick }) => {
  return (
    <div 
        onClick={onClick}
        className={`bg-white p-6 rounded-xl border shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-primary active:scale-[0.98]' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold mt-1">{value}</h3>
        </div>
        {icon && <div className="p-2 bg-primary/5 rounded-lg text-primary">{icon}</div>}
      </div>
      {description && (
        <div className="flex items-center gap-2 mt-2">
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      )}
    </div>
  )
}

export default KPICard
