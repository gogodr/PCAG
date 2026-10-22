# Development setup and maintenance

The creator and shared player use TypeScript, React, Phaser, and Vite. Start with the [foundation architecture](../decisions/0001-foundation-architecture.md), [M1 exploration/format decision](../decisions/0003-exploration-and-project-v2.md), and [M1 evidence](m1-evidence.md). The [development skills](skills/README.md) map subsequent work to the backlog.

## Run locally

Use Node 22.12 or newer; the initial implementation was tested with Node 22.23.1 and npm 10.9.8. Run from the repository root:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). `dev` first builds the standalone player template used by exports. Restart it after changing the standalone player's build/configuration so exported templates reflect your changes. Normal creator/preview source edits use Vite hot reload.

For a standalone fixture player during development:

```powershell
npm run dev:player
```

This normally uses port 5174. Its development-only fixture comes from `examples/foundation/project.json`; production exports load their adjacent `project.json`.

## Checks and production build

```powershell
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

`npm run check` runs type checking, domain/data tests, both builds, and browser workflows. The browser workflows start the built creator at port 4173 and test a separate exported game using a temporary independent HTTP server. Run `npm run build` before browser tests after changing source. `npm run preview -- --port 4173` serves the built creator for manual review. Vite preview is a local review server, not a production hosting service.

In this managed Windows session, npm network access and Vite/browser child processes required sandbox escalation. That is an execution-environment constraint, not a product permission flow or a special requirement on ordinary developer machines.

To keep Playwright browser downloads inside the repository on Windows:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.playwright'
npx playwright install chromium
```

The test configuration detects an existing `.playwright` directory; otherwise it uses Playwright's standard browser location. Downloads, dependencies, generated templates, builds, and test artifacts are ignored by Git. The GitHub Actions workflow is supplied for future use; this repository has not been initialized or published to GitHub, and no hosted CI run is claimed.

## Build and export ownership

`npm run build:player` builds `dist/player/player.js` and `player.css`, then prepares static files under `apps/creator/public/player-template`. `npm run build` packages the creator into `dist/creator`, including that player template. Serve the complete directory on static HTTP hosting. Subdirectory deployment uses relative URLs.

The export button validates a project, fetches the bundled template, and creates a ZIP locally. The ZIP contains `index.html`, `player.js`, `player.css`, `project.json`, and a hosting note. It works independently of the creator. Do not replace this path with an author-facing compiler requirement.

## Extend a feature

Add authored data/validation in `project-format`, semantics in `adventure-core`, renderer/input adapters in `presentation`, and visual controls in `creator`. Integrate storage/export changes through `project-io`. Read the relevant skill before implementation. Keep identities stable through renames and undo. Test invalid/interrupted behavior as systems gain asynchronous effects.

The current schema is v2. A focused v1 import converts old projects to editable drafts, preserving IDs/assets/text while requiring explicit character/ground setup. Browser saves use `pcag.project.v2`; the original `pcag.project.v1` is retained and used only when a v2 save is absent. Original imported files are unchanged. Structural validation permits unfinished setup to be saved; preview/export additionally require playable setup and valid decoded media. No general migration framework or player-save format exists. Any schema change must state compatibility and provide fixtures.

## Known exploration limits

Navigation uses up to eight axis-aligned walkable rectangles minus up to eight rectangular obstacles per room. It routes the character's feet point; authors account for body clearance in their obstacles. There is no polygon editor, dynamic navigation, depth scaling, or physics collision. Scene layers are explicitly behind/in front of the actor. Character setup maps imported sprite sheets for idle/walk/talk, with left/right facing and one feet anchor; the sheet must create at most 256 frames.

Walk/View, observations, room exits, raster assets, explicit local saves, and JSON backups are implemented. Inventory/physical verb effects, puzzle facts, full dialogue, gameplay saves, autosave recovery, and editable ZIP import remain pending. Only Windows Chromium has passed the recorded browser checks. Imported audio playback and broad browser/performance qualification remain later work.
