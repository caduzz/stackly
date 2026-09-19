import { create } from 'zustand'
import type { WorkspacesSnapshot } from '../../../shared/contracts/browser'

type WorkspacesState = WorkspacesSnapshot & {
  applySnapshot: (snapshot: WorkspacesSnapshot) => void
}

export const useWorkspacesStore = create<WorkspacesState>((set) => ({
  workspaces: [],
  activeWorkspaceId: '',
  applySnapshot: (snapshot) => set(snapshot)
}))
