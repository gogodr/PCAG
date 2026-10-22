# PCAG — Point-and-click adventure framework

A browser adventure creator and shared runtime for third-person 2D point-and-click games. M0 foundation and M1 rooms/exploration are implemented; inventory, puzzle effects, and full dialogue follow in later milestones.

The player now has a **visible animated protagonist**, click-to-walk navigation, character-spoken View responses, and connected rooms. The creator supports navigation shapes, entrances/exits, approach markers, image layers, and character animation mappings. Pick up/Use effects remain M2 work; their validated approach/cancellation boundary is in place. See the [character rules](docs/planning/07-character-and-interactions.md) and [M1 results](docs/development/m1-evidence.md).

## Try the foundation

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite. Play the study/hall sample or start a new project with the supplied explorer. Create rooms, draw ground/obstacles, add objects and exits, playtest, save/reopen, and export a playable game ZIP.

See [developer setup](docs/development/setup.md), [first-scene walkthrough](docs/creator/first-scene.md), and [M1 checks and limits](docs/development/m1-evidence.md). `npm run check` runs type checking, tests, builds, and browser workflows after installing the Playwright browser described in setup.

## Planning documents

1. [Shared gameplay features and proposed UX](docs/research/01-gameplay-and-ux.md)
2. [Platforms and technology comparison](docs/research/02-technology-options.md)
3. [Proposed architecture and validation plan](docs/planning/03-framework-plan.md)
4. [Browser creator product and tool scope](docs/planning/04-browser-creator.md)
5. [Product roadmap and milestones](docs/planning/05-roadmap.md)
6. [Development backlog and execution plan](docs/planning/06-development-plan.md)
7. [Development skills and handoff guide](docs/development/skills/README.md)
8. [Playable character and interaction rules](docs/planning/07-character-and-interactions.md)
9. [Classic-adventure action reference](docs/research/03-classic-actions-and-controls.md)
10. [Player actions and UI requirements](docs/planning/08-player-actions-and-ui.md)

Planning date: **2026-10-21**. Foundation implemented: **2026-10-22**. The roadmap and development plan govern implementation scope and sequencing. Source links appear beside research findings.

**M0 and M1** have passed their recorded Windows Chromium gates, with the constrained navigation scope documented in [decision 0003](docs/decisions/0003-exploration-and-project-v2.md). **M2–M5 remain not started.** Human independent authoring and broad browser qualification remain pending.

## Product direction

The user has selected **browser games**, **nontechnical game creators**, and **programmer-maintained engine code**. Escoria will serve as a reference for feature design and architecture, rather than a runtime dependency. Scene and asset authoring tools are within the potential product scope.

Core product requirement: **a single nontechnical person must be able to fully author, test, and export a small adventure using the provided tools, without writing code or requiring programmer intervention.** This covers a complete game, not just modifying a prepared demo. Built-in guidance and reusable templates may support the workflow.

The foundation uses **TypeScript on Phaser**, a React browser creator, shared validation, local project persistence, and static playable export. This stack passed the M0 workflow in Windows Chromium. Other target browsers and larger-project limits remain unqualified.
