# Project format v1

> **2026-10-30 update:** The v1 project permits an optional `characters` list, state variable maps, and typed elements. The working-folder asset roots are `backgrounds`, `images`, `sounds`, `music`, `animation`, and `video`. Older F06 details below describe the initial implementation and should be read with these additions. See the [current-state review](../planning/10-current-state.md).

F06 also defines an editor [workspace wrapper](../../packages/editor-workspace/src/index.ts) for folders, file bytes, and target resolution. The creator exports `project.pcag`: eight ASCII identifier bytes (`PCAGPRJ1`), a 32-byte SHA-256 digest of the compressed payload, and gzip-compressed workspace JSON. Open project checks the identifier and digest before decompression, then validates the workspace before replacing editor state. Folder and file records are restored into the browser workspace, where media bytes become usable asset URLs. The nested `project` continues to use the v1 playable format. Player ZIP export writes that nested project as `project.json` alongside the media files. Legacy raw JSON is not accepted by Open project.

The working project is a directory on the local machine. Its `workspace.json` stores authored project data and settings without embedding asset file bytes. The Assets view scans actual files and subfolders under `backgrounds`, `images`, `sounds`, `music`, `animation`, and `video` when a project opens and when the view refreshes. Asset edits write to those files directly; unrelated files added outside the editor are preserved. `.pcag` export collects supported assets from the working folder, and import extracts them into the selected folder. Electron remembers the recent project folder through its desktop bridge; the browser test adapter uses a stored directory handle. Creating a new project seeds one empty scene with a blank PNG background so the current v1 room schema remains valid. The reference adventure is available only through the explicit `?sample=1` development route.

F03 introduces an executable schema in [project-format](../../packages/project-format/src/index.ts). `parseProject(text)` parses JSON and validates it; `validateProject(unknown)` validates an already-parsed object. Both return either `{ ok: true, project, diagnostics: [] }` with an independent data copy, or `{ ok: false, diagnostics }` without a partial project. They never repair or mutate the input. No renderer, UI, filesystem, storage, or dependency imports exist in this package.

## Authored records

Unknown fields are rejected, including editor state and live runtime state. SceneManager event scripts are an explicit authored field. `gameState`, `sceneState`, and `sceneManager` may be absent in older v1 files; validation returns empty maps and an empty event list for them. Newly authored projects and scenes store these explicitly. The TypeScript interfaces and runtime checks live together in the package; there is no second, independently maintained schema implementation.

New saves use `rooms[].elements`. Older v1 rooms with `rooms[].hotspots` are read as elements without mutating the source file; the next save writes `elements`. A room containing both fields is rejected rather than merging conflicting lists. Older element records with `id` and `name` load as `game_id: id`, `element_id: name`, and `name: name`; the next save writes the three new fields.

| Record | Fields and meaning |
| --- | --- |
| Project | `schemaVersion: 1`, `id`, `name`, `startRoomId`, `assets`, `rooms` (at least one), `gameState` variable map, optional `characters` |
| Image asset | `id`, `name`, `kind: "image"`, `path` relative to the project's asset root |
| Room | `id`, `name`, positive finite `width`/`height` in logical room coordinates, `backgroundAssetId`, `elements`, `player`, `walkableArea`, `sceneState` variable map, `sceneManager` |
| Element | Stable `game_id`, editable script key `element_id`, display `name` (optional for Overlay), `type: "box" | "shape" | "image" | "overlay"`, optional Boolean `enabled`, `visible`, `locked`, `bounds: { x, y, width, height }`; shapes add `vertices`, images and overlays add `media` |
| SceneManager | `events` list; each event has an ID, name, nonempty OR list of triggers, and JavaScript `script` |
| Player | `characterId`, `position: { x, y }` of the sprite anchor, optional normalized `anchor: { x, y }` with each coordinate from 0 to 1, positive base `scale`, and `layer` insertion index in the element order |
| Walkable Area | PNG `path` under `images`, positive `minScale` and `maxScale` with min no greater than max |
| Character | `id`, `name`, `referenceAssetId`, `animations` |
| Character animation | `key`, asset `path`, displayed `height`, and `mirrorX` |

State maps use variable names as keys. Each variable stores `value` and `defaultValue`, both Boolean, finite Number, or Text of the same type. `value` is editable during authoring; the engine initializes a new play session from `defaultValue`. Changing the type resets both values to that type's empty value. Older primitive entries are normalized into records with matching current and default values. Names start with a letter and contain up to 64 letters, numbers, or underscores. Empty text is allowed. `gameState` belongs to the project and is shown from every scene; each room has its own `sceneState`. SceneManager scripts can update declared session variables; general conditional action authoring remains later backlog work.

