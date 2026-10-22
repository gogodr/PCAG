# F03 review: project format and diagnostics

Date: 2026-10-22. Status: In progress. User acceptance: pending.

## Scope and acceptance

Define the smallest authored project needed by the M0 inspection slice: schema version, stable IDs, image asset declarations, rooms, rectangular hotspots, and `inspect` text. Keep it independent of React, Phaser, DOM, and storage. Load a maintained valid fixture through the validator in the application shells.

Acceptance scenarios:

1. A valid JSON fixture loads, resolves its start room and declared background, and survives serialization without changed content.
2. Structural errors, duplicate IDs, missing start-room/background references, and invalid bounds produce stable codes and entity/field locations.
3. Renaming or reordering records preserves IDs and reference meaning. Deletion exposes broken references; it does not silently retarget them.
4. Unsupported versions and malformed JSON are rejected without mutation or partial usable project output.
5. Creator/player consume the same validation entry point; the existing full-width 16:9 player remains intact. Automated domain and browser checks pass.

Failure cases include wrong types, unknown fields, nonfinite/out-of-room geometry, unsafe asset paths, duplicate IDs across entity types, and prototype-like IDs. Asset byte decoding, import limits, migrations, runtime interactions, editor mutations, persistence, and export remain outside F03.
