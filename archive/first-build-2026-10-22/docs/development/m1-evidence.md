# M1 rooms and exploration — results

Date: 2026-10-22. Version: 0.2.0. Status: R01–R04 implemented for the constrained scope described below. The recorded gate covers Windows Chromium; broader browser qualification and human authoring acceptance remain pending.

## Creator and player outcome

The protagonist is now visible and animated. Click walkable scene space to walk; select **View**, then an object, to hear a character-attributed observation without approaching. Walk to an object through its independent approach marker, or activate an exit to walk there and transition into the linked room entrance. Cancel, replacement commands, View, and room changes invalidate old pending work.

Creators can create/rename/duplicate/delete rooms, choose the starting room, import/reuse backgrounds, place image layers behind/in front of the character, draw walkable/obstacle rectangles, position the character's feet, configure entrances/exits and approach markers, and map supplied/imported idle/walk/talk sprite sheets. These edits use the existing undo history, local persistence, editable backups, and shared preview/export runtime.

Walk/View are the implemented verb subset. Inventory, pickup/use/give effects, explicit Open/Close/Push/Pull puzzle rules, and dialogue are not shipped here. The core has a tested arrival boundary for those later effects, not a hidden inventory implementation.

## Verification

Environment: Windows, Node 22.23.1, npm 10.9.8, Playwright Chromium 156.0.8078.4. The exact dependency set remains locked; no dependency upgrades were needed for M1.

| Check | Evidence |
| --- | --- |
| Type checks and production builds | `npm run check`; creator and standalone player compile |
| 23 domain/data tests | Existing foundation checks plus constrained routes, disconnected areas, thin obstacles, movement speed, one-time arrival, cancellation/replacement, availability changes, room lifecycle, migration, and duplicate-room identity preservation |
| 11 Chromium browser workflows | Foundation workflow retained; new movement/keyboard/View controls, exit arrival/cancel, visual two-room authoring, explicit legacy setup, invalid animation feedback, imported sprite mappings, layers, and reference-aware asset deletion |
| Export independence | A UI-generated ZIP runs at a nested URL on a separate HTTP server, preserving observations and room transitions |
| Coordinate alignment | Canvas and click-overlay bounds agree at startup, after window resize, and after entering a differently sized room in the exported game |
| Preview isolation/lifecycle | Repeated edit/play/restart has one canvas in play, none after stopping, no authored text mutation, and no recorded page errors |
| Compatibility | v1 IDs/content survive upgrade; original browser save remains while a v2 draft is saved; unsupported/corrupt imports preserve good work |
| Visual inspection | Creator/player checked at 1440 × 1000; screenshots linked below |

Commands: `npm run check` runs type checking, tests, both builds, and all browser workflows. Domain tests are in `tests/integration/foundation.test.ts` and `exploration.test.ts`. Browser workflows are in `tests/browser/foundation.spec.ts`, `exploration.spec.ts`, and `assets.spec.ts`.

The browser checks create new rooms/geometry and configure imported character artwork through actual controls. They are automated engineering evidence, not a claim that a nontechnical human completed the M5 acceptance exercise. Hosted CI and other browsers have not been tested.

## Scope and findings

- Navigation is authored as rectangle unions minus rectangles. It supports overlapping walkable areas and supported obstacles; arbitrary polygons and dynamic navigation are not implemented. Feet are treated as a point; authors provide obstacle clearance.
- Character mappings support row-major sprite sheets with a single feet anchor, left/right facing, and idle/walk/talk sequences. These are setup tools, not an animation creation suite.
- View observations use attributed text and talk animation. Recorded voices, adjustable text timing, full conversations, and gameplay menus/saves remain later work.
- Draft saving is distinct from playable validation. Older projects can be edited/backed up while character and navigation setup is unfinished.
- Local storage remains explicit, synchronous, and quota-dependent. This milestone does not add autosave, multi-revision recovery, cloud storage, or player saves.
- The standalone script is about 1.47 MB minified (389 KB gzip estimate); the creator about 1.76 MB (487 KB gzip estimate). Vite's chunk-size warning remains. Representative project/load responsiveness limits are not qualified.
- The new schema's input caps and v1 compatibility policy are documented in [decision 0003](../decisions/0003-exploration-and-project-v2.md). They are not performance guarantees.

Visual review exposed canvas-parent sizing issues that semantic interaction checks alone missed. Both initial boot and transitions between differing room sizes now have alignment checks. Browser testing also exposed a quick-action button disappearing on pointer movement; target retention now lets the user reach that button.

## Screenshots and next handoff

[Creator](evidence/m1-creator.png) and [shared-player preview](evidence/m1-preview.png). Original character/background provenance is recorded with the [fixture](../../examples/foundation/README.md).

Begin M2 / P01–P04: typed facts/conditions, distinct verb rules, action effects, inventory, pickup/use/give/combinations, and durable room consequences with matching author controls. Use the existing validated approach boundary; do not implement item effects directly in click handlers. Add revalidation of puzzle prerequisites on arrival, protect atomic effects/one-time execution, and retain the preview/export/migration regression checks.
