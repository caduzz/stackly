import type { NewVirtualDevice, VirtualDeviceType } from '../stores/devicesCanvas'

export type DevicePresetCategory = 'Mobile' | 'Tablet' | 'Custom'

export type DevicePreset = {
  id: string
  name: string
  category: DevicePresetCategory
  type: VirtualDeviceType
  viewportWidth: number
  viewportHeight: number
  deviceScaleFactor: number
  userAgent?: string
}

export const devicePresetCategories: DevicePresetCategory[] = ['Mobile', 'Tablet', 'Custom']

export const devicePresets: DevicePreset[] = [
  {
    id: 'small-phone',
    name: 'Small Phone',
    category: 'Mobile',
    type: 'mobile',
    viewportWidth: 360,
    viewportHeight: 780,
    deviceScaleFactor: 2
  },
  {
    id: 'large-phone',
    name: 'Large Phone',
    category: 'Mobile',
    type: 'mobile',
    viewportWidth: 430,
    viewportHeight: 932,
    deviceScaleFactor: 3
  },
  {
    id: 'small-tablet',
    name: 'Small Tablet',
    category: 'Tablet',
    type: 'tablet',
    viewportWidth: 768,
    viewportHeight: 1024,
    deviceScaleFactor: 2
  },
  {
    id: 'large-tablet',
    name: 'Large Tablet',
    category: 'Tablet',
    type: 'tablet',
    viewportWidth: 1024,
    viewportHeight: 1366,
    deviceScaleFactor: 2
  },
  {
    id: 'custom',
    name: 'Custom',
    category: 'Custom',
    type: 'custom',
    viewportWidth: 390,
    viewportHeight: 844,
    deviceScaleFactor: 1
  }
]

export function devicePresetsByCategory(category: DevicePresetCategory): DevicePreset[] {
  return devicePresets.filter((preset) => preset.category === category)
}

export function instantiateDeviceFromPreset(preset: DevicePreset, options: Partial<Pick<NewVirtualDevice, 'x' | 'y' | 'url' | 'environmentId' | 'orientation'>> = {}): NewVirtualDevice {
  return {
    name: preset.name,
    type: preset.type,
    viewportWidth: preset.viewportWidth,
    viewportHeight: preset.viewportHeight,
    x: options.x ?? 0,
    y: options.y ?? 0,
    orientation: options.orientation ?? 'portrait',
    displayScale: preset.type === 'tablet' ? 1.18 : 1,
    url: options.url ?? '',
    environmentId: options.environmentId ?? null
  }
}