SceneManager supports Game Load/Close and Scene Load/Close triggers plus Player Move to, Talk to, View, Push, Pull, Open, Close, Give, and Use triggers targeted to an element, with an optional item ID. SceneState and GameState variable-change triggers select a declared variable. Any matching trigger signals its event. Event JavaScript defines the generated `async function on_<event ID>(scene, game, trigger)`; older synchronous scripts also run. `scene.state` and `game.state` expose session values, while `scene.elements` is keyed by `game_id` and, when unique, `element_id`. Event targets use stable `game_id` values, so editing an `element_id` does not break triggers. Element properties include `disabled`, `visible`, `source.type`/`uri`, `position`, `scale` (display width/height), and `playback.run`/`reverse`. Animation elements expose `await playAnimation()` and `await stopAnimation()`. A single run starts at the first frame and `playAnimation()` resolves after the last frame; a loop starts automatically and `playAnimation()` starts it if stopped. `stopAnimation()` freezes either mode on its first frame. When a script changes a declared variable, the matching change trigger receives `{ type: "scene_variable_change" | "game_variable_change", target: variableName, old_value, value }`. A script setting the same value does not emit a change. The runtime validates edits before applying them, stops scripts that exceed 1.5 seconds of execution outside an awaited animation, and caps a chained event run at 64 scripts. The player emits its currently selected action on element click. Project scripts execute in a worker during preview and play, so projects containing scripts should be treated as executable content from their author.

Before `playAnimation()` or `stopAnimation()` runs, the player applies element edits already made by that script. Visibility and enabled changes update the existing scene objects without restarting the scene. A script can therefore hide a static element, show an initially hidden animation element, and then await playback while the updated scene is visible. State variable changes are still committed when the script finishes.

The `character_position` trigger receives `{ type: "character_position", x, y, phase }`, where `phase` is `start`, `move`, or `end`. It fires at movement start and end and every 60 ms during movement. Scripts using it include a reminder to keep evaluation light. Each event runs one script at a time and stores only its newest pending trigger; signals for other events have independent pending slots. Script execution and shared scene/game state updates remain serialized.

Older elements without `type` load as `box`. Shapes store at least three absolute room-coordinate vertices and use their polygon for player hit testing. The editor updates `bounds` to the polygon's enclosing rectangle after vertex edits. Image elements store `media.path`, `kind`, natural `width`/`height`, `preserveAspectRatio`, `loop`, and `reverse`; their `bounds.width`/`height` are the independent displayed dimensions. Older image elements with `media.scale` load with their existing bounds and lose the legacy scale field on normalization. Animation media references a `pcag-animation-atlas` JSON file with a companion PNG. The animation picker selects only the JSON; its `image` field resolves the PNG in the same project animation folder. The creator and player play atlas frames in forward or reverse order, once or repeatedly. An element with an empty media path is a draft and remains an interactive area without artwork.

Elements default to enabled and visible, and to unlocked when those flags are absent in older projects. Disabled elements remain visible but have no player hit area. Hidden elements have no player artwork or hit area and do not appear on the editor canvas; their Elements row remains available. Locking prevents dragging on the editor canvas and hides outlines there; it does not change player behavior. Locked elements let pointer input reach the canvas or elements beneath them. Their inspector and Elements row remain editable. Locked Box and Shape outlines disappear from the editor canvas, while locked Image artwork remains visible without its outline.

Each element stores `availableActions` as a unique list drawn from View, Move to, Talk to, Push, Pull, Open, Close, Give, and Use. The inspector can select any combination, including none. Older elements normalize to `['view']` to preserve their click behavior. In the player, hovering an enabled, visible element selects View when available, then Move to, then its first available action. Scrolling over that element cycles its available actions. The generated cursor artwork and the action hint show the current choice; clicking dispatches the matching Player Action trigger. Move to also walks the Player toward the clicked point when a character is assigned and its destination is walkable. Empty walkable ground shows `Move to here`. Empty ground over a transparent Walkable Area pixel and elements with no available actions show a hollow crosshair with no hint text; clicking either does nothing. Element actions remain available when their artwork sits over a nonwalkable pixel. Overlays never capture player input. Give and Use dispatch without an item ID until inventory selection is implemented.

Each scene also has a static Player and Walkable Area. Player can be dragged between element rows to set its render layer, but has no enable, hide, clone, or delete controls. Its optional `locked` flag prevents canvas dragging, hides the marker outline and anchor, and lets clicks pass through; the inspector remains editable and the Player row can still be reordered. Locking has no effect in play. Its inspector selects a project character and edits the initial feet position and base scale; the unlocked canvas marker can also move the initial position. Walkable Area chooses a PNG matching the background image dimensions and remains invisible in play. Fully transparent pixels block the player's feet; nontransparent grayscale maps black to max scale, white to min scale, and intermediate shades linearly between them. A background click finds a walkable route to the clicked point, plays the directional walk animation on each segment, then returns to idle. An empty mask allows movement across the whole scene. Older scenes normalize with an unassigned Player and empty Walkable Area.

The player has a Debug walk path checkbox. When enabled, each accepted Move to request marks the Player's starting point and the destination and draws the planned route over the scene. Turning it off clears the route without restarting play. This display setting is session-only and is not stored in project data.

