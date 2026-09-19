import { Globe2, LoaderCircle, Plus, X } from 'lucide-react'
import { useTabsStore } from '../stores/tabs'

export function TabBar(): React.JSX.Element {
  const tabs = useTabsStore((state) => state.tabs)
  const activeTabId = useTabsStore((state) => state.activeTabId)

  return <div className="tab-bar">
    <div className="tab-list" role="tablist" aria-label="Tabs">
      {tabs.map((tab) => <div className={`tab-item${tab.id === activeTabId ? ' tab-item--active' : ''}`} key={tab.id}>
        <button className="tab-select" role="tab" aria-selected={tab.id === activeTabId} data-tooltip={tab.title} onClick={() => {
          void window.devBrowser.tabs.select(tab.id).catch(console.error)
        }}>
          {tab.isLoading ? <LoaderCircle className="tab-loading" size={14} strokeWidth={1.75} aria-hidden="true" /> : <Globe2 size={14} strokeWidth={1.75} aria-hidden="true" />}
          <span>{tab.title}</span>
        </button>
        <button className="tab-close" type="button" aria-label={`Close ${tab.title}`} data-tooltip={`Close ${tab.title}`} onClick={() => {
          void window.devBrowser.tabs.close(tab.id).catch(console.error)
        }}>
          <X size={13} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>)}
    </div>
    <button className="tab-new" type="button" aria-label="New Tab" data-tooltip="New Tab" onClick={() => {
      void window.devBrowser.tabs.create().catch(console.error)
    }}>
      <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  </div>
}
