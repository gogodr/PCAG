# Browser adventure creator

Date: 2026-10-21. Status: product direction recorded; implementation recommendations pending a prototype.

Execution is now organized in the [product roadmap](05-roadmap.md) and [development plan](06-development-plan.md). Those documents define staged delivery; capabilities described below need not all be complete in the initial foundation proof.

## Product direction

Programmers maintain and extend the engine. Nontechnical creators build games using it. Games run in browsers, and Escoria serves as a reference for solving adventure-specific problems. Tools to help build scenes and assets are within potential scope.

Confirmed completion requirement: **one nontechnical creator can fully author a small adventure using the provided tools.** Standard gameplay must not require a programmer to fill gaps between tools. Testing, fixing authoring mistakes, saving/reopening the project, and producing a playable export belong to this end-to-end workflow.

This requirement concerns independent game authoring. Whether all original artwork, animation, and audio must also be created inside the product remains undecided. For the initial validation, provide a reusable asset library and support imported assets; do not treat a full art-production suite as already required.

Recommend a browser-based creator application alongside the browser game runtime. This editor deployment is a proposal; browser game delivery is confirmed. The product should allow a creator to go from imported artwork to a playable adventure without installing a compiler, editing source code, or manipulating JSON.

## Proposed stack and boundaries

| Component | Initial recommendation | Responsibility |
| --- | --- | --- |
| Adventure core | TypeScript | State, conditions, actions, dialogue, inventory, save data |
| Game presentation | Phaser | Room rendering, input integration, animation, camera, audio |
| Creator interface | TypeScript with React, provisionally | Forms, library panels, inspectors, rule editing, project workflow |
| Room canvas | Shared Phaser presentation with editor overlays | Placement, bounds, paths, previews |
| Project format | Versioned JSON plus assets | Portable authored content with stable references |
| Project validation | Shared schema and semantic validators | Structural correctness and cross-reference checks |
| Distribution | Static web game bundle | Play without the creator application |

