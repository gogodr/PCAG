# Product roadmap

Date: 2026-10-21. Reset: 2026-10-22. Status: M0 in progress; F01/F02 accepted and F03 in progress. Full milestone and release scope retained; every backlog item requires individual validation before the next begins.

## Release objective

One nontechnical person can start a new project, author a complete small 2D adventure, test and correct it, save/reopen it, and export a playable browser game using the provided tools. No programming, terminal commands, manual project-file editing, or developer intervention is required of the creator.

Build runtime and creator capabilities together. A feature is not complete merely because a programmer can invoke it.

Confirmed gameplay clarification (2026-10-22): a visible protagonist moves by scene clicks. View produces the character's observation; Pick up and Use require reaching the target before execution. See [character and interaction rules](07-character-and-interactions.md). The direct-hotspot M0 prototype does not satisfy this character-led gameplay requirement.

## Initial release boundary

The first release supports a single protagonist, multiple connected rooms, NPCs, hotspots, movement, explicit adventure verbs, inventory, item use/giving/combinations, conditional dialogue, puzzle state, short scripted sequences, a reachable ending, and player saves. Creators can import supplied or original assets and configure all these features visually. The [player action/UI specification](08-player-actions-and-ui.md) defines the vocabulary and acceptance requirements derived from classic-adventure references.

Working defaults:

- Browser creator and browser player; desktop mouse/keyboard first.
- TypeScript adventure core, Phaser presentation, React creator interface; validate and pin versions in M0.
- One standard classic verb bar with View, Pick up, Use, Talk to, Give, Open, Close, Push, and Pull; default Walk mode; sentence preview and inventory. A contextual quick action supplements explicit selection. Detailed controls are implementation defaults to validate, as specified in document 08.
- Local project persistence with explicit backup/import/export; no account requirement.
- Portable editable project archive and a separate static-hostable playable export.
- Supplied starter artwork/audio and asset import. Full original-media creation is not a release requirement.
- Browser targets proposed for qualification: Chrome, Edge, Firefox on Windows and Safari on macOS. Record actual tested versions; untested browsers are not claimed as supported.

These defaults resolve implementation sequencing without changing the confirmed product goal. Adjust them if prototype evidence reveals a problem, and record the reason.

## Milestones

| Milestone | Outcome | Completion gate | Depends on |
| --- | --- | --- | --- |
| M0 — Foundation proof | A room authored in a minimal editor runs through the shared browser runtime | Edit a hotspot, preview it, export it, and run the export; record stack and browser findings | None |
| M1 — Rooms and exploration | Creators build and connect traversable rooms | Two rooms authored visually; movement, exits, approach/cancel, animation setup, and project reopen work | M0 |
| M2 — Items and puzzles | Creators build state-dependent interactions | A visually authored item puzzle supports collection, combination, item use, and persistent world changes | M1 |
| M3 — Complete adventure alpha | Creators connect dialogue and puzzles into a finished game | Full two-room reference adventure is authored through tools and completed in preview and export | M2 |
| M4 — Reliable creator beta | Creators can recover, debug, save, and distribute their work | Recovery, validation, player saves, export round trips, and target-browser checks pass | M3 |
| M5 — Independent authoring release | A nontechnical person builds their own small adventure | End-to-end authoring test passes without developer rescue; documented release checks pass | M4 |
| M6 — Expansion | Improve creation speed and broaden supported games | Prioritize from observed creator needs; each addition preserves existing project compatibility | M5 |

Dependency path: **M0 → M1 → M2 → M3 → M4 → M5**. Persistence, accessibility, export, and usability work begin early and deepen through these milestones; they are not postponed wholesale to M4.

## M0 — Foundation proof

Study selected Escoria approaches to actions, room state, inventory, and UI boundaries. Record observations separately from our design choices. Build a minimal project schema, a browser player, and an editor with background import, one hotspot, and editable inspection text.

Use the same runtime in preview and a minimal playable export. Demonstrate that preview does not mutate authored content. Test repeated preview startup/shutdown, browser audio initialization, and the proposed persistence mechanism.

Exit evidence: working sample, version-pinned dependency list, short architecture decisions, and a list of measured browser constraints. If Phaser or the proposed editor integration fails a required workflow, resolve that before growing the system.

## M1 — Rooms and exploration

Deliver room creation, layers, entity placement, hotspot geometry, a constrained walkable-area editor, entrances/exits, approach points, character placement, and idle/walk/talk animation mapping. Add project save/reopen, asset reference tracking, undo/redo, and basic validation alongside editing.

