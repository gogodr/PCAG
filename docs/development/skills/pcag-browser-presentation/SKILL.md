---
name: pcag-browser-presentation
description: Build PCAG browser room rendering, navigation, Phaser lifecycle integration, media, and standard player controls shared by preview and export. Use for spatial and presentation behavior rather than puzzle-rule ownership.
---

# PCAG browser presentation

Read the [standard player experience](../../../research/01-gameplay-and-ux.md), [architecture boundaries](../../../planning/03-framework-plan.md), and M0/M1/M3 in the [roadmap](../../../planning/05-roadmap.md). Phaser is the working renderer choice, subject to M0 validation.

## Presentation responsibilities

Use the same core and presentation implementation in creator preview and standalone player. Editor overlays may reuse rendering/geometry helpers but must not become a second gameplay interpreter. Translate domain requests into movement, animation, subtitles, sound, and UI; never make a sprite's visibility the sole record of a collected item.

Own explicit startup/disposal for scenes, input listeners, timers, audio, and asynchronous callbacks. Each preview has isolated play state. Teardown must prevent late callbacks from changing a later session.

## Spatial implementation

Apply the [character and interaction specification](../../../planning/07-character-and-interactions.md). Render a visible protagonist with a feet anchor, facing, and idle/walk/talk mappings; click-to-walk is the standard exploration input. Present View as that character's observation, with readable attributed text and optional voice. Basic observation speech belongs in M1. Pick up/Use must not appear to execute remotely while the character is still approaching or unable to reach the target.

1. Define room/world coordinates, camera transforms, scale, bounds, and hotspot hit precedence. Ensure editor-drawn shapes refer to the same coordinates the player uses at different viewport sizes.
2. During M1, choose a constrained walkable representation and pathfinding approach supported by the editor. Record which obstacles, holes, or disconnected regions are supported; validate unsupported shapes instead of accepting data the runtime cannot navigate.
3. Separate the clicked target, approach point, path, and queued action. Route around supported obstacles. If unreachable, report failure without changing puzzle state. Arrival reports completion to the core for prerequisite revalidation.
4. Handle movement replacement and room teardown so canceled arrivals never fire old interactions. Define entrance placement and facing; reconstruct the room using durable core state.
5. Map supplied idle/walk/talk animations and facing through authored metadata. Surface missing mappings with useful diagnostics rather than requiring source changes.

## Standard player UX

Implement the [player action/UI requirements](../../../planning/08-player-actions-and-ui.md): classic verb bar, default Walk mode, command sentence, and inventory. Preserve explicit verb choices alongside suggested quick actions. Respect the documented selection/reset/cancel states; inventory controls must not dispatch ground clicks. Provide keyboard focus/activation and the keyboard destination marker. Right-click and drag remain optional shortcuts. Preserve readable speaker labels/subtitles and text settings; essential information cannot depend solely on hover, color, or audio.

Define audio startup and failure feedback for actual target browsers. Verify behavior using the pinned implementation and current official APIs when necessary; do not promise autoplay or browser support from assumptions. Desktop mouse/keyboard is the initial scope; touch/controller support requires its own validation.

## Evidence

Show the same authored scene in preview and export. Check repeated startup/teardown, resized coordinates, overlap priority, reachable and unreachable navigation, interrupted movement, exits/reentry, keyboard-only core interactions, and audio initialization. Record actual browser versions and limitations. Use meaningful state/lifecycle checks alongside visual inspection; screenshots alone cannot establish cancellation correctness.
