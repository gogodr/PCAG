# 0001 — Rebuild foundation boundaries and working defaults

Date: 2026-10-22. Status: Proposed; awaiting F01 user validation. Supersedes historical implementation choices for the rebuild only. Governing scope: [development plan](../planning/06-development-plan.md), [roadmap](../planning/05-roadmap.md), and confirmed [character](../planning/07-character-and-interactions.md) / [player UI](../planning/08-player-actions-and-ui.md) requirements. Evidence: [fresh Escoria review](../research/04-escoria-f01-review.md).

## Context

A nontechnical creator must author, test, reopen, and export a complete small adventure. One implementation must govern preview and exported play. F01 settles boundaries and reviewable defaults; it does not establish runtime correctness or toolchain compatibility.

## 1. Project model and ownership

Choose versioned declarative project data with stable entity/asset IDs, separate from display names, array order, and filesystem paths. Structural and cross-reference validation produce diagnostics with entity IDs and field paths that the editor can navigate. Validate at load, preview, and export boundaries. Treat imported content as data, never executable scripts.

| Data | Owner | Lifetime / examples |
| --- | --- | --- |
| Authored project | Project format; creator applies edits | Rooms, assets, initial values, hotspot bounds, text; later actors, rules, dialogue |
| Editor workspace | Creator | Selection, panel state, undo history, unsaved revision; excluded from playable content |
| Durable play state | Adventure core | Session facts, ownership, object changes, visited dialogue; later serialized at safe save points |
| Transient play state | Core for pending work/input mode; presentation for resources | Pending action identity, movement/speech completion, renderer handles; never serialized as project data |
| Player-save envelope | Core defines state; project I/O serializes | Separate save version, project/content identity, safe resume state; introduced in D03 |

Use the proposed packages as ownership boundaries, creating directories only when code needs them:

| Module | Responsibility and allowed direction |
| --- | --- |
| `project-format` | Data types, schema, reference diagnostics; no app, renderer, or storage dependency |
| `adventure-core` | Session, semantic requests, conditions/effects; depends on format and explicit service contracts, never React, Phaser, DOM, storage, or an app |
| `presentation` | Phaser scene/media adapters and semantic player controls; consumes core/format, owns presentation cleanup |
| `project-io` | Asset resolution, storage, archives, packaging; consumes format and serializable contracts, never app code or renderer instances |
| `creator` | Authoring forms/canvas overlays, undoable changes, persistence orchestration and preview host |
| `player` | Load validated content/assets and mount shared core/presentation; never import creator code |

Core-owned service contracts allow movement/speech requests and explicit completed/canceled/failed results; presentation implements them. UI selection submits semantic requests rather than directly changing inventory or flags. Exact APIs are deferred to the first feature that uses them.

Alternative: let engine scenes or generated scripts be the source of truth. Rejected because round-trip visual editing, diagnostics, independent tests, and portability would become tied to renderer internals. Cost of the chosen model: maintain validators and adapters together with every feature. F03 validates IDs/references; later items extend the model incrementally, not with a speculative full schema now.

## 2. Session and action lifecycle

Preview starts from a validated isolated project snapshot and fresh session. Edits made after starting a preview take effect on explicit restart, not by silently changing the running session. Stop/restart invalidates pending work, unsubscribes inputs, stops media, disposes renderer resources, and releases asset handles. Late callbacks cannot affect a replacement session. Export mounts the same core and presentation through a smaller host.

From M1, each pending approach has a current request identity scoped to its session/room. A new action, Cancel, room change, or teardown invalidates it. Arrival must match that identity and recheck target, ownership, conditions, and distance before effects execute once. View interrupts an interruptible approach and speaks from the current position. During consequential execution, use declared boundaries rather than promising rollback of already committed effects.

M0 implements only direct inspection and isolated sessions. R03 proves the approach boundary using a fixture; P01–P04 add actual puzzle effects and atomic inventory changes. D02 verifies equivalent consequential state for skipped and watched sequences. Durable room reconstruction is separate from renderer teardown.

Alternative: a simplified preview interpreter or shared mutable project/session object. Rejected because it risks preview/export drift and playtest changes leaking into authored content. Consequence: explicit lifecycle/disposal testing in F04/F05, followed by interruption tests in R03/R04.

## 3. Local persistence and compatibility

Choose local-first editing with explicit save status, reopen, and downloadable editable backup; no account is required. A failed save/import must preserve the last good project. Validate imported data and assets in staging before replacing active work. Track the last successfully saved revision; do not show success before persistence completes.

IndexedDB is the candidate store for project records/assets, to evaluate in F05. The exact store and minimal backup representation remain open until that spike; the old localStorage/embedded-image design is historical evidence of tradeoffs, not a requirement. The release archive should separate versioned content and assets, with normalized paths and bounded extraction. F05 must record any temporary simplification and its compatibility path to B01.

