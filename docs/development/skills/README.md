# Development skills and handoff

Date: 2026-10-21. Reset: 2026-10-22. Status: retained capability guidance for the rebuild. Earlier M0/M1 implementation and evidence are archived; F01/F02 are accepted and F03 is in progress.

PCAG needs eight complementary capabilities. These are responsibilities, not eight required hires or separate agents. One developer can cover several. Each linked `SKILL.md` is a reusable instruction file for a developer or coding agent, with scope, constraints, workflow, and acceptance evidence.

## Start here

Read the [roadmap](../../planning/05-roadmap.md) and [development plan](../../planning/06-development-plan.md) before selecting a skill. They govern scope and sequencing; these skills explain how to execute their work. Historical decisions and evidence are reference material only; revalidate decisions for the current item. Resolve conflicts explicitly rather than silently replacing a product requirement.

The release outcome is independent creation of a complete small adventure by a nontechnical person. Runtime code alone does not satisfy it. Use the development plan's feature completion checklist for data, runtime, creator controls, undo, persistence, preview/export, regression coverage, and guidance.

For gameplay work, read the confirmed [character and interaction rules](../../planning/07-character-and-interactions.md): visible click-to-walk protagonist; View as character speech; Pick up/Use only after successful approach. M0's characterless hotspot player is a temporary proof. Runtime, presentation, creator, and quality responsibilities meet in R03 as well as later puzzle features.

The [player actions and UI requirements](../../planning/08-player-actions-and-ui.md) provide requirement IDs, verb semantics, the selected classic interface, and milestone-mapped acceptance cases. Use them for implementation assignments and reviews; the [reference study](../../research/03-classic-actions-and-controls.md) separates historical evidence from PCAG choices.

These files live in the repository so the entire handoff travels with the project. Give an agent the relevant file path explicitly; this pack does not assume automatic discovery or install anything into a developer's personal skill directory. Keep the repository-relative references with the files if moving the pack. No external plugins, paid services, or additional skills are required by these instructions.

## Capability map

| Skill | Expertise needed | Primary backlog responsibility | Main collaborators |
| --- | --- | --- | --- |
| [pcag-foundation](pcag-foundation/SKILL.md) | TypeScript architecture, browser integration spikes, build tooling, evidence-based decisions | F01–F02; integration of F03–F05 | All M0 skills |
| [pcag-project-format](pcag-project-format/SKILL.md) | Data modeling, schemas, semantic validation, compatibility | F03; data contracts across later items | Creator, runtime, project I/O |
| [pcag-adventure-runtime](pcag-adventure-runtime/SKILL.md) | State machines, transactional effects, dialogue, asynchronous cancellation | P01–P04, D01–D03 runtime behavior | Presentation, creator, format |
| [pcag-browser-presentation](pcag-browser-presentation/SKILL.md) | Phaser integration, 2D geometry/navigation, lifecycle, accessible player UX | F04, R02–R04; presentation for D02–D03 | Runtime, creator |
| [pcag-visual-creator](pcag-visual-creator/SKILL.md) | React/editor architecture, spatial tools, undo, approachable interaction design | F04, R01–R02; authoring side of P01–D03; B04 UI | Every feature owner |
| [pcag-project-io](pcag-project-io/SKILL.md) | Browser storage, assets, archive integrity, export assembly, recovery | F05, B01–B02; persistence from M0 onward | Format, creator, player |
| [pcag-adventure-content](pcag-adventure-content/SKILL.md) | Puzzle design, dialogue writing, templates, asset preparation, tutorials | P04 templates, D04, B04 guidance | Creator, validation |
| [pcag-quality-and-handoff](pcag-quality-and-handoff/SKILL.md) | Domain/browser testing, usability observation, accessibility, release evidence | B03, U01–U03; acceptance checks throughout | All skills |

Ownership overlaps intentionally: a backlog item is complete only when its integrated creator outcome works. Do not mark D01 complete after writing only its dialogue interpreter, for example.

For the optional sprite-generation tooling, use [stable-diffusion-prompting](stable-diffusion-prompting/SKILL.md) to review saved ComfyUI parameters, draft prompts from character references, and compare controlled pose-conditioned trials. It does not change the core backlog sequence.

## Development order

The groups below describe milestone scope, not batch assignments. Work on one backlog ID at a time and wait for explicit user validation before advancing, following the development plan.

1. **M0 / F01–F05:** Use foundation, format, presentation, creator, I/O, and quality together. Deliver background import, a room, an editable hotspot/inspection response, isolated preview, save/reopen, and standalone playable export. Runtime work is limited to the inspection path. Do not build full dialogue or pathfinding first.
2. **M1 / R01–R04:** Expand creator, runtime, and presentation for a visible protagonist, click-to-walk, character-spoken View, approach/cancellation, connected rooms, supported navigation geometry, animation mapping, undo, and reopen. Keep format and I/O involved as the model grows.
3. **M2 / P01–P04:** Add typed puzzle facts, actions, inventory, combinations, and durable consequences with matching visual controls. Introduce content templates and invariant tests.
4. **M3 / D01–D04:** Add dialogue, sequences, ending, accessible controls, and safe player saves. Author and complete the reference adventure and a second puzzle using the tools.
5. **M4 / B01–B04:** Harden recovery, compatibility, exports, browser qualification, onboarding, and diagnostics using the full workflows.
6. **M5 / U01–U03:** Observe independent authoring, fix blockers, repeat affected workflows, and prepare a maintenance handoff. Public publication remains a separate action.

## Shared contracts to settle during implementation

These are decision topics, not pre-existing APIs. Agree on the smallest contract needed for the current slice and document it near its owner.

| Boundary | Contract to define | Owner |
| --- | --- | --- |
| Project to consumers | Version, stable IDs, authored records, diagnostics with entity/field locations | Project format |
| Player UI to core | Actor, action, optional source item, target; structured success/failure feedback | Adventure runtime |
| Core to presentation | Requests/events, completion/cancellation, input ownership, teardown | Runtime + presentation |
| Creator to project | Undoable edits, reference-aware deletion, isolated preview snapshot | Visual creator |
| Application to storage | Save result, last successful revision, staging/recovery, archive result | Project I/O |
| Core to player save | Durable state, content identity/version, safe resume point, compatibility | Runtime + project I/O |

## Ready-to-use next assignment

> F01/F02 are accepted. Execute F03 only: minimal authored project schema, stable IDs, diagnostics, and maintained valid/invalid fixtures. Use pcag-project-format guidance. Verify valid room loading, field-level errors, rename/reorder identity, and serialization. Present results and wait for acceptance before F04; do not introduce editor mutations, shared gameplay, storage, or export early.

For later assignments, identify backlog IDs, the intended creator outcome, relevant skill paths, existing decisions, and acceptance scenarios. Hand back changed artifacts, executed checks/results, untested limits, and next dependencies. Update milestone status only with evidence. No dates or staffing estimates are implied by this pack.

## Decisions still requiring evidence

TypeScript/Phaser/React, a browser creator, local persistence, and desktop browser priorities are working defaults; archived M0 evidence describes the previous build and does not validate the rebuild. The classic verb bar and document 08's detailed control policies are selected implementation defaults awaiting usability evidence. Navigation representation, migration mechanics, detailed APIs, and performance limits remain engineering decisions. Cloud services, collaboration, AI asset generation, a painting suite, mobile/controller expansion, and a new scripting language are outside the initial release scope.
