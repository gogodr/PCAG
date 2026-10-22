---
name: pcag-visual-creator
description: Build PCAG visual authoring workflows for rooms, assets, rules, items, dialogue, preview, and error correction. Use when implementing creator controls or improving independent nontechnical authoring.
---

# PCAG visual creator

Read the [creator workflow](../../../planning/04-browser-creator.md) and [development plan](../../../planning/06-development-plan.md). Follow the [roadmap](../../../planning/05-roadmap.md) when the earlier creator document labels more features as initial proof scope. React is a working default to validate in M0.

## Required user outcome

Use the [character and interaction specification](../../../planning/07-character-and-interactions.md) for protagonist setup, walkable geometry, separate approach markers, and action semantics. View responses are spoken by the character. Standard Pick up/Use actions automatically require approach; authors should not need to construct that sequencing manually. Preview must show the visible actor and its movement as these M1 capabilities arrive.

A nontechnical person can author supported content, test it, correct errors, reopen it, and export it without code, JSON, terminal commands, or a programmer filling gaps. Build the relevant authoring controls with each runtime feature. An editable prepared demo is insufficient evidence for independent creation.

## Editor architecture

Centralize authored mutations as undoable operations. Define operation boundaries for gestures so dragging an object can be undone as one meaningful edit. Keep selection, open panels, and camera/workspace preferences separate from authored data and live preview state. Coordinate persisted project revisions and dirty/save status with project I/O.

Preview starts from an isolated authored snapshot and exposes explicit restart/stop behavior. Play-session changes never silently overwrite definitions. Dispose preview resources before restarting. Use the shared validator and navigate errors to the affected room, entity, and field.

## Build each authoring workflow

Apply [AUTHOR-01–03](../../../planning/08-player-actions-and-ui.md#nontechnical-authoring-requirements): distinct verb rules, suggested action, proximity settings, fallback speech, and validation. Suggested/available verbs must not automatically disclose successful puzzle conditions. The selected player UI is a classic verb bar with command composition; creator preview must use that same player workflow.

1. Start with a concrete task such as creating a locked cabinet; enumerate the data, visible controls, runtime response, error correction, and save/export behavior it needs.
2. Use entity pickers, labeled typed values, and understandable conditions/action cards. Keep stable IDs behind creator-friendly names. Do not make free-form expressions or generated source the source of truth.
3. Implement useful defaults and reversible edits, including reference-aware rename/delete/duplicate. Explain dependent references before destructive edits or provide a clear repair path. Imported/duplicated content must not silently retain wrong identities.
4. For spatial tools, share coordinate and supported geometry contracts with presentation. Provide clear selection and handles, understandable invalid-shape feedback, and alternatives where a core operation would otherwise require precise dragging.
5. For dialogue, begin with lines/topics, choices, conditions, destinations, and preview. Add a graph only if demonstrated complexity calls for it. For rules, start with the supported command vocabulary and editable behavior templates.
6. Keep save/recovery/export states visible and distinct. A successful preview is not a successful save, and a project backup is not a playable game export.

Use progressive disclosure for advanced configuration while keeping core actions discoverable. Keep implementation details out of user-facing flows; explain an invalid destination in story/room terms, not only a stack trace. Implement keyboard navigation, visible focus, labels, and readable feedback as controls are introduced.

## Completion evidence

Demonstrate creation from an empty/new project, editing, undo/redo, preview/restart, error navigation/correction, save/reopen, and export for the feature. Cover at least one invalid path and reference-sensitive rename/delete. Record confusing terminology and help requests during small creator observations. Do not substitute manual project-file repair for missing UI; route those gaps back into the feature backlog.
