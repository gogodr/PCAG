# 0001 — M0 architecture and delivery

Date: 2026-10-22. Status: implemented and validated for the foundation slice on Windows Chromium. Governing scope: [M0](../planning/05-roadmap.md#m0--foundation-proof), F01–F05 in the [development plan](../planning/06-development-plan.md).

## Context

Creators need a complete visual authoring-to-export loop. Preview must behave like the delivered game, and creating or exporting a game cannot require a compiler. The repository began with planning documents only.

## Decisions

Use TypeScript, React, Phaser, and Vite, with exact versions and a root lockfile. The initial repository uses a single npm package and logical package folders rather than publishing or introducing workspace dependencies before they are needed. Root commands build/check the complete thin slice. Node 22.23.1 and npm 10.9.8 were used locally; the declared Node minimum is 22.12.0. Vite's [official requirements](https://vite.dev/guide/) and [Phaser installation guidance](https://docs.phaser.io/phaser/getting-started/installation) informed setup; installed versions were verified from the npm registry rather than copied from research notes.

| Folder | Owns | Boundary |
| --- | --- | --- |
| `packages/project-format` | Schema v1, stable identities, structural/reference diagnostics | No UI/renderer imports |
| `packages/adventure-core` | Isolated inspection session and action contract | No React, Phaser, DOM, or storage imports |
| `packages/presentation` | Phaser background, semantic hotspot controls, response/media UI, disposal | Uses core; does not own authored mutations |
| `packages/project-io` | Validation at I/O boundaries, images, local save, backup, game ZIP | Does not import application code |
| `apps/creator` | Undoable editing, selection, forms, spatial drawing, isolated preview | Uses shared packages |
| `apps/player` | Standalone project load and shared player startup | Does not import creator |

Use room coordinates with rectangular hotspots. Editor percentages and player overlays derive from those coordinates, independently of viewport size. Last authored overlapping hotspot is on top. Buttons over the Phaser canvas provide pointer and keyboard activation with visible focus. M0 supports inspection immediately; protagonist movement, approach, inventory, and dialogue remain later milestones. Phaser currently uses its Canvas renderer; WebGL performance has not been evaluated.

Each playtest mounts a fresh `AdventureSession` from a validated clone. Its visited-object set and response are transient. Stopping or restarting disposes the session, Phaser game, DOM controls, and any audio context. The editor holds the original project separately. There is one shared presentation/core implementation for preview and export.

Use a single self-contained `.pcag.json` editable backup with embedded raster images for M0. This keeps references portable and proves round trips without prematurely defining archive extraction. Game exports are ZIP files, but the creator does not import ZIP archives. A manifest-plus-separate-assets editable archive remains B01 work; it will require a version/compatibility decision and bounded extraction. JSON imports validate data and decode images before replacing current work. Unsupported versions are rejected; no project migration or player-save compatibility is claimed yet.

Use explicit browser-local `localStorage` saves under `pcag.project.v1`. Single-key writes preserve the old value if quota fails. The UI tracks the saved snapshot and exposes separate backup/reopen operations. This is a convenience prototype, with no autosave or multi-revision recovery. Image embedding/base64 and synchronous storage are known scale limits; evaluate IndexedDB or another store before larger-project beta qualification. The 8 MB/image, 4096-pixel image dimension, 24 MB project, and 50-hotspot bounds are defensive prototype caps, not measured capacity guarantees. Browser quotas may prevent a save below these caps; backup download remains available.

Build a version-matched IIFE player once as part of the maintainer's creator build. Copy that template into the creator's static files. At export time, validate the project and package the prebuilt player, CSS, HTML, project data, and hosting note using fflate. All URLs are relative and there are no CDN/runtime service dependencies. Test the exported artifact on an independent static HTTP server at `/games/my-adventure/`. Do not use direct disk opening as the acceptance path. Publication is separate.

## Alternatives and consequences

A server-side build per export adds accounts/services and is unnecessary for declarative content. Separate preview logic risks semantic drift. A full editable archive and asynchronous durable store are likely future improvements, but add failure modes beyond the smallest M0 proof. The current choices deliberately expose those limits while retaining shared interfaces and versioned content.

The full Phaser dependency makes the player about 1.46 MB minified before transport compression and causes a Vite creator chunk-size warning. This does not block the tested workflow; no performance budget or broad browser support claim is established. Splitting/loading strategy should follow representative measurements.

## Evidence

See [M0 results](../development/m0-evidence.md) for reproducible checks, browser version, screenshots, and remaining limits. The foundation fixture is an engineering sample; it is not the complete M3 reference adventure or evidence for M5 independent authoring.
