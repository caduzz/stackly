# Security notes

This project follows the Electron security checklist. The local React shell and remote browser content run in separate web contents with different responsibilities.

## Process boundaries

- The shell uses a sandboxed, context-isolated renderer with Node integration disabled.
- Remote pages run only in `WebContentsView`, without a preload script or Node access.
- `webSecurity` remains enabled. Mixed content, experimental Chromium features, and Node integration in workers or subframes are explicitly disabled.
- The shell CSP limits scripts to its own origin, blocks frames, objects, forms, and base URL changes, and permits only the resource types needed by the UI. `blob:` workers support Monaco; loopback WebSocket connections support the Vite development server.

## Privileged operations

- The preload exposes named, typed operations through `contextBridge`; it never exposes `ipcRenderer` or generic Node APIs.
- Every main-process IPC handler validates that the sender is the registered shell main frame. Inputs with data are validated before privileged use.
- Workspace sessions deny permission checks and requests by default. Future permission support must use an explicit origin and permission allowlist.
- Terminal processes, SQLite, downloads, sessions, and Chromium debugging stay in the main process.

## Navigation and external content

- The shell cannot navigate or create child windows.
- Remote views accept only parsed HTTP and HTTPS navigation. New-window requests are always denied at Electron level; valid HTTP(S) destinations are recreated as internal tabs.
- The application does not call `shell.openExternal`. External protocols such as `file:`, `javascript:`, and custom schemes are blocked.
- HTTP remains supported because localhost and user-selected development servers are core browser use cases. Such pages retain Chromium's sandbox, same-origin policy, permission denial, and lack of preload access.

## Release review

Keep Electron current and reassess Electron fuses during packaging. Re-run this audit whenever a new preload method, privileged IPC operation, protocol handler, or remote-content capability is introduced.
