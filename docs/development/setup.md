# Developer setup

## Desktop creator update (2026-10-23)

The creator now runs in Electron. `npm run dev` builds and stages the player template, starts the creator Vite server, and opens the desktop window. Use the system folder dialog to create, import, or continue a local project. The Electron main process uses Node for project files through an isolated preload bridge. `npm run start:creator` builds and opens the production renderer. `npm run dev:creator:web` starts only the Vite server for browser test and renderer review. If port 5173 is occupied, stop the process using it or set `PCAG_CREATOR_DEV_PORT` to another port before running `npm run dev`. The player remains a standalone browser app. Installer packaging is a later release task.

F02 established two application shells; F03-F05 add the project validator, shared runtime, sample inspector, JSON save/reopen, and playable export spike. F06 adds editor navigation, a structured asset tree, and scene selection. These instructions are for maintainers; the finished creator will not require its users to install Node or use a terminal.

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

- Creator: <http://127.0.0.1:5173/> — starts with the last permitted local project or a landing page with three actions. Use a browser with `window.showDirectoryPicker()` to select an empty folder for a new or imported project, or an existing project folder to continue. The local `workspace.json` stores project settings and scene background paths; the Assets view scans the actual asset folders. Project and player ZIP export remain available.
- Player: <http://127.0.0.1:5174/> — game-only sample room in a full-width, centered 16:9 frame.

The player loads the validated sample project and supports clicking its View hotspot. The creator accepts JPEG, PNG, SVG, JPG, and WebP in backgrounds and images, and MP3, WAV, and OGG in sounds and music. These formats work in subfolders too. SVG imports are limited to static artwork without scripts or external references.

Both servers bind to loopback only and fail if their ports are occupied. Stop the conflicting server or pass `-- --port 5180` when manually reviewing. Stop servers with Ctrl+C. No app needs the other server to run.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Strict TypeScript checks over both apps and build/test configuration; emits no files |
| `npm run build:creator` | Bundle creator into `dist/creator` after staging the player template |
| `npm run build:player` | Bundle player into `dist/player` |
| `npm run stage:player` | Copy the built player into the creator's export template directory |
| `npm run build` | Typecheck, build player, stage its export template, then build creator |
| `npm run preview:creator` | Serve creator production output on port 4173 |
| `npm run preview:player` | Serve player production output on port 4174 |
| `npm run test:format` | Run 28 domain checks with the built-in Node test runner |
| `npm run review:format -- <path>` | Validate a fixture file; defaults to the maintained reference project |
| `npm run test:browser` | Run eighteen Chromium checks against built output and concurrent dev servers |
| `npm test` | Run domain and browser checks; browser checks start/stop their test servers |
| `npm run check` | Full validation: typecheck, both builds, domain tests, and browser tests |

The individual `build:*` commands transpile and bundle; they do not replace type checking. Use `build` or `check` for validation. `npm run dev` builds and stages the player template before starting the creator. Preview servers are local review tools, not production hosting services. HTTP is the review path, not opening `index.html` from disk.

Keep ports 4173/4174 and 5175/5176 free before tests: Playwright deliberately refuses to reuse existing servers so stale output cannot mask a failure. Test dev servers use separate ports from manual review. Test screenshots go to `test-results/`; the report goes to `playwright-report/` and can be opened with `npx playwright show-report`. Both are ignored. Browser launch errors usually require the browser install command above. A missing dependency requires `npm ci`, not an ad hoc global install.

For workspace-local browser downloads in PowerShell, set `$env:PLAYWRIGHT_BROWSERS_PATH="$PWD/.playwright"` before both the install and check commands. This was the path used for the recorded Windows run; a fresh terminal needs the same setting to reuse that download. Omitting it uses Playwright's normal user cache instead.

## Repository and CI

There is one private npm project and one lockfile. `apps/creator` uses React; `apps/player` uses Phaser without importing creator code. Both use `packages/project-format` and `packages/runtime`. Vite configs select separate roots, dependency caches, and output folders with relative asset URLs. Caches are separated by app and mode; test servers use `--mode smoke` so they cannot invalidate the normal review servers' optimized dependencies. If an old tab shows a blank page after a configuration change, reload it to fetch current module URLs. The F05 export template is generated from the player build and ignored by Git.

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
