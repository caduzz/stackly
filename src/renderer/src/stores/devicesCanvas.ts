import { create } from 'zustand'

export type VirtualDeviceType = 'mobile' | 'tablet' | 'custom'
export type VirtualDeviceOrientation = 'portrait' | 'landscape'

export type VirtualDevice = {
  id: string
  name: string
  type: VirtualDeviceType
  viewportWidth: number
  viewportHeight: number
  x: number
  y: number
  orientation: VirtualDeviceOrientation
  displayScale: number
  url: string
  environmentId: string | null
  isSelected: boolean
  zIndex: number
}

export type NewVirtualDevice = Omit<VirtualDevice, 'id' | 'isSelected' | 'zIndex' | 'displayScale'> & {
  id?: string
  displayScale?: number
  isSelected?: boolean
  zIndex?: number
}

type DevicesCanvasState = {
  devices: VirtualDevice[]
  selectedDeviceId: string | null
  addDevice: (device: NewVirtualDevice) => string
  removeDevice: (id: string) => void
  selectDevice: (id: string | null) => void
  updateDevice: (id: string, patch: Partial<Omit<VirtualDevice, 'id'>>) => void
  updatePosition: (id: string, position: Pick<VirtualDevice, 'x' | 'y'>) => void
  replaceLayout: (devices: VirtualDevice[], selectedDeviceId: string | null) => void
  clearDevices: () => void
}

function uniqueDeviceId(): string {
  return crypto.randomUUID()
}

function selectOnly(devices: VirtualDevice[], selectedDeviceId: string | null): VirtualDevice[] {
  return devices.map((device) => ({ ...device, isSelected: device.id === selectedDeviceId }))
}

function nextZIndex(devices: VirtualDevice[]): number {
  return Math.max(0, ...devices.map((device) => device.zIndex)) + 1
}

export const useDevicesCanvasStore = create<DevicesCanvasState>((set) => ({
  devices: [],
  selectedDeviceId: null,
  addDevice: (device) => {
    const id = device.id ?? uniqueDeviceId()
    set((state) => {
      const nextDevice: VirtualDevice = {
        ...device,
        id,
        displayScale: device.displayScale ?? 1,
        isSelected: device.isSelected ?? true,
        zIndex: device.zIndex ?? nextZIndex(state.devices)
      }
      const selectedDeviceId = nextDevice.isSelected ? id : state.selectedDeviceId
      const devices = nextDevice.isSelected ? selectOnly(state.devices, null) : state.devices
      return { devices: [...devices, nextDevice], selectedDeviceId }
    })
    return id
  },
  removeDevice: (id) => set((state) => {
    const devices = state.devices.filter((device) => device.id !== id)
    const selectedDeviceId = state.selectedDeviceId === id ? null : state.selectedDeviceId
    return { devices: selectOnly(devices, selectedDeviceId), selectedDeviceId }
  }),
  selectDevice: (id) => set((state) => {
    const selectedDeviceId = id && state.devices.some((device) => device.id === id) ? id : null
    const promotedZIndex = selectedDeviceId ? nextZIndex(state.devices) : null
    return {
      devices: selectOnly(state.devices, selectedDeviceId).map((device) => device.id === selectedDeviceId && promotedZIndex ? { ...device, zIndex: promotedZIndex } : device),
      selectedDeviceId
    }
  }),
  updateDevice: (id, patch) => set((state) => ({
    devices: state.devices.map((device) => device.id === id ? { ...device, ...patch, id } : device)
  })),
  updatePosition: (id, position) => set((state) => ({
    devices: state.devices.map((device) => device.id === id ? { ...device, ...position } : device)
  })),
  replaceLayout: (devices, selectedDeviceId) => set({
    devices: selectOnly(devices.map((device) => ({ ...device, displayScale: device.displayScale ?? 1 })), selectedDeviceId),
    selectedDeviceId: selectedDeviceId && devices.some((device) => device.id === selectedDeviceId) ? selectedDeviceId : null
  }),
  clearDevices: () => set({ devices: [], selectedDeviceId: null })
}))
