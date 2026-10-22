# F02 review: workspace and toolchain

Date: 2026-10-22. Status: In progress. User acceptance: pending.

## Scope and acceptance

Establish a pinned TypeScript/React/Phaser toolchain, minimal creator and standalone player shells, documented development/production commands, strict type checks, a meaningful browser smoke test, and CI using the same checks. F01 was explicitly accepted before this item began.

Acceptance scenarios:

1. A clean lockfile install works on the documented Node/npm environment.
2. Creator and player each run locally and build to independent output directories.
3. React mounts the creator; Phaser boots in the player. These are setup shells, not an adventure or an authoring workflow.
4. Type checking covers both apps and test/build configuration. Browser smoke tests load production builds and fail on boot/resource errors.
5. CI installs from the lockfile and runs the same type/build/browser checks; no hosted CI pass is claimed without an actual run.

Failure cases: unsupported Node versions; missing dependencies/assets; build errors hidden by transpilation; player depending on creator output; stale dev servers masking broken builds; accidentally implementing F03–F05.

## Results

Implementation and verification are in progress. F03 and later items remain Not started.
