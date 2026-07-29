import React, { useState } from 'react'
import { askAICopilot } from '../api'
import { Send, Bot, Sparkles, User } from 'lucide-react'

const AICopilot: React.FC = () => {
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const onSend = async () => {
    if (!query.trim()) return
    
    const userMsg = { role: 'user', content: query }
    setMessages(prev => [...prev, userMsg])
    setQuery('')
    setLoading(true)

    try {
      const response = await askAICopilot(query)
      const botMsg = { 
        role: 'assistant', 
        content: response.answer,
        data: response.data 
      }
      setMessages(prev => [...prev, botMsg])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error processing your request.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 h-[calc(100vh-64px)] flex flex-col gap-6 animate-in slide-in-from-right-4 duration-500">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary rounded-lg text-primary-foreground">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">GrewGpt</h2>
          <p className="text-sm text-muted-foreground">Natural language insights and predictive analytics</p>
        </div>
      </div>

      <div className="flex-1 bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <Bot className="w-12 h-12 text-muted-foreground opacity-20" />
              <div className="max-w-md">
                <p className="text-sm font-bold text-muted-foreground">Ask me anything about your Bills & LCs</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                  {["Generate daily insights", "Show unpaid bills", "Expiring LCs", "Upcoming payment obligations"].map(q => (
                    <button 
                      type="button"
                      key={q}
                      onClick={(e) => { e.preventDefault(); setQuery(q); }}
                      className="p-3 text-[10px] font-bold uppercase tracking-tight border rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-primary text-primary-foreground rounded-tr-none' 
                  : 'bg-muted rounded-tl-none'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                    {msg.role === 'user' ? 'You' : 'GrewGpt'}
                  </span>
                </div>
                <p className="text-sm leading-relaxed font-medium">{msg.content}</p>
                {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-black/10 bg-white">
                    <table className="w-full text-[11px] text-left border-collapse">
                      <thead className="bg-muted/50 border-b border-black/5">
                        <tr>
                          {Object.keys(msg.data[0]).map(key => (
                            <th key={key} className="px-3 py-2 font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5">
                        {msg.data.map((row: any, i: number) => (
                          <tr key={i} className="hover:bg-muted/30 transition-colors">
                            {Object.values(row).map((val: any, j: number) => (
                              <td key={j} className="px-3 py-2 font-medium">
                                {typeof val === 'number' ? val.toLocaleString() : String(val)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {msg.data && (!Array.isArray(msg.data) || msg.data.length === 0) && (
                  <div className="mt-4 p-3 bg-white/50 rounded-lg border border-black/5">
                     <pre className="text-[10px] font-mono overflow-x-auto">
                        {JSON.stringify(msg.data, null, 2)}
                     </pre>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-4 justify-start">
              <div className="bg-muted p-4 rounded-2xl rounded-tl-none animate-pulse">
                <div className="flex gap-1">
                   <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                   <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce delay-100" />
                   <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-muted/20">
          <div className="flex gap-2 bg-white p-2 border rounded-xl shadow-inner ring-1 ring-black/5">
            <input 
              type="text" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSend()}
              placeholder="Query the command center..." 
              className="flex-1 px-4 py-2 text-sm focus:outline-none"
            />
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); onSend(); }}
              disabled={loading || !query.trim()}
              className="p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AICopilot
