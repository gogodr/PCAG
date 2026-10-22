# 0002 — F02 build and verification toolchain

Date: 2026-10-22. Status: Accepted with F02 on 2026-10-22.

## Choice and evidence

Use one private npm root with two Vite app roots, independent output directories, strict TypeScript checks, and Playwright Chromium smoke tests. No empty domain packages, package publishing, task orchestrator, or second test runner is needed for the shell scope. F03 can add domain tests when domain behavior exists.

Verified stable package metadata against the official npm registry before installation using `npm view <package> version engines peerDependencies --json --offline=false`. Checked Node 22-specific type releases separately with `npm view @types/node@22 version --json --offline=false`.

| Component | Exact version |
| --- | --- |
| Node / npm tested locally | 22.23.1 / 10.9.8 |
| TypeScript | 7.0.2 |
| Vite / React Vite plugin | 8.3.5 / 6.1.2 |
| React / React DOM | 19.3.1 / 19.3.1 |
| Phaser | 4.2.1 |
| Playwright test | 1.64.1 |
| Node / React / React DOM types | 22.20.5 / 19.3.0 / 19.3.0 |

The current [Vite guide](https://vite.dev/guide/) and package engines require Node 20.19+ or 22.12+; this repository qualifies the installed Node 22 line and enforces that range. The selected React plugin accepts Vite 8; its compiler-related peers are optional and unused. React DOM's React peer matches our exact React version. [React's version policy](https://react.dev/versions) and [TypeScript's installation guidance](https://www.typescriptlang.org/download/) support project-local, versioned dependencies; the lockfile captures the actual transitive graph.

Use Phaser's npm package with its bundled types, following the [official installation guide](https://docs.phaser.io/phaser/getting-started/installation). The current stable registry release is Phaser 4.2.1; old Phaser 3 assumptions and archived dependency versions are not carried over. F02 validates only boot/build compatibility. F04 must validate the actual shared presentation and lifecycle APIs before gameplay claims.

## Consequences and alternatives

- Separate app roots prevent accidental dependence on the other app's HTML/output. Both builds use relative asset URLs. Each has its own Vite dependency cache: a concurrent development check exposed an outdated optimized-dependency response with the shared default cache. Development-server regression tests now cover this alongside production boot. Runtime packaging/export remains F05.
- Type checking is explicit because bundling/transpilation alone does not establish type correctness. `skipLibCheck` skips third-party declaration internals; application and configuration code still receive strict checks.
- The creator needs no Phaser code until the scene editor exists. The player needs no React dependency in its bundle. This keeps the first boundaries visible without speculative shared abstractions.
- Browser smoke checks exercise the real production bundles and catch boot, HTTP, module-loading, and rendering failures. No placeholder unit tests merely assert a constant or duplicate implementation logic.
- CI uses the same `npm run check` entry point. Production output is served with [Vite preview](https://vite.dev/guide/static-deploy.html) during testing only. Playwright browser installation follows its [CI guide](https://playwright.dev/docs/ci-intro).
- A monorepo manager or separate lockfiles would add coordination without useful independent package lifecycles at this stage. Revisit if packages later need distinct releases.

Exact results, browser version, and any remaining warnings belong in the [F02 review](../development/f02-review.md). No broader browser support, scene editing, or performance guarantee follows from this shell check.
