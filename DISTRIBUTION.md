# Distribuição do Stackly

## Requirements

- Node.js 22.12 or newer
- Platform toolchain required by native Node modules
- Code signing identities for public macOS and Windows releases

`better-sqlite3` and `node-pty` provide prebuilt binaries for the supported
platforms and architectures. Packaging preserves these binaries instead of
requiring a compiler toolchain. `postinstall` verifies that the current target
has both prebuilds. Their native files are unpacked from ASAR
because they must be loaded or executed directly. A new unsupported target may
require enabling `npmRebuild` and installing that platform's native toolchain.

## Commands

- `npm run dev`: development server and Electron shell
- `npm run typecheck`: strict TypeScript validation
- `npm test`: distribution configuration checks
- `npm run build`: production bundles in `out/`
- `npm run package:dir`: unpacked application for local smoke testing
- `npm run package`: installers for the current operating system
- `npm run package:linux`, `package:win`, `package:mac`: platform targets
- `npm run package:deb`: optional Debian package, best run on Debian/Ubuntu CI

Artifacts are written to `release/`. Build each operating system on that
operating system, especially when native dependencies and code signing are
involved. CI should use a platform matrix for reproducible releases.

## Data and production behavior

SQLite is stored below Electron's `userData` directory, outside the installed
application and source tree. Production loads the local bundled renderer,
disables Chromium DevTools, omits source maps, and keeps remote pages isolated
inside sandboxed `WebContentsView` instances.
