---
name: pcag-quality-and-handoff
description: Validate PCAG feature and milestone gates, observe independent authoring, and prepare evidence-based release and maintainer handoffs. Use for behavioral testing, browser qualification, usability, and release readiness.
---

# PCAG quality and handoff

Read the [roadmap gates](../../../planning/05-roadmap.md), [validation strategy and release checklist](../../../planning/06-development-plan.md), and [independent authoring criteria](../../../planning/04-browser-creator.md). Treat these as acceptance sources, not evidence that checks have passed.

## Test the outcome at the right level

For M1/M2, use the regression scenarios in the [character and interaction specification](../../../planning/07-character-and-interactions.md). Include distant View without approach, reachable/unreachable physical actions, arrival revalidation, cancellation, and effects occurring exactly once after arrival. M0's characterless hotspot tests do not qualify third-person gameplay.

| Concern | Useful evidence |
| --- | --- |
| Domain behavior | Conditions/precedence, inventory conservation, one-time effects, dialogue transitions |
| Connected runtime | Interrupted approach, room reconstruction, skip equivalence, safe save/load |
| Data integrity | Valid/invalid references, archive round trips, migrations, last-good preservation |
| Browser workflow | Create/edit/preview/restart/reopen/export, keyboard operation, audio startup |
| Creator independence | Observed completion from a new project without programmer rescue |

Introduce checks with the behavior rather than deferring all validation to M4. Prefer observable invariants to implementation-shaped assertions or snapshots. During routine edits, run affected checks; run integrated gate workflows for milestones/releases. Capture actual commands and results, failures, and untested conditions. Never invent passing checks when a required environment is unavailable.

## Browser and accessibility qualification

Map gameplay checks to the requirement IDs and minimum behavioral cases in [player actions and UI](../../../planning/08-player-actions-and-ui.md). Check distinct verbs, one- versus two-target commands, explicit/quick-action equivalence, inventory conservation, input ownership, reset/cancel behavior, and keyboard destination selection. Suggested actions must not reveal hidden prerequisite success.

The proposed matrix is Chrome, Edge, Firefox on Windows and Safari on macOS. Record browser version, OS, artifact revision, tested workflow, result, and limitation. Untested browsers remain unqualified; another engine or OS is not evidence for Safari on macOS.

Check keyboard-only hotspot/inventory/dialogue/menu access, visible focus, readable subtitles/settings, and essential feedback without color/hover/audio dependence. Qualify creator controls as well as the player. Record measured project size, load time, and editor responsiveness using representative content and reproducible conditions before setting release limits.

## Independent authoring gate

Observe a nontechnical participant begin a new project with templates and supplied assets. They must create/connect rooms, configure the protagonist and hotspots, build item use and a combination, write conditional dialogue, connect consequences to an ending, playtest and fix an intentional authoring mistake, close/reopen, and export/play the game.

Documentation and built-in guidance are allowed. Bespoke code, manual data repair, or a developer completing a step fails the affected workflow. Log help requests, confusing labels, blockers, completion, and any assistance accurately; do not coach away evidence of a missing capability. Fix product gaps and repeat affected workflows. A single participant is the stated minimum, not proof for all audiences.

## Release and maintenance handoff

Use the development plan's release checklist as the authoritative list. Link each completed item to actual tests, artifacts, or observation notes. Include reproducible setup/build/check/export instructions, package boundaries, supported project/save versions, extension points, browser results, limits, asset permissions, example content, and known issues.

Keep artifact, example, changelog, and release version aligned. Report remaining blockers without marking their milestone complete. Distinguish a prepared release candidate from publication; public hosting is a separate action. For each development handoff, state backlog IDs completed, creator-visible behavior, changed contracts, checks and results, remaining risks, and the next dependency. Do not claim independent authoring passed merely because automated tests or the reference adventure passed.
