# Current-state review

Date: 2026-10-30. This is a code-and-document review of the current checkout, including uncommitted work. It does not replace a fresh full test run or user acceptance. The [use-case map](09-use-case-map.md) inventories creator, player, and maintainer tasks; the [roadmap](05-roadmap.md) and [development plan](06-development-plan.md) set gates.

## What exists now

| Area | Current implementation | Boundary |
| --- | --- | --- |
| Creator shell | Electron-hosted React editor; Welcome, Project, Assets, Characters, Scenes, Animations; Adventure Workbench visual system and local SVG icons | Desktop is the product direction; browser renderer remains useful for tests |
| Local projects | New/continue/import, recent folder, `workspace.json`, disk-backed asset folders, debounced writes, undo/redo, `.pcag` archive | Recovery, format migration, and release installer are not qualified |
| Project setup | Name, target resolution, starting scene, preview, editable archive and player ZIP export | Readiness checks cover the current schema, not future puzzle completion |
| Assets | Browse/preview, validated import, nested folder/file operations, drag/drop, clipboard, refresh | Reference-safe mutation and history need a complete audit |
| Scenes | Create/select/rename, background selection, element tree with add/clone/delete/order, canvas view | Element properties are read-only in the active inspector; canvas drawing, walk areas, approaches, and exits are absent |
| Characters | Optional character records, reference image, required/optional/custom animation slots, displayed height and mirroring | No playable actor placement or character rendering in the player |
| Animations | Desktop Python-backed loop selection, frame edits, background removal, pixel/palette controls, GIF/atlas export | Depends on local Python/OpenCV/NumPy/Pillow; distribution and cross-platform setup are unqualified |
| Player | Phaser room background and direct click-to-inspect elements; same room runtime used by preview and export | No walking protagonist, inventory, verbs, dialogue, world state, player save, or ending |
| Validation/tests | Versioned project validator, workspace checks, format/browser/desktop test suites | Tests prove the exercised paths only; the full current checkout has not received a fresh integrated gate |

Evidence: [Creator composition](../../apps/creator/src/app/CreatorApp.tsx), [workspace controller](../../apps/creator/src/app/useEditorWorkspace.ts), [project model](../../packages/project-format/src/index.ts), [runtime](../../packages/runtime/src/index.ts), [desktop bridge](../../apps/creator/electron/main.cjs), and [test inventory](../../tests/). The [v2 design boards](../design/README.md) are an implemented visual direction and a reference for further UI work; their existence is not product acceptance.

## Differences from the older plan

1. **Creator platform:** Electron desktop is now the creator host, per [decision 0003](../decisions/0003-electron-creator.md). Browser game export remains the player target. The older browser-creator proposal is historical context.
2. **F06 scope drift:** the old F06 review expected disabled Characters, Items, and Game Map placeholders. Characters and Animations are now active; Items and Game Map are not navigation entries. The user accepted F06 on 2026-10-30; its old walkthrough remains historical and needs refreshing.
3. **Implementation is ahead of its gate:** some R01-like asset/scene operations and R02-like character mapping exist. They have not passed R01/R02 acceptance and do not advance M1 by themselves.
4. **Element editor gap:** `ScenesView` renders selected element properties read-only. `ElementInspector` exists but is not mounted in the active scene view; its update helper targets element index 0. Correct this before claiming editable element authoring.
5. **Schema documentation drift:** project format v1 now permits optional characters and animation mappings. The format document and older F06 guide should be read as dated evidence until updated with the implementation.
6. **Animation tool boundary:** the desktop animation workflow has its own smoke test but relies on Python packages invoked from Electron. Its availability in a developer checkout does not establish a distributable creator.

## Decisions for the next development pass

- F06 was explicitly validated by the user on 2026-10-30. Refresh its dated walkthrough and keep any remaining integration gaps visible in the [validation log](../development/validation-log.md).
- Complete R01 as an **integrity and editing** package: selected-element properties are now editable; audit all rename/move/delete reference updates and undo/redo, and ensure disk writes and archive exports agree after these edits.
- Carry existing character/animation UI into R02 rather than rebuilding it. Add scene actor placement, logical feet position, walkable geometry, and separate approach points. Define how animation paths are validated and consumed by the player.
- Keep player execution in the shared runtime. R03 must prove movement, View speech, pending-action cancellation, and unreachable feedback in both preview and exported player before physical effects are added in M2.
- Consolidate editor styling and state boundaries during the affected work. The current broad stylesheet stack and large workspace/animation controllers are refactor candidates; change them behind behavioral checks, not as a stand-alone rewrite that delays the playable milestone.

## Acceptance remains open

F01-F06 and the M0 proof are accepted. R01 is in progress; R01 through U03 have no acceptance recorded. Approval of the visual direction remains design feedback, and M1 is not accepted. No first-release completion or supported platform matrix is claimed.
