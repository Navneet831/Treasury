import React, { useEffect, useState } from 'react'
import { getRiskAlerts, getDrillDown } from '../api'
import { useStore } from '../store'
import DrillDownModal from './DrillDownModal'
import { AlertTriangle, Clock, FileWarning, ShieldAlert, CheckCircle } from 'lucide-react'

const RiskAlerts: React.FC = () => {
  const { fy } = useStore()
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [drillData, setDrillData] = useState<any[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getRiskAlerts(fy)
        setAlerts(result)
      } catch (error) {
        console.error('Error fetching risk alerts:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [fy])

  const handleDrillDown = async (alertType: string) => {
    try {
        const result = await getDrillDown({ alert_type: alertType, fy })
        setDrillData(result)
        setModalTitle(`Alert Drill-down: ${alertType}`)
        setIsModalOpen(true)
    } catch (e) { console.error(e) }
  }

  if (loading) return <div className="p-8">Scanning for risks...</div>

  const highPriority = alerts.filter(a => a.priority === 'HIGH')
  const mediumPriority = alerts.filter(a => a.priority === 'MEDIUM')

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-left-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold">Risk & Alerts Center</h2>
        <p className="text-sm text-muted-foreground">Automated monitoring of critical deadlines and compliance</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-red-600 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                High Priority Alerts ({highPriority.length})
              </h3>
          </div>
          <div className="space-y-4">
            {highPriority.length > 0 ? highPriority.map((alert, idx) => (
              <div key={idx} className="bg-red-50 border border-red-100 p-4 rounded-xl flex gap-4 animate-in fade-in duration-300">
                <div className="p-2 bg-red-100 rounded-lg h-fit text-red-600">
                  {alert.type === 'Expiry Risk' ? <Clock /> : <AlertTriangle />}
                </div>
                <div>
                  <h4 className="font-bold text-red-900">{alert.type}</h4>
                  <p className="text-sm text-red-700 mt-1">{alert.message}</p>
                  <button 
                    onClick={() => handleDrillDown(alert.type)}
                    className="mt-3 text-xs font-bold text-red-600 underline uppercase tracking-tight hover:text-red-800"
                  >
                    View Transaction Detail
                  </button>
                </div>
              </div>
            )) : (
              <div className="bg-green-50 border border-green-100 p-8 rounded-xl text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-3" />
                <p className="text-sm font-bold text-green-800">No high-priority risks detected.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-orange-600 flex items-center gap-2">
            <FileWarning className="w-4 h-4" />
            Medium Priority Alerts ({mediumPriority.length})
          </h3>
          <div className="space-y-4">
             {mediumPriority.length > 0 ? mediumPriority.map((alert, idx) => (
              <div key={idx} className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex gap-4 animate-in fade-in duration-300">
                <div className="p-2 bg-orange-100 rounded-lg h-fit text-orange-600">
                   <FileWarning />
                </div>
                <div>
                  <h4 className="font-bold text-orange-900">{alert.type}</h4>
                  <p className="text-sm text-orange-700 mt-1">{alert.message}</p>
                  <button 
                    onClick={() => handleDrillDown(alert.type)}
                    className="mt-3 text-xs font-bold text-orange-600 underline uppercase tracking-tight hover:text-orange-800"
                  >
                    Investigate Delay
                  </button>
                </div>
              </div>
            )) : (
               <div className="bg-muted/30 border p-8 rounded-xl text-center">
                <p className="text-sm text-muted-foreground italic">No medium-priority alerts at this time.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <DrillDownModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} data={drillData} title={modalTitle} />
    </div>
  )
}

export default RiskAlerts