Overlay is an image element in the ordinary back-to-front scene order, including positions above or below Player. Its bounds must be `{ x: 0, y: 0, width: room.width, height: room.height }`, and the chosen image must have the same intrinsic pixel dimensions as the background. It has no player actions or hit area, so pointer input passes to elements or the scene underneath. Visibility hides its artwork; disabling omits it in play and dims it in the editor. Changing the background clears overlay image assignments so the author can choose a matching file. Scripts may toggle `disabled` and `visible` but cannot reposition or replace an Overlay image.

Element `element_id` and non-Overlay `name` must be nonblank strings. Overlays omit `name` when newly created; older Overlays with a name remain valid. `game_id` stays stable when either editable field changes. The older v1 element `inspect` field is accepted on load and removed from normalized project data. The player uses the display `name` in action hints and View text, falling back to `element_id` when needed. Empty asset/element lists are structurally valid; each room still needs a resolvable image declaration. Rectangular bounds have finite nonnegative x/y, positive width/height, and must fit inside their room. Fractional logical coordinates are allowed. A 16:9 player frame does not force all authored rooms to have that ratio; fitting their presentation is a renderer concern.

Image paths allow ASCII letters, digits, spaces, underscores, hyphens, dots, and parentheses, plus slashes and png/jpg/jpeg/webp/svg extensions. Absolute paths, URLs, query strings, backslashes, empty segments, `.` and `..` are rejected. This checks declarations, not file bytes or existence. The creator checks imported file signatures and accepts only static SVG artwork without scripts or external references. Archive limits, asset staging, and missing-file handling belong to project I/O in F05/B01.

## Identity and references

IDs start with a letter, contain letters/digits/underscores/hyphens, and have 1–64 characters. They are unique across project, assets, rooms, and elements. `createId()` uses platform `crypto.randomUUID()` with an `id_` prefix; it is called only on creation. Validation never invents or repairs IDs. Runtime reference checks use Map/Set value lookup, not object-prototype keys.

Display-name edits and list reordering keep IDs unchanged. The start room must reference a room; a background must reference an image asset. A deleted target leaves an explicit missing-reference diagnostic, never an automatic reassignment. Future editor duplication must create fresh IDs and remap references internal to the duplicated selection deliberately; references outside that selection keep their original meaning. No duplicate/delete editing operations ship in F03.

The new rebuild supports only v1. Missing, older, and future versions are rejected before interpreting their content. Archived first-build projects are not implicitly compatible even if their version number matches: their structure must pass the new validator, and only the documented `hotspots` to `elements` field migration is claimed. Project-schema version is separate from future player-save and content-revision policies. No player saves exist yet.

## Diagnostics

Each diagnostic contains:

- `severity: "error"` and a stable code (`invalid_json`, `unsupported_version`, `invalid_type`, `unknown_field`, `invalid_value`, `duplicate_id`, `missing_reference`, `out_of_bounds`).
- `path`: JSON Pointer into the submitted document; empty means the document root. Array indexes describe that snapshot, not stable identity.
- `target`: entity `kind`, stable `id` when available, owning `roomId` for elements, and a relative `field` such as `backgroundAssetId` or `bounds.width`.
- `message`: a human-readable explanation and corrective direction where applicable.

For the missing-background fixture:

```json
{
  "severity": "error",
  "code": "missing_reference",
  "path": "/rooms/0/backgroundAssetId",
  "target": { "kind": "room", "id": "room_lake", "roomId": null, "field": "backgroundAssetId" },
  "message": "Background \"image_missing\" is missing. Choose an existing image for \"Lakeshore\"."
}
```

The creator translates the background field into “Background image” and exposes technical location in expandable details. F04 can navigate the same target to its actual inspector control. Invalid entity IDs can be null/unusable; use the diagnostic path until repaired. Duplicate IDs must be fixed before stable targeting is reliable.

Structural errors are collected first. Reference and bounds checks run only after structural success, avoiding misleading cascades from malformed records. Duplicate-ID diagnostics identify the later occurrence and name the first location. Validation does not prove puzzle solvability or asset integrity.

## Maintainer checks

```sh
npm run test:format
npm run review:format
npm run review:format -- tests/fixtures/missing-background.json
npm run review:format -- tests/fixtures/missing-start-room.json
```

The valid command exits 0 and prints the resolved start room. The invalid commands intentionally exit 1 and print field diagnostics. This CLI is a maintainer review aid, not a required creator workflow. It uses Node's built-in test/type-stripping support from the pinned Node 22 installation; application and test types are checked separately with `npm run typecheck`.

The [reference fixture](../../examples/reference-adventure/project.json) is loaded through the same parser in both app shells. Its small [adapter](../../examples/reference-adventure/sample.ts) maps a declared asset path to the bundled URL; it is not a general import/export API. F04 will implement actual element rendering/interactions and authoring; F05 will supply storage/export boundaries.
