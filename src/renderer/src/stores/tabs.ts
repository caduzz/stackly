import { create } from 'zustand'
import type { TabState, TabsSnapshot } from '../../../shared/contracts/browser'
import { initialTabId } from '../../../shared/types/tab'

type TabsState = TabsSnapshot & {
  snapshotWorkspaceId: string
  applySnapshot: (snapshot: TabsSnapshot, workspaceId?: string) => void
}

const initialTab: TabState = {
  id: initialTabId,
  kind: 'normal',
  title: 'New Tab',
  url: '',
  isLoading: false,
  canGoBack: false,
  canGoForward: false,
  isMuted: false,
  isAudible: false
}

export const useTabsStore = create<TabsState>((set) => ({
  tabs: [initialTab],
  activeTabId: initialTabId,
  snapshotWorkspaceId: '',
  applySnapshot: (snapshot, workspaceId = '') => set({ ...snapshot, snapshotWorkspaceId: workspaceId })
}))
