# PCAG - Point-and-click adventure framework

PCAG is being rebuilt one validated backlog item at a time. **F01 is accepted; F02 workspace and toolchain results await review.** The full 24-item scope is retained.

The release objective is a browser tool in which a nontechnical person can author, test, save, reopen, and export a complete small adventure without programming or developer intervention.

## Run the development shells

Use Node 22.23.1 and npm 10.9.8. From the repository root:

```sh
npm ci
npx playwright install chromium
npm run check
npm run dev
```

Open the creator at <http://127.0.0.1:5173/>. In a separate terminal, `npm run dev:player` opens the player shell at <http://127.0.0.1:5174/>. These are foundation shells; room authoring, project loading, and gameplay have not been implemented.

- [Developer setup and commands](docs/development/setup.md)
- [F02 results and review guide](docs/development/f02-review.md)
- [Accepted foundation decisions](docs/decisions/0001-rebuild-foundation.md)
- [Development plan and unchanged backlog](docs/planning/06-development-plan.md)
- [Validation log](docs/development/validation-log.md)
- [Product roadmap](docs/planning/05-roadmap.md)
- [Character and interaction requirements](docs/planning/07-character-and-interactions.md)
- [Player actions and UI requirements](docs/planning/08-player-actions-and-ui.md)

The previous build is historical input, not current acceptance evidence. Its archived files can be inspected in Git at commit `fdc0bda` under `archive/first-build-2026-10-22/`; that directory is absent from the current checkout. See the [reset record](docs/development/rebuild-reset.md) for the original reset context.
