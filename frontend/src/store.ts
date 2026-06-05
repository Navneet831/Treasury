import { create } from 'zustand'

interface AppState {
  currency: 'INR' | 'FC'
  setCurrency: (currency: 'INR' | 'FC') => void
  fy: string
  setFy: (fy: string) => void
}

export const useStore = create<AppState>((set) => ({
  currency: 'INR',
  setCurrency: (currency) => set({ currency }),
  fy: 'All',
  setFy: (fy) => set({ fy }),
}))
