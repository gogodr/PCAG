# F03 review: project format and diagnostics

Date: 2026-10-22. Status: Accepted. User acceptance: 2026-10-22, "ok lets move forward and fo F04".

## Scope and acceptance

Define the smallest authored project needed by the M0 inspection slice: schema version, stable IDs, image asset declarations, rooms, rectangular hotspots, and `inspect` text. Keep it independent of React, Phaser, DOM, and storage. Load a maintained valid fixture through the validator in the application shells.

Acceptance scenarios:

1. A valid JSON fixture loads, resolves its start room and declared background, and survives serialization without changed content.
2. Structural errors, duplicate IDs, missing start-room/background references, and invalid bounds produce stable codes and entity/field locations.
3. Renaming or reordering records preserves IDs and reference meaning. Deletion exposes broken references; it does not silently retarget them.
4. Unsupported versions and malformed JSON are rejected without mutation or partial usable project output.
5. Creator/player consume the same validation entry point; the existing full-width 16:9 player remains intact. Automated domain and browser checks pass.

Failure cases include wrong types, unknown fields, nonfinite/out-of-room geometry, unsafe asset paths, duplicate IDs across entity types, and prototype-like IDs. Asset byte decoding, import limits, migrations, runtime interactions, editor mutations, persistence, and export remain outside F03.

## Review evidence

The authored schema and validator are in [project-format](../../packages/project-format/src/index.ts), with the maintained [sample project](../../examples/reference-adventure/project.json), invalid fixtures in `tests/fixtures`, and a [format review command](../../scripts/validate-project.ts). Both application shells load that sample through the same parser. The creator displays the affected field and technical location for invalid references; the player refuses to start a scene with invalid project data.

| Check | Expected | Observed on 2026-10-22 |
| --- | --- | --- |
| `npm run build` | Type checking and both production builds pass | Passed. Vite reported a nonblocking player bundle size warning. |
| `npm run test:format` | Schema, identity, references, geometry, and malformed input checks pass | 28 passed. |
| `npm run test:browser` | Development and production shells load; invalid references are shown; player layout stays 16:9 | 8 passed in Playwright Chromium. |
| `npm run review:format` | Valid sample resolves the start room | Exited 0; `room_lake` (Lakeshore), 1600 × 900, zero diagnostics. |
| `npm run review:format -- tests/fixtures/missing-background.json` | Invalid background identifies its field | Exited 1 with `missing_reference` at `/rooms/0/backgroundAssetId`, room `room_lake`. |

The first `npm run check` attempt passed type checking but its Vite build could not spawn a child process in the sandbox (`EPERM`). Outside that process restriction, the build passed. The first browser run lacked Playwright Chromium; after `npx playwright install chromium`, all eight browser checks passed. These were environment setup issues, not failing application assertions.

## User review

Run `npm run review:format` to see the valid room load. Run `npm run review:format -- tests/fixtures/missing-background.json` to see the field-level diagnostic (exit code 1 is expected). For the visual check, run `npm run dev` and `npm run dev:player` in separate terminals: the creator reports the sample project and the player displays the sample room. F04 will add editing and hotspot interaction after F03 acceptance.
