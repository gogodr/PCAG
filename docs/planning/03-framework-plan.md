# Proposed framework architecture and validation plan

Date: 2026-10-21. Status: architecture proposal supporting the established product requirements. The [roadmap](05-roadmap.md) and [development plan](06-development-plan.md) now govern implementation sequencing and working defaults.

## Objective

Enable multiple 2D adventure games to share player interactions, inventory, dialogue, and puzzle execution while authors supply rooms, characters, artwork, writing, and rules.

Updated product direction: nontechnical creators must be able to build these games; programmers maintain the engine. Games target browsers. Escoria is a feature/architecture reference, not a dependency. A visual creator is therefore part of the core product. See [browser creator scope](04-browser-creator.md) for its workflow and proposed implementation.

Confirmed product acceptance requirement: a single nontechnical person can fully author, test, and export a small adventure through the provided tools without programmer intervention. A polished runtime or an editable sample alone is insufficient.

Use the [gameplay research](../research/01-gameplay-and-ux.md) as the proposed behavior baseline and the [technology comparison](../research/02-technology-options.md) for engine selection. This document contains our design recommendations rather than additional externally verified facts.

## Responsibility boundaries

| Layer | Owns |
| --- | --- |
| Host engine | Rendering, audio playback, asset import, input events, animation, platform export |
| Adventure runtime | Action validation, puzzle state, inventory, dialogue progression, sequence execution, persistence |
| Standard UI | Action preview, hotspot labels, inventory panel, dialogue panel, feedback, menus |
| Authoring tools | Room setup, data editing, reference checks, preview tools, debugging |
| Game content | Locations, actors, items, rules, dialogue, media, theme, localized text |

Do not build a universal abstraction over every engine feature. Keep puzzle rules and durable state independent of the renderer. Author rooms and rules in our versioned project model; adapt them to the browser rendering library at runtime. The editor and exported game must use the same runtime and validation rules.

## Proposed content model

- **Room:** ID, background layers, walkable geometry, exits, hotspots, entry points, ambient audio.
- **Actor:** ID, current room, position, facing, animation references, inventory owner.
- **Hotspot:** ID, bounds, label key, enabled condition, approach point, available actions.
- **Item:** ID, icon, text keys, ownership, state, supported interactions.
- **Interaction rule:** action, source/target filters, prerequisites, priority, effects, presentation sequence, fallback.
- **Combination rule:** input items, order policy, prerequisites, consumed inputs, produced outputs.
- **Dialogue:** stable nodes/options, speaker IDs, text keys, conditions, visited state, effects.
- **Game state:** typed flags/counters/enums, entity state, inventory ownership, dialogue history.
- **Save:** schema version, content version, durable game state, safe resume location.

Use stable IDs rather than display names or scene-tree paths for durable references. Reference validation should catch missing entities, duplicate IDs, unknown state keys, and missing dialogue destinations.

## Interaction execution

The [character and interaction specification](07-character-and-interactions.md) records the confirmed third-person behavior. View is an observation spoken by the protagonist, with no approach by default. Pick up and Use on scene objects require successful approach before effects. The click bounds and the character's destination are separate authored values.

Every UI gesture should produce the same kind of request:

`actor + action + optional source item + target`

For example: `hero + use + brass_key + cabinet`.

The runtime should:

1. Validate the current mode, target, item ownership, and prerequisites.
2. Find the applicable rule using explicit precedence; report ambiguous matches during authoring.
3. Walk to the declared approach point when required.
4. Recheck prerequisites after movement because state may have changed.
5. Execute the presentation and commit state changes at declared boundaries.
6. Release input ownership and show the resulting feedback.

Define unreachable targets, repeated clicks, cancellation, and room changes explicitly. A canceled walk must not execute its old queued action after a new command.

## State and sequencing

Keep durable game state outside transient room instances. Returning to a room should reconstruct opened doors, collected objects, and other persistent changes.

Start with a small command vocabulary: walk, face, say, animate, play sound, wait, set state, add/remove/transfer item, start dialogue, and change room. Creators configure these through labeled forms and ordered action cards, with structured data underneath. Programmer extensions may add commands, but ordinary game creation must not require code or JSON editing. Avoid inventing a new scripting language in version one.

Separate presentation from consequential effects so skipping a sequence reaches the same final state without duplicating rewards. Reserve input ownership for modes such as walking, dialogue, cutscene, and menu; define which transitions cancel or suspend prior work.

For the first prototype, allow saving at stable boundaries and defer requests made during non-resumable sequences until the next safe point. Show that deferral clearly. Saving halfway through arbitrary script execution can be evaluated later.

## Standardization boundaries

Fixed initially: selection/cancel rules, action previews, inventory behavior, dialogue selection, failure feedback, menu structure, and save policy.

The [player actions and UI requirements](08-player-actions-and-ui.md) now define those controls: explicit classic verbs, default Walk, a sentence preview, inventory targeting, and a supplemental contextual shortcut. Preserve separate Open/Close/Push/Pull/Use rules.

Themeable: artwork, palette, fonts within readability limits, icons, sound, and character-specific responses.

