# Development plan

Updated: 2026-10-30. F01-F06 and the M0 gate are **Accepted**. R01 is **In progress**; R02-U03 are **Not accepted**. Some implementation exists ahead of those gates. Preserve the ordered backlog and record acceptance separately from code presence. See the [current-state review](10-current-state.md), [use-case map](09-use-case-map.md), and [validation log](../development/validation-log.md).

Use the [roadmap](05-roadmap.md) for release scope and milestone gates. The earlier [architecture proposal](03-framework-plan.md) and [browser creator proposal](04-browser-creator.md) explain the original domain direction; [decision 0003](../decisions/0003-electron-creator.md) supersedes their creator-host recommendation. This document defines the execution backlog and engineering workflow.

The confirmed [character and interaction rules](07-character-and-interactions.md) govern R02–R04 and P02–P04: visible click-to-walk protagonist, character-spoken View, and arrival-gated Pick up/Use. M1 must implement movement, observation, and the validated approach boundary. Pickup/use effects remain M2 work.

The [player action/UI requirements](08-player-actions-and-ui.md) select the initial classic verb bar, sentence preview, inventory targeting, cancellation, and keyboard behavior. Its requirement IDs map to this backlog and supersede contextual-only UI defaults. Implement the usable Walk/View subset in M1, physical verbs/inventory in M2, and conversation/menu completion in M3.

## Current repository structure and intended boundaries

```text
apps/
  creator/              Electron-hosted React authoring application
  player/               Standalone browser player shell
packages/
  project-format/       Types, schemas, reference validation, migrations
  runtime/              Current Phaser room and inspection session
  editor-workspace/     Local workspace model, asset checks, starter content
  project-io/           Asset/archive handling, storage, export assembly
examples/
  reference-adventure/  Small maintained acceptance project
tests/
  integration/          Cross-package behavior and fixture projects
  browser/              Creator/player end-to-end workflows
docs/
  decisions/            Short architecture decision records
  planning/             Roadmap, backlog, use cases and current-state review
  development/          Setup, extension, testing, release instructions
```

These directories describe the current checkout. Add an adventure-core package only when movement, action state, inventory, or dialogue gives it concrete responsibilities. Keep authored rules and durable game state independent of React, Phaser, Electron, and storage. The creator and player must consume the same execution rules; project I/O supplies storage/export to both without entering the domain model.

For the first export, package a prebuilt player with validated content and assets. Creators should not need a compiler or hosted build service. Prototype that packaging path in M0 before relying on it.

## Development defaults

- Keep the pinned TypeScript/Phaser/React/Electron toolchain reproducible and qualify any version change through build and affected workflows.
- Use a schema version for authored projects and a separate version policy for player saves. Stable IDs survive renames and editor reordering.
- Treat project definitions, editor workspace state, and live play-session state as distinct data.
- Store declarative conditions/actions; do not execute arbitrary code embedded in imported projects.
- Centralize editor mutations as undoable operations. Preview runs against an isolated project snapshot.
- Validate structural data and domain references. Report errors with paths back to the relevant editor control.
- Keep asset import/export predictable: supported types, bounded archive extraction, normalized paths, explicit failure messages, and originals preserved where transformations occur.

These are proposed implementation constraints. Record material changes in a short decision file with context, choice, consequences, and validation evidence.

## Ordered backlog

Current item: **R01 integrity and editing**. The user validated F06 on 2026-10-30. The [2026-10-23 F06 guide](../development/f06-review.md) is dated evidence and no longer describes every visible view. Existing R01/R02-like code does not satisfy their complete gates. Execute the remaining items in dependency order.

