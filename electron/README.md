# Waymark for Windows

## Deliverables
- **`Waymark-Portable-x64.exe`** — Single-file standalone portable executable. Copy anywhere and double-click to run; no installation required.
- **`Waymark-Setup-x64.exe`** — Windows installer with Start Menu and Desktop shortcuts.
- **`Waymark-win32-x64/Waymark.exe`** — Unpacked instant-launch desktop folder.

## Rebuilding from Source
1. Build the renderer: `bun run desktop:build`
2. Rebuild all `.exe` deliverables: `bun run desktop:package`

## Data & Privacy
All data is stored offline in `workspace.json` inside Electron's Waymark user-data directory (`%APPDATA%\Waymark\workspace.json`). You can export or import a JSON backup anytime from **Settings**.
