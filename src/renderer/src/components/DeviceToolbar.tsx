import { MonitorSmartphone } from 'lucide-react'
import type { ViewportPreset } from '../../../shared/contracts/browser'

const options: Array<{ value: Exclude<ViewportPreset, 'devices-canvas'>; label: string }> = [
  { value: 'responsive', label: 'Responsive' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'desktop', label: 'Desktop' }
]

export function DeviceToolbar({ preset, dimensions, onChange }: { preset: ViewportPreset; dimensions: { width: number; height: number }; onChange: (preset: ViewportPreset) => void }): React.JSX.Element {
  return <div className="device-toolbar" aria-label="Device viewport">
    <MonitorSmartphone size={14} strokeWidth={1.75} aria-hidden="true" />
    <select aria-label="Viewport preset" value={preset} onChange={(event) => onChange(event.target.value as ViewportPreset)}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <span aria-live="polite">{dimensions.width} × {dimensions.height}</span>
  </div>
}
