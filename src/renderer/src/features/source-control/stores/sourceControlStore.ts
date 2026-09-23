import { create } from 'zustand'
import type { GitStatusSummary } from '../types'

type SourceControlState = {
  status: GitStatusSummary | null
  isLoading: boolean
  error: string | null
  setStatus: (status: GitStatusSummary | null) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
}

export const useSourceControlStore = create<SourceControlState>((set) => ({
  status: null,
  isLoading: false,
  error: null,
  setStatus: (status) => set({ status }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error })
}))
