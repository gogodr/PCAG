---
name: pcag-project-io
description: Implement PCAG asset import, local project storage, recovery, portable archives, playable exports, and player-save storage. Use for persistence and packaging integrity across creator and player.
---

# PCAG project I/O

Read [data, preview, and export](../../../planning/04-browser-creator.md), F05/B01/B02 in the [development plan](../../../planning/06-development-plan.md), and the [roadmap](../../../planning/05-roadmap.md). Local-first storage with explicit backup is the default; cloud accounts and publishing services are separate scope.

## Distinguish the artifacts

- **Editable project:** versioned authored content, manifest, and assets sufficient to reopen and continue editing.
- **Playable export:** prebuilt shared player, validated runtime content, and required assets; no creator dependency or development server.
- **Player save:** game identity/content compatibility, durable progress, and safe resume state; not an editable project.

Keep these operations and their user-facing results distinct. Define their formats and compatibility contracts with project-format/runtime owners.

## Storage and recovery

Prototype the browser storage API during M0, including failure behavior and actual target-browser support. Do not claim browser-managed storage is a permanent backup. Provide explicit project download/import and accurate dirty, saving, saved, and failed states. Show the last successful save rather than marking work saved when a write merely starts.

Stage imports/migrations and validate before replacing current work. Preserve the last good project and recoverable originals. Handle interrupted writes, quota/storage failures, malformed archives, missing assets, and unsupported versions with actionable messages. Recovery must avoid silently selecting an older revision without telling the creator.

## Asset and archive handling

Use stable asset references and portable normalized paths; keep browser object URLs transient. Define supported media types and release limits based on actual tests. Track references so deletion and export can account for all required assets, including conditionally used ones. Preserve originals when transformations are introduced.

Treat archive entries as untrusted data: reject traversal/absolute paths, ambiguous duplicate destinations, unsupported entries, and resources beyond documented extraction limits. Bound entry counts and decompressed sizes before committing imported data. Validate content structurally and semantically; imported project data must not execute arbitrary code. Report the offending file/entity where possible.

## Export workflow

1. Validate a stable project snapshot and resolve its asset dependency set. Fail clearly on blocking missing content.
2. Package it with the version-matched prebuilt player. Creators must not install a compiler or call a hosted build service.
3. Remove editor-only workspace/debug data while preserving all authored runtime meaning. Use relative asset URLs and a documented entry point.
4. Run the result over static HTTP independently of the editor, including a nested base path. Direct `file://` opening is not the target acceptance environment.
5. Compare the same interactions and consequences in preview and export. Supply hosting instructions without treating artifact generation as authorization to publish publicly.

## Evidence

From F05, verify save/reopen and the minimal export. As scope grows, verify editable archive export/import/export preserves semantics/assets, failed import leaves healthy work intact, recovery handles interrupted storage, and supported save versions restore correct progress. Include malformed/traversal/oversize archive fixtures and missing-asset cases when implementing archive handling. Document tested limits, compatibility behavior, and remaining failures; do not wait until M4 to discover that the packaging path cannot work.
