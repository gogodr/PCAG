# F06 review: editor navigation and core views

## Scene editor update (2026-10-23)

The Scenes view now has an Elements tree on the left, the scene canvas in the center, and an Inspector on the right. Background is the tree root; existing hotspots appear beneath it and currently show read only properties when selected. Select Background to change its image. In Electron, **Browse backgrounds…** opens the system file selector in the loaded project’s `backgrounds` folder. Files outside that folder or outside the project are rejected. A valid selection is added to the local asset scan and saved in `workspace.json`; Undo changes the scene background without deleting the image file. Browser renderer tests use the Inspector’s list of project backgrounds. The earlier scene tools descriptions below are historical F06 evidence.

Date: 2026-10-23. Status: Awaiting user validation. User acceptance: pending.

## Scope and acceptance

Add editor navigation for Project, Assets, Characters, Items, Scenes, and Game Map. Project shows game name, target resolution, save/open, and export. Assets shows required root folders (backgrounds, images, sounds, music) and supports adding, renaming, and removing nested folders/files. Scenes has a selector and a single background chosen from the backgrounds folder, while retaining the F04 hotspot inspector and preview. Characters, Items, and Game Map are visibly disabled placeholders.

The new workspace format must preserve imported file bytes, folder structure, and project data across save/reopen. The playable export must include the selected background and still run over HTTP without the editor. Missing references, duplicate paths, invalid files, and deletion of in-use backgrounds must be reported without corrupting the current workspace. Scene walk areas, placements, and gateways remain R02-R04 work.

## Implementation and evidence

The [creator](../../apps/creator/src/main.tsx) now has a persistent left navigation. Project, Assets, and Scenes are usable; Characters, Items, and Game Map are disabled and marked Later. Project edits the game name, target width/height for every scene, and starting scene, with project export and open actions. Assets has four fixed root folders and supports nested folders, image or audio file import, rename, remove, and Undo/Redo. The Scenes top bar selects a scene and uses round add and rename buttons; each opens a selected name field that commits with Enter. The scene view currently offers only a background selector and canvas. Hotspot editing and preview controls are reserved for later work. A referenced background cannot be removed until the scene chooses another one.

The [workspace format](../../packages/editor-workspace/src/index.ts) wraps the v1 playable project with target resolution, folders, and file bytes. **Export project** downloads compressed `project.pcag`; Open project checks its format identifier and SHA-256 integrity digest before decompressing, validating, and restoring its folders and asset files in the browser workspace. Earlier raw JSON files are no longer accepted by Open project. Backgrounds and images accept JPEG, PNG, SVG, JPG, and WebP; sounds and music accept MP3, WAV, and OGG, including in subfolders. SVG imports must contain static artwork without scripts or external references. New files are limited to 10 MB each and checked against their extensions. Player export includes workspace files and still loads the same playable project format through the shared runtime.

The editor structure was refactored after review feedback. The creator's `main.tsx` only mounts the app. `app/` owns workspace state and composition, `views/` owns the Project, Assets, and Scenes screens, `features/` owns asset and scene controls, `components/` owns shared shell, diagnostics, and preview UI, and `styles/` groups the corresponding CSS. The player's `main.ts` only boots; `data/` loads and validates content, while `app/` mounts the runtime. Domain format, workspace, I/O, and runtime code remain in `packages/` so the web entry points stay small.

The project export UX was revised after review feedback. The `.pcag` container compresses the workspace payload and stores a digest of the compressed bytes. Loading verifies the identifier and digest before decompressing and validating the workspace. Invalid files leave the open editor state intact.

The startup and working storage flow was revised next. The normal editor URL opens the last permitted local project, or shows a landing page without the editor sidebar. It offers Create a new project, Import a PCAG project file, and Continue a local project. Each action opens one focused step. Folder selection uses `window.showDirectoryPicker()`; new and imported projects require an empty folder, while Continue selects a folder containing `workspace.json`. Browser file handles write project settings and scene background paths to `workspace.json`; the Assets view scans the four asset folders, and file edits update those files. The recent handle is kept in IndexedDB. A new project starts with a blank scene/background rather than the reference adventure. `?sample=1` remains an explicit development fixture route. A `.pcag` export is optional for sharing; the working folder is the live source.

| Check | Expected | Observed on 2026-10-23 |
| --- | --- | --- |
| `npm run check` | Type check, both builds, format and browser checks pass | Passed: 28 format tests and 20 Chromium browser tests across production and development. |
| Editor browser workflow | Empty startup, local folder creation, live asset writes, reload, navigation, scene selection/background, preview, and export work | Passed in both browser modes. |
| Invalid workspace workflow | In-use background deletion and SVG containing active content are refused; current workspace stays intact | Passed in both browser modes. |
| Export regression | Edited project runs from ZIP over independent HTTP | Passed in both browser modes. |
| `git diff --check` | No whitespace errors | Passed. |

The M0 integrated gate passed before F06 changes on 2026-10-23 with 28 format and 14 browser checks; its result is recorded in the [validation log](validation-log.md). F06 has its own review gate and does not start R01.

Browser automation supplies origin-private File System Access handles in place of the operating system picker. It verifies the same handle-based reads, writes, renames, removals, import, and reload flow; the native picker itself remains a manual review step.

## User review

Run `npm run dev` and open <http://127.0.0.1:5173/>. If there is no recent permitted local project, choose one of the landing actions. To create a project, enter a name and select an empty folder. To import, select a `.pcag` file and an empty target folder. To continue, select a folder containing `workspace.json`. If a recent project opens automatically, use **Open another project** to see the landing page. Then use the editor navigation:

1. In **Project**, rename the game, change the target resolution, and inspect **Project actions**, the working folder name, and both export actions. Check that `workspace.json` changes on disk. Characters, Items, and Game Map should be disabled.
2. In **Assets**, open `backgrounds`, add a nested folder, and import a PNG, JPEG, SVG, JPG, or WebP file. Check that the folder and file exist on disk, then rename and remove them in the editor and check the disk again. The other roots are `images`, `sounds`, and `music`; sound/music accept MP3, OGG, or WAV. Undo/Redo can reverse edits.
3. In **Scenes**, use the top bar dropdown to select a scene, the plus button to create one, and the pen button to rename it. The name field should be selected when opened; Enter commits and Escape cancels. Choose its single background from the backgrounds folder and check the canvas. The scene tools panel has no hotspot or preview controls. Try deleting that background in Assets while the scene uses it; the editor should explain why deletion is blocked. Select another background first to delete it.
4. Reload the page and confirm the local project and its edits reopen. Export `project.pcag`, choose **Open another project**, and import the archive into a new folder. Confirm its folders, files, scenes, and settings. A damaged file should fail its integrity check while leaving the current workspace intact. Export the player ZIP and serve its extracted directory over HTTP to check the selected starting scene.
5. Choose **Close project**. The landing page should return without the editor sidebar, and a reload should remain on that page. The working files should still exist in the selected folder.

Scene walkable areas, item/character placement, and gateways are planned for R02-R04. The `.pcag` container currently compresses a workspace payload with embedded media bytes; archive migration handling remains B01/B02 work.
