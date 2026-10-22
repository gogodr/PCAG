# Development plan

Date: 2026-10-21. Progress updated: 2026-10-22. Status: F01–F05 and R01–R04 implemented; M0/M1 gates passed in the recorded local environment. See [M1 results, limitations, and next handoff](../development/m1-evidence.md). P01–U03 remain not started.

Use the [roadmap](05-roadmap.md) for release scope and milestone gates. The earlier [architecture proposal](03-framework-plan.md) and [creator proposal](04-browser-creator.md) explain the domain and UX. This document defines the execution backlog and engineering workflow.

The confirmed [character and interaction rules](07-character-and-interactions.md) govern R02–R04 and P02–P04: visible click-to-walk protagonist, character-spoken View, and arrival-gated Pick up/Use. M1 implements movement, observation, and the validated approach boundary. Pickup/use effects remain M2 work.

The [player action/UI requirements](08-player-actions-and-ui.md) select the initial classic verb bar, sentence preview, inventory targeting, cancellation, and keyboard behavior. Its requirement IDs map to this backlog and supersede contextual-only UI defaults. Implement the usable Walk/View subset in M1, physical verbs/inventory in M2, and conversation/menu completion in M3.

## Proposed repository structure

```text
apps/
  creator/              Visual authoring application
  player/               Standalone browser player shell
packages/
  project-format/       Types, schemas, reference validation, migrations
  adventure-core/       Actions, conditions, state, inventory, dialogue
  presentation/         Phaser integration and standard player interface
  project-io/           Asset/archive handling, storage, export assembly
examples/
  reference-adventure/  Small maintained acceptance project
tests/
  integration/          Cross-package behavior and fixture projects
  browser/              Creator/player end-to-end workflows
docs/
  decisions/            Short architecture decision records
  creator/              User-facing tutorials and reference
  development/          Setup, extension, testing, release instructions
```

Create these as needed, not as empty abstractions. The core depends on the project format and explicit service interfaces, not React, Phaser, or browser storage. Presentation adapts core events to media/UI. Creator and player share the core and presentation. Project I/O supplies storage/export to the applications without making the core depend on those applications.

For the first export, package a prebuilt player with validated content and assets. Creators should not need a compiler or hosted build service. Prototype that packaging path in M0 before relying on it.

## Development defaults

- Select and pin a coherent TypeScript/Phaser/React toolchain during M0. Verify compatible stable versions before installation rather than copying a version from research notes.
- Use a schema version for authored projects and a separate version policy for player saves. Stable IDs survive renames and editor reordering.
- Treat project definitions, editor workspace state, and live play-session state as distinct data.
- Store declarative conditions/actions; do not execute arbitrary code embedded in imported projects.
- Centralize editor mutations as undoable operations. Preview runs against an isolated project snapshot.
- Validate structural data and domain references. Report errors with paths back to the relevant editor control.
- Keep asset import/export predictable: supported types, bounded archive extraction, normalized paths, explicit failure messages, and originals preserved where transformations occur.

These are proposed implementation constraints. Record material changes in a short decision file with context, choice, consequences, and validation evidence.

## Ordered backlog

Current status: **F01–F05 complete** for M0 and **R01–R04 complete** for constrained M1 exploration, with evidence linked above. **P01–U03 not started**. IDs are stable so implementation work and issues can refer to them. Dependencies below identify major prerequisites; milestone ordering still applies.

| ID | Milestone | Work package | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- |
| F01 | M0 | Focused Escoria review and architecture decisions | — | Feature notes; agreed project/runtime boundaries and working UX defaults |
| F02 | M0 | Workspace, build, type checks, minimal test/CI setup | — | Creator/player build from documented setup; basic checks run |
| F03 | M0 | Minimal schema, stable IDs, diagnostics, sample fixture | F01, F02 | Valid room loads; invalid references identify the affected field |
| F04 | M0 | Shared renderer/runtime plus hotspot inspector | F03 | Edit background/hotspot/text, preview, restart without leaked state |
| F05 | M0 | Minimal project storage and playable export spike | F04 | Save/reopen; exported sample runs over HTTP independently of editor |
| R01 | M1 | Room/asset library and undoable editing operations | F05 | New/import/rename/delete/undo/reopen behave consistently |
| R02 | M1 | Spatial editing and character animation mapping | R01 | Draw hotspot/walkable area, place visible actor with feet anchor, map animations, and set separate approach markers |
| R03 | M1 | Click-to-walk, approach, character observations, cancellation | R02 | Visible actor routes around an obstacle; View speaks without approach; unreachable/canceled approaches execute no pending effect |
| R04 | M1 | Exits, entry points and room lifecycle | R03 | Two visually authored rooms connect and return correctly |
| P01 | M2 | Typed facts, conditions, distinct verb rules, precedence, action runner | R04 | Author conditional Open/Close/Push/Pull/Use responses; ambiguous rules reported; physical effects wait for arrival |
| P02 | M2 | Inventory, item editor, and verb/source/target UI | P01 | Explicit verbs and sentence preview work; Pick up/Use/Give wait for arrival; refusals and canceled approaches preserve inventory |
| P03 | M2 | Combination rules and atomic inventory effects | P02 | Valid pair commits once; invalid/canceled pair loses nothing |
| P04 | M2 | Durable world changes and behavior templates | P03 | Key puzzle survives room reload; templates remain editable |
| D01 | M3 | Dialogue runtime and visual authoring | P04 | Conditional option, visited topic, choice effect, return/exit work |
| D02 | M3 | Sequences, input modes, audio/animation and skip | D01 | Skip and full playback yield equivalent consequential state |
| D03 | M3 | Ending, menus, basic player saves and accessible controls | D02 | Complete game, reload progress, operate core UI with keyboard |
| D04 | M3 | Reference adventure and second puzzle | D03 | All content authored through tools; preview/export behavior agrees |
| B01 | M4 | Autosave recovery, backup/archive round trip, version handling | D04 | Failure recovery preserves last good project; import diagnostics actionable |
| B02 | M4 | Harden export and player-save compatibility | B01 | Static-hosted build and supported saves survive documented update paths |
| B03 | M4 | Browser matrix, responsiveness and accessibility qualification | B02 | Recorded results and explicit supported limits |
| B04 | M4 | Onboarding, creator guide and actionable diagnostics | D04 | A tutorial can be followed without developer setup or file editing |
| U01 | M5 | Independent authoring observation | B03, B04 | Participant completes end-to-end creation without developer rescue |
| U02 | M5 | Resolve usability blockers and repeat affected tests | U01 | Previously blocked workflows pass; no manual repairs hidden in process |
| U03 | M5 | Release candidate and maintenance handoff | U02 | Release checklist complete; tagged artifacts and known limits documented |

