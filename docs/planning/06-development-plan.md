# Development plan

Date: 2026-10-21. Reset: 2026-10-22. Status: F01/F02 **Accepted**; F03 **In progress**; F04-U03 remain **Not started**. All 24 backlog items are retained. The first build and its evidence are historical; see [reset record](../development/rebuild-reset.md).

Use the [roadmap](05-roadmap.md) for release scope and milestone gates. The earlier [architecture proposal](03-framework-plan.md) and [creator proposal](04-browser-creator.md) explain the domain and UX. This document defines the execution backlog and engineering workflow.

The confirmed [character and interaction rules](07-character-and-interactions.md) govern R02–R04 and P02–P04: visible click-to-walk protagonist, character-spoken View, and arrival-gated Pick up/Use. M1 must implement movement, observation, and the validated approach boundary. Pickup/use effects remain M2 work.

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

Current status: **F01 Accepted** ([review guide](../development/f01-review.md)); **F02 Accepted** ([review guide](../development/f02-review.md)); **F03 In progress** ([review guide](../development/f03-review.md)); **F04-U03 Not started**. No previous completion or acceptance carries into the rebuild. IDs, scope, dependencies, and acceptance evidence below are unchanged. Execute one item at a time in listed order; dependencies and milestone gates still apply.

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

## Current development iteration

F01 and F02 are accepted. Work on **F03 only**: minimal project schema, stable IDs, structural/reference diagnostics, and a maintained sample fixture. Demonstrate valid room loading and field-level invalid-reference diagnostics before F04. Shared gameplay, hotspot editing, persistence, and export remain later items.

F02, F03, F04, and F05 follow separately, each with its own validation gate. Together they still deliver the full M0 creator-to-export proof. M0 is complete only after all five items are accepted and its integrated milestone gate passes.

## Per-item validation gate

Apply this process to every row in the backlog, from F01 through U03:

1. Set exactly one item to **In progress**. State its scope, acceptance scenarios, and relevant failure cases before implementation. Keep future items **Not started**.
2. Implement that item's complete scope. Internal tasks may help organize the work but do not remove, merge, or reduce any backlog item.
3. Run the checks appropriate to the item. Record exact commands or manual steps, expected and observed results, and any limitations. F01 uses reviewable research and decisions; later features require runnable demonstrations and relevant regression checks.
4. Set the item to **Awaiting user validation** only after its acceptance evidence is ready. Provide a concise review guide: what changed, how to try or inspect it, and what the user should observe.
5. Wait for the user's explicit acceptance of that item before marking it **Accepted** or starting the next item. Automated success alone is not acceptance. If changes are requested, return the same item to **In progress**, fix it, and repeat affected checks.
6. Record the user's acceptance and evidence link in the validation log. At the end of a milestone, also exercise its integrated gate; item acceptance does not replace milestone validation.

Use **Blocked** when a dependency or unresolved decision prevents progress, and record the reason. Do not advance past an unaccepted item. This sequential user review is the requested rebuild workflow.

The [validation log](../development/validation-log.md) tracks every item's status and evidence. Previous build evidence may inform a review but cannot count as a fresh pass. The feature checklist below applies as capabilities are introduced; do not build future features merely to check every box early.

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

Choose the next single backlog item. Implement, verify, present its acceptance evidence, and wait for user validation before advancing. Update the validation log and unresolved risks. Preserve all backlog items and the full release scope; reduce work in progress, not the backlog.

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
