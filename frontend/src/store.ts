import { create } from 'zustand'

interface AppState {
  currency: 'INR' | 'FC'
  setCurrency: (currency: 'INR' | 'FC') => void
  fy: string
  setFy: (fy: string) => void
  asOnDate: string
  setAsOnDate: (date: string) => void
  amountUnit: 'Cr' | 'Absolute'
  setAmountUnit: (unit: 'Cr' | 'Absolute') => void
  isDarkMode: boolean
  setIsDarkMode: (dark: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  currency: 'INR',
  setCurrency: (currency) => set({ currency }),
  fy: 'All',
  setFy: (fy) => set({ fy }),
  asOnDate: new Date().toISOString().split('T')[0],
  setAsOnDate: (asOnDate) => set({ asOnDate }),
  amountUnit: 'Cr',
  setAmountUnit: (amountUnit) => set({ amountUnit }),
  isDarkMode: localStorage.getItem('treasury.dark') === 'true',
  setIsDarkMode: (isDarkMode) => {
    localStorage.setItem('treasury.dark', String(isDarkMode))
    set({ isDarkMode })
  },
}))
