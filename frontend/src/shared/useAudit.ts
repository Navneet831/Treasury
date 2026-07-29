import { useContext } from 'react'
import { AuditContext } from './AuditContext'

export const useAudit = () => {
  const context = useContext(AuditContext)
  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider')
  }
  return context
}
