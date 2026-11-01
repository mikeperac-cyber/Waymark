# Waymark — Personal Offline Workspace (Windows x64)

Waymark is a fast, local-first Windows desktop workspace for organizing saved links, planning and evaluating tools, and tracking actionable steps, tasks, notes, and reminders.

## Permanent `.exe` Deliverables

- **`Waymark-Portable-x64.exe`** — Standalone single-file portable Windows executable. Move or copy this single `.exe` anywhere and launch it without installing.
- **`Waymark-Setup-x64.exe`** — Permanent Windows installer (NSIS) that installs Waymark with Start Menu and Desktop shortcuts.
- **`Waymark-win32-x64/Waymark.exe`** — Unpacked instant-launch desktop executable folder.

## Rebuilding from Source

```bash
# Run unit tests
bun run test

# Build optimized renderer bundle
bun run desktop:build

# Rebuild app.asar, Waymark.exe, Waymark-Portable-x64.exe, and Waymark-Setup-x64.exe
bun run desktop:package
```
