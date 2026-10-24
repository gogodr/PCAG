# F05 review: project storage and playable export

Date: 2026-10-22. Status: Accepted. User acceptance: 2026-10-23, request to start the next editor interface work after reaching the first milestone.

## Scope and acceptance

The creator saves a validated project JSON file and reopens one without changing stable IDs or authored data. Invalid files show diagnostics and leave the current draft intact. The creator exports a ZIP containing static player files, the edited project JSON, and its bundled sample image assets. After extraction, the player runs over a local HTTP server without the creator. It loads the exported JSON through the F03 parser and uses the F04 runtime.

Acceptance scenarios: edit View text and background, save and reopen, preview the same content, export, serve the extracted folder over HTTP, click the hotspot, and see the edited text. Exporting invalid content is blocked. Repeated save/reopen does not alter IDs. Export remains limited to the bundled sample image assets in this spike; general import, backup/recovery, and hardened export belong to later backlog items.

Failure cases: malformed or unsupported project file, missing asset mapping, failed file fetch, corrupted ZIP, and exported player startup with invalid project content.

## Implementation and evidence

The [creator](../../apps/creator/src/main.tsx) downloads the validated draft as `project.json` and reopens a selected JSON file through `parseProject`. A failed reopen leaves the current draft intact and shows the parser's field diagnostics. The [export helper](../../packages/project-io/src/browser.ts) packages the current validated project with the built player and bundled artwork using the [ZIP writer](../../packages/project-io/src/zip.ts). The [player entry](../../apps/player/src/main.ts) loads `project.json` from the exported folder and passes it to the same runtime used by creator preview. The [staging script](../../scripts/stage-player-template.mjs) refreshes the export template from the production player build.

| Check | Expected | Observed on 2026-10-22 |
| --- | --- | --- |
| `npm run check` | Build, format tests, and browser workflows pass | Passed: both production builds, 28 format tests, 14 Chromium browser tests across production and development. |
| Browser save/reopen workflow | Edited text/background and stable hotspot ID survive JSON download/reopen; malformed file preserves current draft | Passed in both browser modes. |
| Browser independent export workflow | Downloaded ZIP serves edited project over a separate HTTP server with no creator requests | Passed in both browser modes; View hotspot showed the edited text. |
| `tar -tf test-results/storage-export-save-reopen-fb469-and-independent-HTTP-export-chromium-production/pcag-player.zip` | System ZIP reader accepts the archive and lists player, project, and artwork | Passed; listed `index.html`, JS/CSS, `project.json`, and two image files. |
| `git diff --check` | No whitespace errors | Passed. |

The bundle includes only the two bundled sample images. Reopened projects may contain other valid asset declarations, but preview and export are disabled with an explicit message until asset import arrives in R01. The ZIP is a minimal static export spike; archive limits, content sanitization, update compatibility, and general import/export hardening remain B01/B02 work. Phaser still produces a nonblocking Vite bundle-size warning.

## User review

Run `npm run dev` and open <http://127.0.0.1:5173/>. Change the background to **Dawn landscape** and set View text to a phrase you recognize. Click **Save project**; change the text again, then click **Open project** and select the downloaded `project.json`. The saved text and background should return. Click **Preview room** and inspect the hotspot.

Click **Export player ZIP**, extract `pcag-player.zip`, and serve the extracted directory over HTTP. For example, in that directory run `python -m http.server 8000`, then open <http://127.0.0.1:8000/>. The standalone player should display the selected background and show the saved View text when its hotspot is clicked. It does not need the creator server. Opening the HTML directly with a `file:` URL is not the supported path because the player fetches `project.json`.

To check a failure case, open a malformed JSON file. The current draft should stay visible with a diagnostic. Setting the hotspot X to 1590 should disable Save, Preview, and Export until the geometry is repaired or undone.
