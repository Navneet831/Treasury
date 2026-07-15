import {
  Calendar, Zap, Sparkles, Globe,
  Gauge, Package, BookOpen, FileSearch, Layers, Terminal, Percent
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItemDef {
  id: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItemDef[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Command',
    items: [
      { id: 'limit',    label: 'Command Center', icon: Gauge },
      { id: 'calendar', label: 'Calendar',        icon: Calendar },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { id: 'cashflow',  label: 'Cash Flow',    icon: Zap },
      { id: 'fx',        label: 'FX & Hedging', icon: Globe },
      { id: 'interest',  label: 'interest', icon: Percent },
      { id: 'ops',       label: 'Operations',   icon: Package },
      { id: 'lifecycle', label: 'LC Lifecycle', icon: Layers },
      { id: 'research',  label: 'Intelligence', icon: BookOpen },
    ],
  },
]

export const bottomItems: NavItemDef[] = [
  { id: 'ai',     label: 'GrewGpt', icon: Sparkles },
  { id: 'audit',  label: 'Audit',   icon: FileSearch },
  { id: 'ledger', label: 'Transaction Ledger', icon: Layers },
  { id: 'dev',    label: 'Developer', icon: Terminal },
]
