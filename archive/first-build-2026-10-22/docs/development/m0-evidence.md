# M0 foundation proof — results

Date: 2026-10-22. Status: F01–F05 implemented; M0 foundation gate passed for the recorded environment. M1–M5 and independent nontechnical authoring acceptance remain outstanding.

Historical record: the project has since advanced to [M1](m1-evidence.md). M0 observations below describe the original foundation. Its source fixture is retained as `examples/foundation/project-v1.json`; the current `project.json` is the expanded exploration fixture.

## Delivered creator outcome

Start a new project or edit the supplied study. Import a raster background, draw or add a rectangular hotspot, edit its name/bounds/inspection response, undo/redo, and playtest using the same core/presentation as export. Save locally, reopen after reload, download/open a portable editable backup, and export a standalone game ZIP. Invalid references/bounds block play/save/export; unsupported or corrupt imports preserve current work.

The editor, project definition, and live play session have distinct state. Preview restarts create fresh sessions; inspection history/responses do not alter authored content. The M0 sample has no movement, inventory, dialogue, or player saves.

Product clarification, 2026-10-22: the intended game has a visible click-to-walk protagonist. View is a character observation; Pick up/Use require reaching the scene target before execution. See the [confirmed interaction specification](../planning/07-character-and-interactions.md). The M0 results below validate the foundation workflow, not that pending third-person experience.

## Environment and commands

Local Windows environment, Node **22.23.1**, npm **10.9.8**, Playwright Chromium **156.0.8078.4**. Dependencies are exact-pinned in `package.json` and `package-lock.json`: React/React DOM 19.3.1, Phaser 4.2.1, TypeScript 7.0.2, Vite 8.3.5, Vitest 5.0.5, Playwright 1.64.1, Zod 4.6.7, fflate 0.8.3. This is a tested set, not a promise to track the newest releases automatically.

| Check | Result | Evidence |
| --- | --- | --- |
| Type checking | Passed | `npm run typecheck` |
| Domain/data/integration tests | 9 passed | `npm test`; `tests/integration/foundation.test.ts` |
| Player and creator production builds | Passed | `npm run build`; generated `dist/player` and `dist/creator` |
| New-project visual authoring | Passed | Browser test imports a background, draws a hotspot, edits the response, and uses keyboard inspection |
| Backup and local persistence | Passed | Download/open editable backup; save, overwrite unsaved fields, reopen, and browser reload |
| Preview lifecycle | Passed | Four edit/play cycles with restart, one canvas in play, none after stop, no page errors; domain test proves session snapshot isolation |
| Browser audio initialization | Passed | User-gesture diagnostic Web Audio tone reports a running context; audible quality was not assessed |
| Invalid data preservation | Passed | Invalid bounds block save; unsupported-version and undecodable-image imports preserve a healthy saved project |
| Standalone playable export | Passed | UI-created ZIP served by a separate test HTTP server at `/games/my-adventure/`; edited response works without creator or CDN |
| Visual inspection | Passed at 1440 px width | Creator and preview screenshots below; no horizontal overflow at the reviewed width |
| Hosted CI | Not run | Workflow supplied; repository not published |
| Edge / Firefox / Safari | Not tested | Browser matrix remains B03 work |
| Human independent authoring | Not run | M5 gate; automated authoring is not a substitute |

Browser scenarios live in `tests/browser/foundation.spec.ts`. They exercise the built application, rather than mocked editor controls. Checks use the command sequence in [setup](setup.md); `npm run check` combines the full local sequence.

## Visual evidence

[Creator screenshot](evidence/m0-creator.png) and [shared-player preview screenshot](evidence/m0-preview.png) show the reviewed foundation UI. The geometric study artwork is original repository content; see [fixture provenance](../../examples/foundation/README.md).

## Findings and limits

- Phaser integrates with React preview lifecycle and the static player packaging path for this slice. Canvas rendering was used; no WebGL or navigation measurements have been made.
- A standalone player is approximately **1.46 MB** minified JavaScript (**384 KB** gzip estimate from Vite). The creator script is approximately **1.72 MB** (**474 KB** gzip estimate). The creator build emits a chunk-size warning; no load-time or performance qualification is claimed.
- Editable backups are self-contained JSON with embedded images, rather than an extracted archive. ZIP is currently output-only for playable games. Editable archive extraction and migration remain future compatibility work.
- LocalStorage is synchronous and quota-dependent. Explicit saves and atomic last-good preservation are implemented. Autosave, multi-revision recovery, and large-project storage qualification are not implemented.
- Prototype input caps are 8 MB per image, 4096 × 4096 image dimensions, 24 MB per project, and 50 hotspots. These are bounds on accepted input, not measured storage quotas or release-size guarantees. A browser may reject a local save below those values; download a backup.
- Sound evidence covers browser initialization through a diagnostic tone. Sound asset import, Phaser media playback, animation mapping, and sequence behavior are later work.
- The supplied fixture was created programmatically. The browser authoring test starts from a new project and uses the editor; no human usability claim is inferred from either.

## Next handoff

Begin M1 with R01 (room/asset library and undoable edits), then R02 (spatial editing and animation mapping), R03 (navigation/approach cancellation), and R04 (room lifecycle). Preserve the M0 export/persistence loop while extending it. Replace the single-room schema constraint deliberately and add compatibility fixtures. Use a constrained, editor-authorable navigation representation and record its supported shapes before implementing paths.

No calendar forecast is assigned: ongoing development capacity is unspecified, and one foundation slice is insufficient evidence for navigation/animation velocity. Re-estimate those work packages after a focused spatial prototype.