| ID | Milestone | Work package | Depends on | Acceptance evidence |
| --- | --- | --- | --- | --- |
| F01 | M0 | Focused Escoria review and architecture decisions | — | Feature notes; agreed project/runtime boundaries and working UX defaults |
| F02 | M0 | Workspace, build, type checks, minimal test/CI setup | — | Creator/player build from documented setup; basic checks run |
| F03 | M0 | Minimal schema, stable IDs, diagnostics, sample fixture | F01, F02 | Valid room loads; invalid references identify the affected field |
| F04 | M0 | Shared renderer/runtime plus element inspector | F03 | Edit background/element/text, preview, restart without leaked state |
| F05 | M0 | Minimal project storage and playable export spike | F04 | Save/reopen; exported sample runs over HTTP independently of editor |
| F06 | Pre-M1 | Integrated desktop editor foundation and current navigation | F05 | Native new/continue/import, local files, Project/Assets/Scenes plus active Characters/Animations surfaces, archive/player export, and accurate view guidance are re-reviewed; no M1 gameplay is implied |
| R01 | M1 | Reference-safe room/asset editing and undoable operations | F06 | Selected-element properties are editable; new/import/rename/move/copy/delete/undo/reopen preserve IDs, references, bytes, and export parity |
| R02 | M1 | Spatial editing, actor placement, and animation mapping | R01 | Draw click bounds/walkable area, place protagonist with logical feet position, map and validate animations, and set separate approach markers |
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

## Next development sequence

1. **F06 closure:** accepted by the user on 2026-10-30. The older guide remains dated and should be refreshed as documentation work; character mapping is not playable character support.
2. **R01 integrity:** wire the selected element to an editable inspector, audit referenced asset operations and workspace undo/redo against disk, and verify multi-scene/character data survives reopen and export. Refactor the large editor controller or CSS only where this work benefits from clearer ownership; preserve behavior with targeted checks.
3. **R02 spatial authoring:** add canvas geometry, walkable areas/obstacles, protagonist placement, logical feet/pivot, and separate approach markers. Reuse the existing character/animation data after validating paths and runtime asset loading.
4. **R03 shared exploration runtime:** build click-to-walk, basic View speech, pending action cancellation/revalidation, and unreachable feedback. Compare preview and exported player for each behavior. Only then proceed to R04 two-room traversal.

The remaining P/D/B/U items retain their order and gates in the table. Finish each item's creator, data, runtime, persistence, and export path before claiming it complete.

## Architecture and UX work inside those items

| Concern | Next action | Gate |
| --- | --- | --- |
| Editor state | Split project lifecycle/persistence, history, selection, and export orchestration out of `useEditorWorkspace` as their behavior is touched; keep one mutation path and serialized disk writes | R01; reopen/export regression |
| Scene tools | Give the selected element a real editable inspector, then add canvas geometry tools with keyboard-reachable alternatives; maintain stable IDs through clone/order/delete | R01/R02; multi-element editing and save/reopen |
| Design system | Consolidate palette, spacing, focus, button, panel, icon, and motion rules from the current layered stylesheets into reusable tokens/components as affected screens change | F06/R01/B03; visual review at desktop and narrow widths |
| Character assets | Validate reference and animation paths at import/rename/export, and define the mapping from authored slots to runtime actor states | R01/R02; missing-file diagnostics and player loading |
| Desktop animation tool | Isolate processing requests from React view state, document Python requirements, and later package or replace the external processing runtime | R02/B03/U03; native smoke and packaged-app test |
| Shared game logic | Introduce a concrete adventure-core boundary for movement requests, pending actions, conditions, and effects; make Phaser an adapter and keep preview/export on one interpreter | R03 onward; domain and export-parity checks |
| Accessibility | Preserve visible focus, labeled controls, reduced motion, keyboard scene actions, readable status/feedback, and error navigation as each interaction ships | R02 onward; B03 qualification |

Avoid a broad architecture rewrite detached from these outcomes. Each refactor must leave the corresponding creator task and exported behavior demonstrably working.

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
- [ ] Player browser versions and desktop creator OS/installer/native-dialog/Python dependency limits are documented from actual tests.
- [ ] Starter assets have recorded origins and redistribution permissions.
- [ ] Creator guidance covers the complete new-project-to-export workflow.
- [ ] Maintainer documentation covers setup, architecture, tests, extension points, and release packaging.
- [ ] Project/save format versions and compatibility policy are documented.
- [ ] Release artifacts, example content, and changelog correspond to the same version.

Public hosting or publication is a separate release action; these documents do not claim that anything has been deployed.
