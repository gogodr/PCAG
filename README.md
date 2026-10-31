# PCAG - Point-and-click adventure framework

PCAG is being built around a desktop creator and a browser player. **F01-F05 and the M0 inspection proof are accepted; the expanded F06 editor foundation awaits re-review and user validation.** Character and animation authoring controls exist, but playable character movement and complete adventure rules remain future milestones.

The release objective is a desktop creator in which a nontechnical person can author, test, save, reopen, and export a complete small adventure without programming or developer intervention. The exported player runs in a browser.

## Run the development shells

Use Node 22.23.1 and npm 10.9.8. From the repository root:

```sh
npm ci
npx playwright install chromium
npm run check
npm run dev
```

`npm run dev` opens the creator in Electron. It opens the recent local project when available; otherwise its landing page offers **Create a new project**, **Import a PCAG project file**, and **Continue a local project**. Choose a project folder through the system folder dialog. New and imported projects require an empty folder; continuing requires a folder with `workspace.json`. The working folder contains real asset files in `backgrounds`, `images`, `sounds`, `music`, `animation`, and `video`; supported media may live in subfolders. Edits are written there automatically. A `.pcag` export is a compressed sharing copy. In a separate terminal, `npm run dev:player` opens the sample player at <http://127.0.0.1:5174/>. The creator also exports a standalone player ZIP. Project, Assets, Characters, Scenes, and Animations are active views. The player currently renders a scene and direct element inspection; it does not yet run a full character-led adventure.

## Source layout

- `apps/creator/src/main.tsx` mounts the editor. `app/` coordinates workspace state, `views/` contains each editor screen, `features/` contains asset and scene controls, `components/` contains shared UI, `data/browserProjectStore.ts` handles folder access and recent-folder storage, and `styles/` contains the CSS.
- `apps/player/src/main.ts` boots the player. `data/` loads project content and `app/` mounts the shared runtime.
- `packages/` contains project validation, workspace data, file/export I/O, and the runtime shared by creator and player.

- [Developer setup and commands](docs/development/setup.md)
- [F06 results and review guide](docs/development/f06-review.md)
- [Project format contract](docs/development/project-format.md)
- [Accepted foundation decisions](docs/decisions/0001-rebuild-foundation.md)
- [Current-state review](docs/planning/10-current-state.md)
- [Platform use-case map](docs/planning/09-use-case-map.md)
- [Development plan and ordered backlog](docs/planning/06-development-plan.md)
- [Validation log](docs/development/validation-log.md)
- [Product roadmap](docs/planning/05-roadmap.md)
- [Character and interaction requirements](docs/planning/07-character-and-interactions.md)
- [Player actions and UI requirements](docs/planning/08-player-actions-and-ui.md)

The previous build is historical input, not current acceptance evidence. Its archived files can be inspected in Git at commit `fdc0bda` under `archive/first-build-2026-10-22/`; that directory is absent from the current checkout. See the [reset record](docs/development/rebuild-reset.md) for the original reset context.
