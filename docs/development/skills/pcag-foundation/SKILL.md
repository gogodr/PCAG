---
name: pcag-foundation
description: Establish PCAG architecture, toolchain, and the M0 creator-to-export proof, or evaluate changes to its package boundaries. Use for foundation and integration decisions, not isolated content authoring.
---

# PCAG foundation

## Read for this work

- [Roadmap](../../../planning/05-roadmap.md): governing milestone gates and defaults.
- [Development plan](../../../planning/06-development-plan.md): F01–F05, proposed packages, completion checklist.
- [Architecture](../../../planning/03-framework-plan.md): domain boundaries and action lifecycle.
- [Creator plan](../../../planning/04-browser-creator.md): authoring and preview requirements.

## Outcome and boundaries

Prove a complete authoring-to-playable-export loop before expanding the engine. TypeScript, Phaser, and React are provisional defaults to validate, not dependencies already installed. Browser games and independent nontechnical authoring are requirements. Escoria is a design reference, not the runtime or an instruction to port its scripting language.

Keep `adventure-core` independent of React, Phaser, DOM, and storage. Project format owns shared types/validation; presentation adapts core behavior; creator and player use that same implementation; project I/O owns storage and packaging. Create proposed directories only as actual code needs them.

## Execute the foundation proof

1. Inspect existing source, repository guidance, decisions, and dependency manifests before scaffolding. If still planning-only, establish a minimal workspace and documented build/check commands.
2. Verify compatible dependency releases against official documentation when selecting versions; pin the tested set and lockfile. Record environment requirements. Avoid committing speculative version numbers from old research.
3. For F01, inspect a specific Escoria revision/documentation version for room state, action execution, inventory, and UI separation. Record observed facts and references separately from PCAG choices. This is a focused design review, not source reuse.
4. Record short decisions for the project model, preview lifecycle, persistence, and export packaging. Include context, choice, alternatives that materially matter, consequences, and evidence or an outstanding experiment.
5. Build the thin shared player and creator slice: background import, room, hotspot geometry, inspection text, Play/restart, save/reopen, playable export. Use prebuilt player packaging so creators never need a compiler or build service.
6. Exercise the integration in a real browser and run the export through an independent static HTTP server. Record exact tested browser/dependency versions, audio startup behavior, persistence findings, and preview teardown results.

Do not grow full navigation, inventory, or a generic plugin framework to complete M0. If the selected presentation integration blocks an essential workflow, capture a reproducible failure and evaluate the smallest alternative before expanding the system.

## Completion evidence

Deliver a working editable sample, reproducible setup and checks, decision records, and evidence for edit → preview → save → reopen → export → play. Repeated preview sessions must not leak state, handlers, or audio, and play must not mutate authored content. Distinguish measured outcomes from proposed limits. Coordinate data, creator, presentation, and I/O work through explicit contracts; a runnable player alone does not pass M0.
