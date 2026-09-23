# FEATURE-33 - DRM/Widevine compatibility analysis

This document records the initial compatibility pass for experimental DRM/Widevine support in Stackly. It is intentionally limited to analysis and diagnostics; it does not make the Castlabs Electron for Content Security build the committed runtime yet.

## Current project state

- Electron dependency: `electron` is pinned to `44.1.0` in `package.json` and `package-lock.json`.
- Packager setting: `electron-builder.yml` pins `electronVersion: 44.1.0`.
- Runtime note: the local `node_modules/electron/package.json` reports `44.1.0+wvcus`, but the committed lockfile still resolves `https://registry.npmjs.org/electron/-/electron-44.1.0.tgz`. Treat the stock Electron lockfile as the reproducible project state until the ECS migration is committed.
- Build flow: `electron-vite build` produces `out`, then `electron-builder` packages it. Native rebuilds are disabled with `npmRebuild: false`, and `node-pty` is unpacked from ASAR.
- Platform targets: Windows NSIS, macOS DMG/ZIP, and Linux AppImage.

## Browser architecture

- Normal browsing uses DOM `<webview>` elements in the React renderer.
- Normal tab webviews are kept mounted and switched with CSS visibility, so switching tabs does not recreate webviews.
- Device tabs use DOM `<webview>` elements for the on-canvas device frames.
- Device Canvas also has main-process `WebContentsView` support through `DeviceViewManager` for inspectable device targets.
- Workspaces are isolated with persistent Chromium partitions named `persist:workspace:<workspace-id>`.
- Each workspace calls `session.fromPartition(...)`, sets a Chrome-like user agent, and installs permission handlers through `configureSessionPermissions`.

## Security posture

The existing hardened web preferences are preserved:

- `nodeIntegration: false`
- `nodeIntegrationInWorker: false`
- `nodeIntegrationInSubFrames: false`
- `contextIsolation: true`
- `sandbox: true`
- `webSecurity: true`
- `allowRunningInsecureContent: false`

The initial DRM work does not expose privileged APIs to external pages. The diagnostic API is only exposed to the local shell preload and IPC validates that the caller is the shell main frame.

## Castlabs ECS compatibility notes

The Castlabs documentation describes ECS as a drop-in Electron replacement for Widevine playback. ECS v16 and newer use the Component Updater Service, labeled `wvcus`, to install/update Widevine CDM. The documented integration pattern is to wait for `components.whenReady()` before opening the `BrowserWindow`.

The current Stackly version aligns with the Castlabs example tag shape for Electron `44.1.0` (`v44.1.0+wvcus`), so an experimental ECS branch appears technically viable. The package and builder config still need to be changed together in a later migration step so clean installs and packaged builds use the same runtime.

Known caveats:

- A successful EME/Widevine probe is not proof that Netflix or another commercial service will play.
- Production playback can involve VMP signing, service allowlists, platform rules, and terms of use.
- Components must come from the Castlabs/ECS flow; do not copy DRM binaries from Chrome or any unofficial source.

## Implemented in this step

- Added an internal DRM diagnostics IPC/preload API.
- Added a Dev Panel `DRM` tab that probes the active Chromium target.
- The diagnostic reports Electron, Chromium, Node, platform, ECS components API availability, EME API availability, Widevine key-system access, and basic media codec support.
- The probe works against the active tab target, and against the selected device target when Device Canvas is active.

## Next migration step

After reviewing the diagnostic result on this branch, the experimental migration can update the Electron dependency to the matching Castlabs GitHub release, update the lockfile, verify `components.whenReady()` status on fresh installs, and then test demo DRM content before trying commercial services.
