import { create } from 'zustand'
import type { TabState, TabsSnapshot } from '../../../shared/contracts/browser'
import { initialTabId } from '../../../shared/types/tab'

type TabsState = TabsSnapshot & {
  applySnapshot: (snapshot: TabsSnapshot) => void
}

const initialTab: TabState = {
  id: initialTabId,
  title: 'New Tab',
  url: '',
  isLoading: false,
  canGoBack: false,
  canGoForward: false
}

export const useTabsStore = create<TabsState>((set) => ({
  tabs: [initialTab],
  activeTabId: initialTabId,
  applySnapshot: (snapshot) => set(snapshot)
}))
