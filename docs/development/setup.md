# Developer setup

F02 establishes two independent application shells. Project loading, authoring, and playable export are later items. These instructions are for maintainers; the finished creator will not require its users to install Node or use a terminal.

## Requirements and install

Use Node **22.23.1** (also recorded in `.nvmrc`) and npm **10.9.8**. The supported setup range is Node 22.12+ within major 22 and npm 10; other majors have not been qualified. `.npmrc` rejects incompatible engines. Use a current desktop browser; the automated baseline is Playwright Chromium.

From the repository root:

```sh
npm ci
npx playwright install chromium
npm run check
```

On Linux CI, use `npx playwright install --with-deps chromium` to install browser system dependencies too. The initial install requires access to npm and Playwright's download servers. Keep `package-lock.json` committed; do not substitute `npm install` for a reproducible checkout install. All direct dependencies are pinned exactly.

If your environment forces npm into offline mode, use `npm ci --offline=false`. A local cache can be selected with `--cache .npm-cache`. This is an environment override, not a project requirement.

## Develop and review

Run these in separate terminals:

```sh
npm run dev
npm run dev:player
```

- Creator: <http://127.0.0.1:5173/> — React welcome screen with an honest empty-workspace message.
- Player: <http://127.0.0.1:5174/> — game-only player view; Phaser draws a sample landscape in a full-width, centered 16:9 frame.

No buttons promise unimplemented authoring or gameplay. The player landscape is a renderer sample, not an interactive adventure room. It loads no project data and has no gameplay.

Both servers bind to loopback only and fail if their ports are occupied. Stop the conflicting server or pass `-- --port 5180` when manually reviewing. Stop servers with Ctrl+C. No app needs the other server to run.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Strict TypeScript checks over both apps and build/test configuration; emits no files |
| `npm run build:creator` | Bundle creator into `dist/creator` |
| `npm run build:player` | Bundle player into `dist/player` |
| `npm run build` | Typecheck, then build both independent outputs |
| `npm run preview:creator` | Serve creator production output on port 4173 |
| `npm run preview:player` | Serve player production output on port 4174 |
| `npm test` | Run six Chromium checks against already-built outputs and concurrent dev servers; starts/stops test servers |
| `npm run check` | Full F02 validation: typecheck, both builds, production-browser tests |

The individual `build:*` commands transpile and bundle; they do not replace type checking. Use `build` or `check` for validation. Preview servers are local review tools, not production hosting services. HTTP is the review path, not opening `index.html` from disk.

Keep ports 4173/4174 and 5175/5176 free before tests: Playwright deliberately refuses to reuse existing servers so stale output cannot mask a failure. Test dev servers use separate ports from manual review. Test screenshots go to `test-results/`; the report goes to `playwright-report/` and can be opened with `npx playwright show-report`. Both are ignored. Browser launch errors usually require the browser install command above. A missing dependency requires `npm ci`, not an ad hoc global install.

For workspace-local browser downloads in PowerShell, set `$env:PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright"` before both the install and check commands. This was the path used for the recorded Windows run; a fresh terminal needs the same setting to reuse that download. Omitting it uses Playwright's normal user cache instead.

## Repository and CI

There is one private npm project and one lockfile. `apps/creator` uses React; `apps/player` uses Phaser without importing creator code. Vite configs select separate roots, dependency caches, and output folders with relative asset URLs. Caches are separated by app and mode; test servers use `--mode smoke` so they cannot invalidate the normal review servers' optimized dependencies. If an old tab shows a blank page after a configuration change, reload it to fetch current module URLs. Planned `packages/` directories will be introduced when F03/F04 need actual shared code.

The GitHub Actions [workflow](../../.github/workflows/check.yml) runs on pushes and pull requests with read-only repository permissions. It installs the pinned Node version, runs `npm ci`, installs Chromium, and runs `npm run check`; failed runs upload browser evidence. Linux CI configuration is provided, but a successful hosted run must be observed separately from local Windows results.

See the [toolchain decision](../decisions/0002-rebuild-toolchain.md) for verified versions and the [F02 review](f02-review.md) for actual execution results and limitations.

## Embed the player

Host the player build independently and use its URL as an iframe source. For local review:

```html
<iframe
  src="http://127.0.0.1:5174/"
  title="Adventure game"
  style="display:block;width:100%;aspect-ratio:16/9;border:0"
></iframe>
```

The game fills the available width at 16:9. In a taller frame it is centered vertically against a dark background. Give the iframe at least its 16:9 height to avoid vertical scrolling; the game intentionally preserves full width rather than shrinking to a shorter container. There is no surrounding branding, header, footer, or visible loading/status copy. Readiness remains available to assistive technology. The bundled SVG landscape is original project artwork created for this presentation sample and requires no external assets.
