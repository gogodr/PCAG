# 0003: Electron creator

Date: 2026-10-23. Status: Implemented, pending user validation.

## Context

The creator is a local authoring tool. Its browser file picker and File System Access API limit folder access and make direct Node file operations unavailable. The player remains a standalone browser build.

## Decision

Run the React creator in Electron. The main process owns folder selection, recent folder storage, and project file operations through Node. A sandboxed, isolated preload exposes a small IPC interface. The renderer's existing project storage uses directory and file handle adapters over that interface. The Vite server remains available for automated browser tests, while `npm run dev` opens Electron.

Only paths beneath a folder selected through the system dialog or restored from the recent folder record are accepted. Parent traversal and symbolic links inside a project folder are rejected. The renderer has no direct Node access.

## Consequences

Creator development and distribution now require an Electron binary. This change provides a desktop runtime and local Node file access; packaging an installer and signing release artifacts remain release tasks. Browser tests continue to cover the renderer, and desktop launch plus folder workflow need separate validation.