Project-schema versions and player-save versions are distinct. Initially reject unsupported versions with actionable feedback; never silently reinterpret them. Any supported migration preserves the original. M0-to-M1 expansion must retain `inspect` and explicitly request missing actor/navigation content rather than fabricate it.

Alternative: cloud-first storage or browser storage as the only copy. Neither satisfies the chosen account-free, portable workflow. Consequences: quota, interrupted writes, damaged imports, asset integrity, and recovery must receive fresh F05/B01 evidence. No persistence or capacity guarantee is made in F01.

## 4. Playable export and stack

Retain TypeScript core, Phaser presentation, React creator, and a browser-based desktop-first workflow as working defaults. F02 chooses compatible stable versions and build tooling from current official sources and pins the tested set. This record selects no package versions and installs nothing.

Maintainers build a version-matched player template. Creator export validates content and packages that prebuilt player with content and required assets using relative URLs. Creators need no compiler or hosted build service. Editable backup and playable export are distinct products. The game runs on static HTTP hosting independently of the creator; direct `file://` loading is not the acceptance path. Export does not publish anything.

Alternative: compile per export on a server. Rejected for the initial declarative format because it introduces an unnecessary service/account dependency. Consequences: template/content compatibility must be checked and the final ZIP exercised independently, including a nested hosting path, in F05. Browser support and performance remain unqualified until measured; B03 owns the full matrix.

## 5. Working UX

The confirmed behavior and selected defaults in documents 07/08 govern; Escoria is not the UI specification.

| Experience | Default / implementation boundary |
| --- | --- |
| Creator | Room library, scene canvas, selected-object inspector; readable fields and typed rule cards, actionable diagnostics, undoable edits. F04 begins with background/hotspot/View text; R01 expands operations. |
| Player layout | Scene above sentence preview, visible verb controls and inventory below. Show only working controls at each milestone. M0 has direct inspection; M1 introduces Walk/View. |
| Protagonist | Visible from M1, feet anchor and idle/walk/talk mappings; click bounds and approach markers remain separate. |
| View | UI label for `inspect`; character-attributed speech, no approach by default, including an observable target with an unreachable approach. |
| Physical verbs | Pick up, Use, Give, Open, Close, Push, Pull require arrival/revalidation for scene targets. Separate semantic rules; never silently collapse to Use. Talk to approaches by default when conversations arrive in M3. |
| Composition | Walk is default; sentence previews source/target without executing. Owned-item selection composes Use. Invalid combinations/refused gifts preserve ownership. |
| Cancellation | New action/ground destination replaces an interruptible approach. Escape/visible Cancel cancel selection or pending work; completion/rejection returns to Walk. Context-dependent right-click follows INPUT-03/04, with a visible keyboard equivalent. |
| Access and feedback | Semantic focusable controls, visible focus, target labels, readable speech and distinct failure feedback. Keyboard destination marker begins in R03; full controls/settings complete D03 and are qualified in B03. |

Alternative: contextual-only interaction. Rejected because explicit verbs and distinct authored responses are selected requirements. Consequence: command composition and cancellation need usability evidence; U01/U02 must observe independent authoring rather than assume familiar controls are sufficient.

## Open questions and required evidence

| Question | Working direction | Resolve / demonstrate |
| --- | --- | --- |
| Exact toolchain and workspace layout? | Smallest coherent setup; no published packages needed initially | F02: official release compatibility, pinned install, creator/player build/check commands |
| Minimal schema and diagnostic shape? | Stable IDs and entity/field locations | F03: valid fixture, invalid references, duplicate IDs |
| Canvas/DOM integration and cleanup? | Shared scene presentation plus accessible semantic controls | F04: repeated preview/restart, no content mutation or stale callbacks |
| Storage backend and initial backup container? | Evaluate IndexedDB; portable backup mandatory | F05: save/reopen, failed import preservation, export prototype; B01 hardens recovery |
| Navigation geometry and arrival tolerance? | Constrained authorable geometry; reject unsupported shapes explicitly | R02/R03: obstacle routing, unreachable destinations, cancellation; no algorithm chosen here |
| Rule precedence and transaction boundary? | Deterministic rules; ambiguity diagnostic; atomic inventory effects | P01/P03: competing rules and interrupted/invalid combinations |
| Safe-save and migration mechanics? | Save at stable boundaries; preserve originals | D03, B01/B02: reload, deferred save, incompatible content and supported migrations |
| Usability, browser limits, public hosting? | Desktop first, imported/supplied media; no publishing in F01 | B03/U01 qualify behavior; hosting remains a separate user action |

These questions do not prevent review of F01 boundaries. They prevent claiming those future behaviors already work. Acceptance of F01 approves this direction and its deferred experiments, not an implementation or an M0 pass.