The protagonist must visibly walk to clicked destinations. Add basic character-attributed View speech in this milestone; full conversations remain M3. Approach points are distinct from object click bounds. Establish the pending physical-action pipeline, cancellation, and unreachable feedback here, then connect real pickup/use effects in M2.

Exit evidence: a creator can build two connected rooms, place a visible character, click to walk around supported obstacles and between rooms, View an object through the protagonist's observation, cancel a pending approach action, and reopen the project without manual fixes. View works without an approach by default. Out-of-bounds and unreachable movement/approach targets produce understandable feedback.

## M2 — Items and puzzles

Deliver item definitions, inventory UI, pickup/use/give/combine rules, typed facts, conditions, ordered action cards, fallback responses, and durable room state. Provide starter behaviors such as collectible, locked object, and item combination.

Deliver distinct Open/Close/Push/Pull rules through the same action runner. Complete source-item/target command composition and explicit physical verbs in the player UI; do not collapse them into generic Use. Talk to becomes functional with M3 conversations. M1 exposes the implemented Walk/View subset.

Exit evidence: visually author the string/magnet/key puzzle. Incorrect combinations preserve inventory; correct combinations commit once; revisiting rooms preserves consequences. Rename and delete operations maintain or flag references through the editor.

Pickup and scene-object Use must wait for arrival and revalidation. An unreachable or canceled approach cannot collect an item, consume inventory, or change puzzle state. Inventory-only inspection and combinations do not require a scene walk. Verify these cases in preview and export.

## M3 — Complete adventure alpha

Deliver dialogue options, conditions and visited topics, speaker/text presentation, sound/animation commands, sequence skipping, input modes, and a configurable ending. Add standard menus, basic player save/load at safe boundaries, and baseline keyboard access and text settings.

Exit evidence: build the full reference adventure through creator tools, including its NPC conversation, conditional choice, item handover, and ending. Complete it in preview and exported form. A second small puzzle uses the same systems without runtime changes.

## M4 — Reliable creator beta

Harden autosave/recovery, archive import/export, invalid-project handling, player saves, compatibility/version messages, error navigation, and browser behavior. Verify relative asset URLs on static hosting and remove editor-only data from playable exports. Add a guided starter project and a creator walkthrough.

Exit evidence: close/reopen and backup/restore preserve work; failed imports do not overwrite a healthy project; player saves restore puzzle state; unsupported versions fail clearly. Core workflows pass the declared browser matrix. Record representative project size, load time, and editor responsiveness to set realistic release limits.

## M5 — Independent authoring release

Observe a nontechnical participant start a new project with templates and supplied assets, invent a small adventure, author it, fix an intentional authoring mistake, reopen it, and export/play it. Documentation is allowed. Bespoke developer fixes, manual data repair, or a programmer finishing a step fail the test.

Record blockers and guidance requests; fix product gaps and repeat affected workflows. Publish supported scope, browser versions, known limits, creator documentation, and programmer maintenance instructions. Complete the release checklist in the [development plan](06-development-plan.md).

A single successful participant satisfies the stated minimum acceptance case; it is not proof that every nontechnical audience will find the tools easy. Broader usability testing can continue after that gate.

## M6 — Expansion candidates

Prioritize asset cropping/pivots, sprite-sheet slicing, animation previews, reusable scene/object templates, richer dialogue tools, localization workflows, touch/controller support, and stronger diagnostics according to observed needs.

Cloud storage/publishing, collaboration, AI-assisted assets, multiple protagonists, and richer puzzle modules require separate scope decisions. A painting suite, general RPG crafting, multiplayer, and a new scripting language are not on the initial release path.

## Scheduling and progress tracking

Use milestone gates rather than calendar promises until M0 establishes the stack and development capacity. Staffing, available time, and velocity are not yet known, so no defensible release date is set.

After M0, estimate backlog items using observed completion time and publish a rolling forecast for the next milestone. Re-estimate at each gate; track runtime, creator, validation, and documentation work together. Larger milestones may span several iterations.

Progress **2026-10-22**: **M0 in progress**, F01/F02 accepted and F03 in progress; later milestones remain Not started. The first implementation is historical input available in Git at `fdc0bda`, not current acceptance evidence. All 24 backlog items remain in the [development plan](06-development-plan.md). Implement, verify, and obtain user validation for each item before advancing. Track results in the [validation log](../development/validation-log.md).
