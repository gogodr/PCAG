---
name: pcag-project-format
description: Design or change PCAG authored data, stable references, schema validation, semantic diagnostics, and project/save compatibility contracts. Use when a feature introduces or changes persisted data.
---

# PCAG project format

Read the [development defaults](../../../planning/06-development-plan.md) and [proposed content model](../../../planning/03-framework-plan.md). Consult the current milestone in the [roadmap](../../../planning/05-roadmap.md); the full model is a destination, not an M0 schema checklist.

## Model ownership

Maintain three distinct categories: authored definitions, editor workspace state, and live player state. A cabinet opened during preview changes play state only. Durable references use stable IDs; names, array positions, scene paths, and transient object URLs are not durable identity. Renaming or reordering must not break a rule, save reference, or dialogue destination.

Represent conditions and commands as bounded declarative data. Do not require authors to edit JSON or embed executable JavaScript. Keep format types consumable without importing renderer or UI code. Reuse validation across creator, import, preview, and export rather than maintaining divergent rule sets.

## Workflow

1. Trace the requested feature from its visual editor fields to runtime meaning and persistence. Add only records needed for that feature and document required/default/optional values.
2. Specify structural validation and semantic checks separately. Cover duplicate IDs, missing references/assets, wrong fact types, invalid dialogue destinations, and ambiguous rules as each enters scope. Validate supported geometry through the presentation contract.
3. Return structured diagnostics with severity, stable code, entity identity, field location, and a creator-facing explanation. Agree with the creator on navigation targets; avoid exposing only a raw data path to users.
4. Define rename, delete, and duplicate behavior with the creator. Duplication creates new identities and deliberately remaps internal references. Deletion must expose affected references rather than silently changing puzzle meaning.
5. Version authored projects separately from player saves and track content identity/version for save compatibility. For each format change, state whether old data loads, migrates, or is rejected with a clear message. Unsupported future versions must not be silently interpreted as current data.
6. For migrations, stage the result, validate it, and retain a recoverable original. Coordinate commit/recovery with project I/O. Do not claim compatibility without representative fixtures.

## Evidence to supply

Provide valid and invalid fixtures for the affected contract, reference-preserving rename/reorder checks, and round-trip checks through serialization. For a migration, show old input, validated output, failure preservation, and the supported version range. Check that diagnostics can locate the actual authoring control. Static validation can detect specific contradictions but cannot prove arbitrary puzzle solvability; keep that claim out of diagnostics and documentation.
