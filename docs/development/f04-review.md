# F04 review: shared runtime and hotspot inspector

Date: 2026-10-22. Status: Accepted. User acceptance: 2026-10-22, "ok, lets move onto F05".

## Scope and acceptance

Use one Phaser room runtime for the player and creator preview. The creator edits the sample room background choice, hotspot rectangle, name, and inspection text; it can preview the current valid draft and restart it without carrying interaction state across runs. Editing uses stable IDs and keeps validation at the project-format boundary.

Acceptance scenarios: edit a room background and hotspot, preview the result, click the hotspot to read its inspection text, restart preview to clear the observation, and repeat startup/shutdown without duplicate canvases or handlers. The standalone player uses the same runtime. Invalid drafts show field diagnostics and do not launch preview.

Failure cases: invalid geometry, stale asset references, unavailable mapped image files, repeated preview starts, and changes to the authored draft caused by runtime interaction. Project storage, import, export, character movement, and other verbs remain later items.

## Implementation and evidence

The [shared room runtime](../../packages/runtime/src/index.ts) mounts a Phaser scene from a validated project and returns a disposal function. Both the [creator preview](../../apps/creator/src/main.tsx) and [standalone player](../../apps/player/src/main.ts) call it. The creator provides a background selector, hotspot name and rectangle fields, View text, Undo/Redo, and a room layout outline. Preview uses a validated copy; changing or clicking in it does not alter the draft. Restart remounts a fresh scene and clears the observation.

| Check | Expected | Observed on 2026-10-22 |
| --- | --- | --- |
| `npm run build` | Type check and both production builds succeed | Passed. Vite reported a nonblocking bundle size warning for Phaser. |
| `npm run test:format` | F03 format regression checks pass after adding a second sample background | 28 passed. |
| `npm run test:browser` | Creator/player load, invalid references remain visible, preview edits and View interaction work, restart/close leave one or zero canvases | 12 passed across development and production Chromium. |
| `git diff --check` | No whitespace errors | Passed. |

An initial browser run found that a broken sample project lost the creator's detailed field diagnostic. The diagnostic panel was restored and the complete check passed afterward.

## User review

Run `npm run dev` and open `http://127.0.0.1:5173`. Select **Dawn landscape**, change the hotspot name, bounds, and View text, then click **Preview room**. Click the outlined hotspot position in the preview and confirm your text appears. Click **Restart preview** and confirm the observation clears; click **Close preview** and confirm the draft values remain. Undo and Redo should reverse and restore a field edit. Set X to 1590 to trigger an out-of-bounds diagnostic and disable preview; Undo restores a valid draft. Run `npm run dev:player` and open `http://127.0.0.1:5174` to check the standalone sample hotspot uses the same View interaction.

This is an in-memory sample editor for F04. Project save/reopen and independent playable export belong to F05.
