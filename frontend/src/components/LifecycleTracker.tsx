import React, { useEffect, useState } from 'react'
import { getLifecycleTracker } from '../api'
import { formatNumber } from '../utils'
import { ArrowDown } from 'lucide-react'

const LifecycleTracker: React.FC = () => {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const result = await getLifecycleTracker()
        setData(result)
      } catch (error) {
        console.error('Error fetching lifecycle tracker:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div className="p-8">Mapping LC lifecycle...</div>

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold">LC Lifecycle Tracker</h2>
        <p className="text-sm text-muted-foreground">End-to-end transaction funnel monitoring</p>
      </div>

      <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto">
        {data.map((step, idx) => (
          <React.Fragment key={idx}>
            <div 
              className="w-full bg-white border rounded-xl p-5 shadow-sm hover:border-primary transition-all group relative overflow-hidden"
              style={{ width: `${100 - (idx * 5)}%` }}
            >
              <div className="flex justify-between items-center relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>
                  <span className="font-bold text-lg">{step.stage}</span>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black">{formatNumber(step.count)}</div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Active Units</div>
                </div>
              </div>
              <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-20 group-hover:opacity-100 transition-opacity" />
            </div>
            {idx < data.length - 1 && (
              <div className="flex flex-col items-center gap-1 opacity-40">
                <ArrowDown className="w-6 h-6 text-primary" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <div className="bg-primary/5 p-6 rounded-xl border border-primary/10">
           <h4 className="text-sm font-bold text-primary uppercase mb-2">Efficiency Metric</h4>
           <p className="text-2xl font-black">12.4 Days</p>
           <p className="text-xs text-muted-foreground">Avg. time from Shipment to Bill Lodgement</p>
        </div>
        <div className="bg-primary/5 p-6 rounded-xl border border-primary/10">
           <h4 className="text-sm font-bold text-primary uppercase mb-2">Conversion Rate</h4>
           <p className="text-2xl font-black">94%</p>
           <p className="text-xs text-muted-foreground">Docs received within 15 days of shipment</p>
        </div>
        <div className="bg-primary/5 p-6 rounded-xl border border-primary/10">
           <h4 className="text-sm font-bold text-primary uppercase mb-2">Bottleneck Alert</h4>
           <p className="text-2xl font-black">Bill Acceptance</p>
           <p className="text-xs text-muted-foreground">Current stage with highest average delay</p>
        </div>
      </div>
    </div>
  )
}

export default LifecycleTracker