Extensible: custom actions, unusual puzzle screens, additional state types, and optional gameplay modules. Extensions should use shared action/state APIs so they participate in saves and debugging.

## Minimum proof adventure

Build one small scenario with two rooms, one playable character, one NPC, a locked cabinet, and a modest inventory.

The player obtains information through dialogue, picks up a string and magnet, combines them, uses the combined item to recover a key, unlocks the cabinet, and gives its contents to the NPC. Include at least one incorrect item use and one conditionally unlocked dialogue option.

This scenario exercises the requested loop without requiring a full game.

| Acceptance check | Expected result |
| --- | --- |
| View scenery and an inventory item | Protagonist delivers readable, attributed observations; no approach by default |
| Choose Pick up or Use on a distant scene target | Reach its approach point, revalidate, then execute once |
| View an observable object with an unreachable approach point | Observation still works without walking |
| Interrupt movement | Previous pending interaction does not execute |
| Attempt an unreachable target | Clear response and no state changes |
| Combine two valid items | Correct inputs consumed once; output created once |
| Try an invalid pair | Feedback, inventory unchanged |
| Revisit a room | Collected items stay absent and opened objects stay open |
| Revisit dialogue | Conditions and visited-topic state remain correct |
| Save, quit, and load | Puzzle and inventory state restored at a valid location |
| Skip a sequence | Same consequential state as watching it |
| Use keyboard controls | Core hotspot, inventory, and dialogue interactions remain available |
| Build a second tiny scene | New content uses shared systems without editing runtime internals |
| Have one nontechnical creator author a complete adventure from a new project | Rooms, dialogue, puzzles, and a reachable ending created through tools; no code, manual data editing, or developer intervention |
| Export and reopen the project | Editable content and asset references survive the round trip |
| Run the exported game | Behavior matches editor preview and does not require the editor |

The final check is important: one successful demo alone does not establish that the framework is reusable.

## Original high-level sequence

The milestone gates and backlog in the [roadmap](05-roadmap.md) and [development plan](06-development-plan.md) refine and supersede this preliminary sequence.

### 1. Decide product boundaries

Creator audience and browser game delivery are decided. Confirm editor deployment, initial browser/device targets, preferred action interface, and project storage model. Record decisions and reasons.

### 2. Compare the leading foundations

Study selected Escoria features, then validate a TypeScript/Phaser runtime with one room, a hotspot, movement, and an inventory action. Include a minimal visual editor that writes project data and previews it through that runtime. Compare another browser rendering option only if the spike reveals a specific limitation.

Pin exact versions and record any compatibility or maintenance issues. Use observed outcomes rather than speculative performance scores.

### 3. Build the proof adventure

Implement the shared action contract, inventory combinations, conditional dialogue, durable room state, and standardized UI together with the creator controls needed to author them. Verify the acceptance table, including negative paths and the nontechnical creator workflow.

### 4. Extract the reusable package

Separate sample content from runtime and UI. Add starter templates, validation tools, debugging views, and concise author documentation. Validate that another small scenario can be authored without modifying the framework.

### 5. Expand only after evidence

Add richer dialogue tooling, localization workflows, touch/controller support, additional platforms, and optional modules according to actual game needs.

## Deferred scope

An initial visual creator is required for the proof. A full painting suite, advanced animation production, multiplayer, general RPG crafting, arbitrary minigame tools, multiple protagonists, console packaging, and a new scripting language are deferred. More scene and asset creation aids remain in product scope as staged additions.

## Principal risks

| Risk | Validation or mitigation |
| --- | --- |
| Framework grows before a game validates it | Build the proof adventure and a second content example early |
| Standard UI removes useful puzzle choices | Validate the selected explicit verb bar and distinct action rules against document 08's scenarios |
| State becomes scattered through scenes | Centralize durable state and verify room reconstruction |
| Save/load or skipping duplicates effects | Test inventory/state invariants across interruption and replay |
| Reference architecture carries unsuitable engine assumptions | Translate Escoria concepts into browser requirements rather than porting its internals |
| Engine export mistaken for platform readiness | Test actual input, audio, persistence, and packaging on target devices |
| Creator workflow remains too technical | Test room and dialogue authoring with the intended audience |

## Current decision record

- Confirmed by the user: 2D point-and-click adventure framework; standardized player UX/UI; actions, dialogue options, inventory, item use and combinations; Markdown planning; nontechnical creators; programmer maintainers; browser games; Escoria as a reference. Scene and asset tools may be included.
- Recommended, not approved: TypeScript/Phaser, browser visual creator, versioned project data, and a self-contained web export.
- Historical unresolved topics at the initial proposal: authoring deployment, browser/device targets, action UI, storage/hosting, and public versus internal distribution. Current working defaults are governed by the roadmap; document 08 now selects the explicit verb-bar approach for implementation and validation.
- Not yet done: engine spike, hands-on reference-game audit, performance measurements, implementation, or release estimates.

Additional confirmed requirement: independent end-to-end authoring by a single nontechnical person. Detailed acceptance steps are recorded in the [creator plan](04-browser-creator.md#prototype-success-criteria). Whether original media production must also be entirely in-app remains unresolved; asset import and supplied assets are the proposed initial baseline.