These are architecture recommendations, not installed dependencies or measured conclusions. React is optional; choose the editor UI library after a small workflow prototype. Phaser is documented as a browser-focused 2D library supporting JavaScript/TypeScript. It supplies the presentation foundation, not our adventure model or complete creator workflow. [Phaser overview](https://docs.phaser.io/phaser/getting-started/what-is-phaser)

Phaser Editor already offers visual scene editing and code generation. It is worth studying for scene manipulation and preview techniques, but its existence does not establish that it meets our nontechnical adventure-authoring requirements. Its scene format/compiler should not automatically become our game format. [Scene editor introduction](https://docs.phaser.io/phaser-editor/scene-editor/intro), [prefab code generation](https://docs.phaser.io/phaser-editor/scene-editor/prefabs/prefab-code)

## Creator workflow

The [character and interaction rules](07-character-and-interactions.md) are confirmed product direction. Authoring must include a visible protagonist, spawn/feet anchor, walkable geometry, and approach markers separate from object click bounds. View text is the protagonist's observation. Pick up/Use actions require approach before execution; creators should not have to manually prepend a walk command to every standard physical interaction. Basic View speech is M1 scope; full conversation authoring is M3.

1. Start from an adventure template with the standard player UI already configured.
2. Import a background, create a room, and set its dimensions.
3. Draw walkable space, place the protagonist, and mark entrances/exits.
4. Place an object or draw a hotspot; give it a name and available actions.
5. Create inventory items by choosing images and entering descriptions.
6. Configure interactions using readable conditions and action cards.
7. Write a conversation and attach it to a character.
8. Preview the room or play from the beginning.
9. Fix errors through messages that link to the affected object or rule.
10. Export the editable project or a playable web bundle.

The first version should make a small set of common tasks complete and predictable. Advanced behavior can be added by programmers through extensions, while ordinary game authors remain within visual tools.

## Rules that creators can read

Follow [AUTHOR-01–03 in the player UI specification](08-player-actions-and-ui.md#nontechnical-authoring-requirements): configure distinct verb rules, suggested actions, approach markers, and fallbacks through the inspector. Showing an action is separate from whether its puzzle prerequisite currently succeeds. Preview must expose the same verb/source/target workflow as export.

Example rule shown in the creator:

> When the player uses **Brass key** on **Cabinet**
>
> If **Cabinet unlocked** is **No**
>
> Then play **Unlock sound**, set **Cabinet unlocked** to **Yes**, and show **Open cabinet**.

Use entity pickers, action menus, and typed values rather than free-form expressions. Offer starter behaviors such as “pick up an item,” “locked door,” and “talk to a character.” Creators can rename a fact without breaking its stable internal ID.

Start with ordered action cards and simple grouped conditions. Dialogue can start as a list of topics/options and destinations with a conversation preview. A graph may help later for complex branching, but should not be required to author a basic conversation.

Do not silently turn an editable rule into generated source that becomes the only source of truth. Visual edits must round-trip through the project format without losing information.

## Initial creator scope

| Tool | Include in first proof | Later expansion |
| --- | --- | --- |
| Project management | New/open, autosave status, import/export | Accounts, cloud sync, team collaboration |
| Asset library | Import images/audio, thumbnails, names, reference tracking | Tags, bulk processing, shared libraries |
| Room editor | Layers, placement, hotspots, walkable polygon, exits, approach points | Reusable room assemblies, richer camera/depth tools |
| Character setup | Import supplied animations and map idle/walk/talk states | Animation creation, rigging, lip-sync production |
| Item editor | Icon, description, ownership, combinations | Richer item transformations and templates |
| Rule editor | Common triggers, conditions, ordered actions, fallbacks | Advanced condition groups and reusable behaviors |
| Dialogue editor | Lines/topics, choices, conditions, state changes, preview | Graph view, localization and voice production workflows |
| Playtest | Same runtime as export; restart from known state | Breakpoints, state presets, puzzle progression views |
| Validation | Missing assets/references, invalid rules, unreachable configured destinations where detectable | More comprehensive puzzle analysis |

Undo/redo, clear selection, recovery from mistakes, and useful defaults are baseline creator requirements. Static validation cannot prove that arbitrary puzzles are solvable; authored playthroughs and playtesting remain necessary.

## Scene and asset assistance

Distinguish composition tools from creating original artwork. The room editor composes assets into scenes; an art tool produces or transforms the assets themselves.

Prioritize small tools that remove repetitive setup: image cropping, pivot placement, sprite-sheet slicing, animation preview, inventory icon extraction, and reusable object templates. Preserve originals so derived assets can be regenerated.

A painting suite, procedural scene generation, and AI-assisted artwork are possible later additions, not prerequisites. Any future generated asset should enter the ordinary import/review workflow, with consistent scale, animation conventions, and editable metadata. No external generation service is selected.

## Data, preview, and export

Keep authored project data, runtime game state, and editor workspace state separate. Moving an object in the editor changes the project; opening its cabinet in playtest changes only the play session. Ending a preview must not silently rewrite authored content.

The same adventure interpreter should run in preview and export. Use a separate preview context with explicit restart and lifecycle cleanup so repeated previews cannot accumulate input handlers or audio.

The initial portable project archive should contain a manifest, versioned content files, and assets. A playable export contains the runtime plus validated content and only the assets it needs. Target static HTTP hosting; do not assume a downloaded HTML file will work when opened directly from disk.

Recommend local-first editing for the prototype, with explicit project download/import and clear save status. Browser-managed persistence should be a convenience, not the only recovery path. Specific storage APIs, quotas, and recovery behavior require a browser compatibility spike. Cloud accounts and hosting are separate product decisions, not prerequisites for the first runtime.

Editable project compatibility and player-save compatibility need distinct version policies. A migrated project should retain a recoverable original; a game update should either migrate supported player saves or explain incompatibility.

## Escoria study plan

Escoria documents rooms/items/player concepts, inventory, scripting, and separable UI/dialogue implementations. Use these as prompts for design questions rather than a specification to reproduce. [Concepts](https://docs.escoria-framework.org/en/devel/general/what_is_escoria.html), [UI/core separation](https://docs.escoria-framework.org/en/devel/getting_started/step_by_step/1_create_escoria_project.html)

| Study area | Question for our design |
| --- | --- |
| Rooms and actors | What is durable world state versus temporary scene state? |
| Interaction and movement | When does an action approach, cancel, revalidate, and execute? |
| Inventory and combinations | How are ownership, transformations, and consumption represented? |
| Dialogue | How do conditions, repeat topics, and effects interact? |
| Sequences and saves | What happens when playback is skipped or saving occurs mid-action? |
| UI boundaries | Which domain operations remain independent of presentation? |

A later focused source review should document observed behavior, weaknesses, and our independent choice for each area. This table lists research questions; it does not claim Escoria already resolves every case.

## Prototype success criteria

Use the two-room proof adventure in the [framework plan](03-framework-plan.md) to validate individual tools, then perform a separate end-to-end authoring test. One nontechnical participant starts a new project with a standard UI template and supplied assets, rather than a preconfigured puzzle. They author a complete small adventure without editing code, JSON, or configuration files, using a terminal, or receiving developer fixes.

The participant must independently:

1. Create and connect rooms, place a character, and define walkable areas and hotspots.
2. Author inspection responses, item collection/use, and an item combination.
3. Write a conversation with choices and at least one condition-dependent option.
4. Connect puzzle consequences to world changes and a reachable ending.
5. Playtest, diagnose an authoring mistake, and correct it using the provided feedback.
6. Save, close, reopen, and continue editing the project.
7. Export a playable game and verify it in the supported browser workflow.

Documentation, in-product guidance, templates, and supplied assets are allowed. Any step requiring bespoke code, manual data repair, or a developer to finish the game fails this criterion. The creator may decide the story and puzzle design; the tools must make those decisions implementable within the supported small-adventure scope.

Record task completion, confusing labels, errors, help requests, and whether preview matches export. Observers should log blockers rather than silently completing steps for the participant. A second independently authored puzzle tests whether the workflow transfers beyond the tutorial. Successful runtime behavior alone does not satisfy product acceptance.

Technical checks should cover target-browser input, audio startup, asset loading, preview cleanup, persistence/recovery, and static deployment. Pin the tested dependency versions. No browser matrix or performance guarantee has yet been established.
