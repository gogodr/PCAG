# Rebuild validation log

The authored hotspot concept was renamed to element on 2026-10-31. New projects and exports write `rooms[].elements`; the project reader accepts older `rooms[].hotspots` without changing source data. Editor, runtime, diagnostics, and current UI terminology use element. SceneManager completion now lists each scene element by name after `scene.elements.` and inserts a bracket reference for names containing spaces. The format suite passed 37 checks; production build and focused SceneManager and editor-name browser checks passed.

The SceneManager script editor gained a Monaco theme based on the creator palette and context-aware JavaScript completions on 2026-10-31. The editor derives SceneState and GameState property types from the current project, and scoped completion providers suggest `scene.state`, `scene.elements`, and the available state variable names. `npm run build` passed. The SceneManager authoring and new completion browser tests passed in production and development (four cases).

SceneManager event authoring was added on 2026-10-31. Each scene has an event list with OR triggers, a lazy-loaded Monaco JavaScript popup, and a shared preview/player dispatch path. Scripts can edit declared session state and scene element visibility, enabled state, media source, position, size, and playback. The current player click emits Player View; other verbs are available to the runtime dispatcher for future controls. Legacy projects normalize to an empty event list. `npm run test:format` passed 36 checks, `npm run build` passed, the SceneManager browser case passed in production and development, and the affected production scene editor cases passed after their Elements order expectations were updated.

## Planning reconciliation (2026-10-30)

The [current-state review](../planning/10-current-state.md) and [use-case map](../planning/09-use-case-map.md) document capabilities added since the dated F06 guide. The user explicitly validated F06 on 2026-10-30. R01 is now in progress; character/animation UI and asset/scene operations added ahead of R01/R02 are implementation, not acceptance of those items or M1.

## R01 progress (2026-10-30)

The Scenes inspector now edits the selected element by stable ID, including name, bounds, and View text. Bounds controls keep the rectangle within the room. A browser regression edits the second element, checks that the first remains unchanged, exercises undo/redo, and reads the exported `.pcag` data. `npm run typecheck`, `npm run build`, and `npx playwright test tests/browser/editor-views.spec.ts` passed; the focused browser run passed four tests across production and development. R01 remains **In progress** while reference-safe asset mutation, disk round trips, and wider export parity are audited. The original F06 review guide is still dated documentation.

SceneState and GameState authoring was added on 2026-10-30 by user request. Each room has an independent SceneState map; the project owns one GameState map visible in every scene. The inspector adds, renames, changes type/value, and removes Boolean, Number, and Text variables. Older v1 projects load with empty maps. `npm run test:format` passed 31 checks, `npm run build` passed, `npx playwright test tests/browser/editor-views.spec.ts` passed four checks, `npx playwright test tests/browser/storage-export.spec.ts` passed two checks, and `node tests/desktop/state.mjs` passed a local `workspace.json` and reopen round trip. The broader `npm run test:desktop` flow timed out at its pre-existing animation-editor heading check before reaching scene editing; the focused state test exercises the affected desktop path. Runtime conditions and state mutation are future work under P01/P04; this does not accept R01 or M2.

State variables gained separate current `value` and startup `defaultValue` fields on 2026-10-30. The v1 reader upgrades earlier primitive variables by copying their value into both fields; it rejects mismatched types and non-finite numbers. The runtime creates session maps from defaults and ignores creator-edited current values at startup. `npm run test:format` passed 31 checks, `npm run build` passed, the six focused browser cases across production/development passed, and `node tests/desktop/state.mjs` passed local save/reopen with distinct current/default values. Action-driven state changes remain future work.

The scene canvas gained pointer-centered wheel zoom (100%–400%), drag pan within image bounds, and a reset control on 2026-10-30. All element bounds are interactive overlays; a gesture starting on one does not zoom or pan the background. The view resets when switching scenes and remains editor-only. `npm run build` and all six cases in `npx playwright test tests/browser/editor-views.spec.ts` passed across production and development, including the background/element gesture regression. R01 remains in progress.

The canvas no longer selects Background on click or pan, and element bounds remain outlined when unselected. `npm run build` and the focused scene-gesture test passed in both production and development after this refinement. R01 remains in progress.

Selected elements can now be dragged on the scene canvas. The preview moves during the gesture; release writes one undoable position change, clamped within the room and adjusted for the current zoom. Unselected elements remain stationary until selected. `npm run build` and all eight scene browser cases passed across production and development. A focused follow-up also verified undo/redo and the exported `.pcag` coordinates in both modes. R01 remains in progress.

Elements now have Box, Shape, and Image types. Older rectangles load as Box. Shapes begin as 100×100 polygons; vertices can be dragged, added from edges, and removed with Alt+click, while dragging the interior moves the polygon. Image elements select a project image or animation atlas and edit position and scale. Atlas playback supports one run or looping, with reversed frame order, in both creator and Phaser preview. Asset rename/move updates element paths; deletion guards referenced images and atlas companions. `npm run build`, `npm run test:format` (33 checks), and all 14 editor browser cases across production and development passed, including polygon preview hit testing and atlas playback. A focused export check also verified atlas element settings and its PNG companion in `.pcag`. R01 remains in progress pending user validation and its other review criteria.

On 2026-10-31, Image element sizing changed from a shared scale to displayed width and height with a persistent Preserve aspect ratio setting. Older v1 elements with `media.scale` normalize to their existing displayed bounds. A Choose file button now opens the system file picker and imports an image or an animation atlas and its companion files into the project. `npm run build`, `npm run test:format` (33 checks), and all 14 editor browser cases passed in production and development; direct atlas import, preview, and `.pcag` export were exercised. R01 remains in progress.

