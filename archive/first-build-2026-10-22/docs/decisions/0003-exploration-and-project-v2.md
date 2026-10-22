# 0003 — Exploration, actor rendering, and project v2

Date: 2026-10-22. Status: implemented for M1. Read [M1 evidence](../development/m1-evidence.md) for checks and limits. This extends the [M0 architecture](0001-foundation-architecture.md) and implements the Walk/View subset of [player UI requirements](../planning/08-player-actions-and-ui.md).

## Navigation and interaction

Use a union of up to eight axis-aligned walkable rectangles per room, minus up to eight closed obstacle rectangles. The creator draws these shapes and edits their numeric bounds. This is the constrained M1 alternative to a general polygon editor; arbitrary polygons, rotation, navigation meshes, dynamic obstacles, and character-body collision are not implemented.

Navigation treats the character's authored feet anchor as a point. Authors must include the desired body clearance when drawing obstacles. The planner uses rectangle boundary coordinates and a 0.5-pixel clearance around obstacle corners to construct an orthogonal graph. A* searches it, then line-of-sight smoothing removes unnecessary corners. Segment checks divide at all boundary crossings rather than sampling pixels, so thin obstacles cannot be skipped. Avoid subpixel corridors; support for paths narrower than the corner clearance is not promised.

The renderer does not own puzzle navigation or arrival correctness. `AdventureSession.update(deltaMs)` advances position along the route using the authored speed. Replacement, Cancel, View, room changes, and disposal clear pending approach work. Arrival rechecks room identity, target existence/enabled state, approach location, and walkability. View cancels movement and speaks at the current position.

M1 exposes Walk/View and exits in the player. A core `approach` service emits validated physical-arrival events for the future action runner; it does not pick up items or execute puzzle effects. The tests exercise that boundary without claiming M2 inventory support. P01 must add prerequisite/rule evaluation and ensure event consumption cannot duplicate effects.

## Rendering and authored character

A shared Phaser scene renders the background, optional behind/front image layers, and the protagonist. Three sprite-sheet mappings configure idle, walk, and talk frames, dimensions, and frame rate. Facing supports left/right via horizontal flipping. Frame indices use row-major Phaser sprite-sheet order. Diagonal/eight-direction artwork, scaling with depth, per-frame pivots, and animation production tools remain future work.

The supplied explorer is original eight-frame artwork with editable mappings. New projects explicitly start from that template and a supplied floor. Imported M0 projects receive neither a character nor walkable geometry automatically; creators choose the starter character and configure their scene. Media validation decodes images and checks mapping bounds before preview/export/import. Sprite-sheet splitting is capped at 256 frames.

DOM hotspot/exit controls share room coordinates with the canvas, preserving keyboard focus and sentence previews. The scene viewport's aspect ratio must be set before Phaser boots. Use top-left alignment, refresh measured parent bounds on room-size changes, and observe viewport resizes. Tests compare the canvas rectangle with its overlay viewport, including export transitions between differently sized rooms. This protects rendering alignment as well as semantic state.

## Content and project compatibility

Project schema v2 adds the optional protagonist definition, room layers, navigation, entrances, exits, enabled hotspots, and independent approach markers. Stable references are shared across rooms and assets. Duplicating a room remaps its local identities, including self-links, while retaining external links/assets. Room/entrance deletion clears affected destinations for explicit reconnection; it is undoable. Referenced assets cannot be deleted through the library.

Distinguish structural/reference validity from playable readiness. A draft may lack a protagonist, ground, or a configured exit destination and still be saved/backed up. Preview/export require valid character/ground/entrance/exit setup. Broken non-null references, invalid bounds, duplicate IDs, and malformed structure still fail validation.

The v1 import path validates and transforms the old structure into an editable v2 draft, preserving original IDs, assets, and observation text. It adds empty navigation, null approach markers, and an entrance placeholder that the author must check. It does not assert those default coordinates form a playable scene. Original imported files are unchanged. Browser v2 saves use `pcag.project.v2`; `pcag.project.v1` is read only as a fallback and retained when saving the upgrade. Unsupported versions fail clearly. There is no general migration framework or player-save format yet.

Self-contained JSON backups and static playable ZIP packaging remain unchanged in purpose. Full editable archive extraction, autosave/recovery, and large-project storage improvements remain B01 work. Prototype bounds include 20 rooms, 50 library assets, 30 image layers/room, 12 entrances/exits per room, and the existing image/project caps; these are input limits, not performance qualification.