## First development iteration

Complete F01–F05 as one thin end-to-end proof. Its deliverable is a creator with asset import, a room canvas, one editable hotspot and inspection response, a Play button, project reopen, and a minimal playable export.

Execution order:

1. Record project-format, preview, storage, and export decisions; restrict the proof to the smallest data model that exercises all four.
2. Establish the workspace and a sample project fixture with validation.
3. Render the fixture in the standalone player and execute inspection through the action contract.
4. Build creator controls that produce the same fixture format without hand-editing data.
5. Integrate preview with isolated play state and reliable teardown.
6. Save/reopen and export the project; run the exported player on a local static HTTP server.
7. Capture browser checks, remaining risks, and implementation effort; update M1 estimates.

This proof intentionally precedes full pathfinding and inventory. Its purpose is to prove that authoring, runtime, persistence, and delivery form a complete loop. Do not replace the creator controls with a programmer-only demo to call M0 complete.

## Feature completion checklist

Each supported feature must have:

- Authored data and validation rules.
- Runtime behavior, including invalid and interrupted actions where relevant.
- Creator controls, meaningful defaults, and undo/redo for edits.
- Project save/reopen and preview behavior.
- Export behavior consistent with preview.
- A meaningful regression check and concise user guidance.

Use the checklist at the feature level; avoid separate runtime and editor backlogs that allow one side to remain indefinitely unfinished.

## Validation strategy

| Level | What to verify | Timing |
| --- | --- | --- |
| Domain tests | Rule conditions, precedence, inventory conservation, one-time effects, dialogue state | When the corresponding behavior is introduced |
| Integration tests | Movement-to-action cancellation, sequence skipping, room reconstruction, save/load | When systems connect |
| Project/archive tests | Validation, asset references, round trips, failed import preservation, migrations | From F05 onward |
| Browser workflows | Create/edit/preview/reopen/export; keyboard interaction and audio startup | Minimal workflow in M0; expand each milestone |
| Human authoring tests | Discoverability, terminology, ability to fix errors, independent completion | Small observations during development; full gate in M5 |

Tests should protect observable behavior and data integrity. Do not substitute component snapshots or duplicated implementation logic for exercising actual authoring workflows. Test only relevant changes during routine development; run the full release workflow for milestone/release gates.

The reference adventure is a maintained regression fixture. The independent authoring exercise starts from a new project and must not be preconfigured to hide gaps.

## Iteration and change management

Choose the smallest set of backlog items that produces a demonstrable creator outcome. Implement, verify, show the outcome, then update status and unresolved risks in this plan. Record evidence links such as tests, example projects, or observation notes.

New requests enter one of three categories: required to satisfy the current milestone, needed before release, or expansion. Do not silently expand the release with cloud services, a general art suite, or a new scripting language.

Do not create a second runtime for previews, require a development environment for creators, or solve recurring authoring failures by manually repairing project data. Those shortcuts undermine the release objective.

## Release checklist

- [ ] Independent authoring acceptance passes from a new project.
- [ ] The complete reference adventure passes in preview and playable export.
- [ ] Project backup/import and player save/load pass, including documented failure cases.
- [ ] No known data-loss defect or blocker remains in supported authoring workflows.
- [ ] Export runs on static HTTP hosting without the editor or development services.
- [ ] Browser versions, project limits, and accessibility limitations are documented from actual tests.
- [ ] Starter assets have recorded origins and redistribution permissions.
- [ ] Creator guidance covers the complete new-project-to-export workflow.
- [ ] Maintainer documentation covers setup, architecture, tests, extension points, and release packaging.
- [ ] Project/save format versions and compatibility policy are documented.
- [ ] Release artifacts, example content, and changelog correspond to the same version.

Public hosting or publication is a separate release action; these documents do not claim that anything has been deployed.