The element View text field was removed on 2026-10-31. The v1 reader accepts older `inspect` text and strips it from normalized project data; the player responds to element clicks with a name-based fallback until authored View actions exist. The inspector now groups Name, Source, Position & size, and Playback in a compact layout. `npm run build` and `npm run test:format` (34 checks) passed. Editor and player browser cases passed after updating assertions for the new inspector headings and retired View field. R01 remains in progress.

The Image element animation picker now accepts only an atlas JSON file. It reads the referenced PNG filename from that metadata and resolves the image in the same project animation folder; an actionable error appears if the PNG is absent. `npm run build` and the focused atlas import, preview, and export browser case passed in production and development. R01 remains in progress.

On 2026-10-31, each element row gained Enable/Disable, Show/Hide, and Lock/Unlock buttons. The flags persist in v1 project data; older elements keep enabled, visible, and unlocked behavior. Disabled elements remain visible without player interaction, hidden elements leave the editor canvas and player while staying in Elements, and locked elements resist editor changes. `npm run build`, `npm run test:format` (35 checks), and focused row-control and scene-tree browser tests passed in production and development. R01 remains in progress.

Locked element outlines now disappear from the scene editor. Box and Shape overlays leave the canvas until unlocked; Image artwork remains visible without its selection border. `npm run build` and six focused browser checks passed across production and development.

The Elements panel is wider, and element rows accept drag drops across the full row. The top row is the highest canvas layer; the editor assigns z-index from the saved back-to-front element order, which already drives player depth. A browser check verified a two-item overlap, drag reorder, canvas hit order, and exported project order in production and development. `npm run build` and the existing scene-tree workflow also passed.

Element name inputs now retain a string value throughout inspector edits and inline Elements renames. Change handlers capture the typed value before updating the workspace or React state. A focused browser check cleared and typed an inspector name, renamed the Elements row, and captured console errors in production and development; both runs passed. `npm run build` passed.

On 2026-10-31, legacy Image element validation stopped requiring displayed bounds to equal natural dimensions times the retired `media.scale`; migration now preserves independent bounds and removes `scale`. Workspace edits also copy file records while sharing immutable asset data URL strings, reducing renderer memory pressure when toggling elements in artwork-heavy projects. `npm run build`, all 35 format checks, and an Electron test covering disable, reload, two mismatched legacy image bounds, and persisted migration passed. The reported large-project renderer exit could not be reproduced with the available local fixtures.

## Electron creator foundation (2026-10-23)

Status: Awaiting user validation. The creator now runs in Electron with a sandboxed preload bridge for Node-backed project folders. `npm run build`, `npm run test:format` (28 checks), `npm run test:desktop` (project creation, path protection, and player ZIP export), and `npm run typecheck` passed. The two affected browser test cases passed in both production and development modes after correcting their URL and asset order assumptions. Review with `npm run dev`: create a project in an empty folder, edit its name, close and reopen the app, and continue the project. The files should remain on disk. See [decision 0003](../decisions/0003-electron-creator.md).

Reset: 2026-10-22. F01-F04 accepted on 2026-10-22; F05 accepted on 2026-10-23; F06 accepted on 2026-10-30 by explicit user validation. Full scope and acceptance criteria live in the [development plan](../planning/06-development-plan.md).

Statuses: Not started -> In progress -> Awaiting user validation -> Accepted. Use Blocked with a reason when needed. Only explicit user validation makes an item Accepted. Keep one item active; record evidence, user acceptance, and date in its row. Milestone integration results are recorded separately after the relevant items are accepted.

| Item | Status | Evidence / review guide | User acceptance / date |
| --- | --- | --- | --- |
| F01 | Accepted | [Research, decisions, and review guide](f01-review.md) | 2026-10-22: "F01 looks good, lets move fo F02" |
| F02 | Accepted | [Build, browser results, and review guide](f02-review.md) | 2026-10-22: "all good now, lets move into F03" |
| F03 | Accepted | [Implementation, checks, and review guide](f03-review.md) | 2026-10-22: "ok lets move forward and fo F04" |
| F04 | Accepted | [Implementation, checks, and review guide](f04-review.md) | 2026-10-22: "ok, lets move onto F05" |
| F05 | Accepted | [Implementation, checks, and review guide](f05-review.md) | 2026-10-23: request to proceed after reaching first milestone |
| F06 | Accepted | [Implementation, checks, and dated review guide](f06-review.md); current capabilities are mapped in the [current-state review](../planning/10-current-state.md) | 2026-10-30: "lets mark F06 as validated" |
| R01 | In progress | Selected-element editing, reference-safe asset operations, undo/reopen/export parity; verify multi-scene and character preservation | Pending |
| R02 | Not started | Pending | Pending |
| R03 | Not started | Pending | Pending |
| R04 | Not started | Pending | Pending |
| P01 | Not started | Pending | Pending |
| P02 | Not started | Pending | Pending |
| P03 | Not started | Pending | Pending |
| P04 | Not started | Pending | Pending |
| D01 | Not started | Pending | Pending |
| D02 | Not started | Pending | Pending |
| D03 | Not started | Pending | Pending |
| D04 | Not started | Pending | Pending |
| B01 | Not started | Pending | Pending |
| B02 | Not started | Pending | Pending |
| B03 | Not started | Pending | Pending |
| B04 | Not started | Pending | Pending |
| U01 | Not started | Pending | Pending |
| U02 | Not started | Pending | Pending |
| U03 | Not started | Pending | Pending |

## Milestone gates

M0: passed on 2026-10-23 before F06 changes. `npm run check` built both applications and passed 28 format tests plus 14 Chromium browser checks, including edit, preview, save/reopen, and an exported ZIP served over independent HTTP. F01-F05 were accepted. M1-M5 are not run; M6 remains future expansion. No archived test result counts as a rebuild pass.
