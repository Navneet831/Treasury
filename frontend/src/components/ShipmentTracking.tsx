import React, { useEffect, useState } from 'react'
import { useStore } from '../store'
import api from '../api'
import { formatNumber } from '../utils'
import { Truck, Clock, AlertTriangle, AlertCircle } from 'lucide-react'
import KPICard from './KPICard'

const ShipmentTracking: React.FC = () => {
  const { fy } = useStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await api.get('/shipment-tracking', { params: { fy } })
        setData(response.data)
      } catch (error) {
        console.error('Error fetching shipment tracking:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [fy])

  if (loading) return <div className="p-8">Tracking shipments...</div>
  if (!data) return null

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="text-primary w-6 h-6" />
            Shipment Monitoring
        </h2>
        <p className="text-sm text-muted-foreground">Tracking physical goods delivery against LC documentation.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
          title="Shipments Pending" 
          value={formatNumber(data.pending_count)}
          description="Awaiting dispatch from supplier"
          icon={<Clock />}
        />
        <KPICard 
          title="Shipments Completed" 
          value={formatNumber(data.completed_count)}
          description="Dispatched on or before today"
          icon={<Truck />}
        />
        <KPICard 
          title="Delayed Receipts" 
          value={formatNumber(data.delayed_count)}
          description="Material received after LC Shipment Date"
          icon={<AlertTriangle className="text-orange-500" />}
        />
        <KPICard 
          title="Expired, Not Shipped" 
          value={formatNumber(data.expired_count)}
          description="LC Expired without Shipment Date"
          icon={<AlertCircle className="text-red-500" />}
        />
      </div>
    </div>
  )
}

export default ShipmentTracking
