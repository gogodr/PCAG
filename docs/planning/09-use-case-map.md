# Platform use-case map

Date: 2026-10-30. This map describes the intended first release and the current checkout. It is a product inventory, not a claim that every visible control is release ready. See the [current-state review](10-current-state.md), [roadmap](05-roadmap.md), and [development plan](06-development-plan.md).

## Actors and status key

- **Creator:** a nontechnical person authoring and distributing a game in the Electron app.
- **Player:** someone playing an exported browser game.
- **Maintainer:** a developer extending, testing, and releasing PCAG.
- **Present:** a usable path exists in this checkout; qualification may still be pending.
- **Partial:** some UI, data, or runtime exists, but the complete use case does not.
- **Planned:** required for the first independent-authoring release but absent today.
- **Later:** expansion candidate outside the first release gate.

## Creator: project lifecycle

| ID | Use case and successful outcome | State | Delivery / evidence |
| --- | --- | --- | --- |
| C-P01 | Start a new named project in an empty local folder | Present | F06; Welcome and local workspace flow |
| C-P02 | Continue an existing local project, including recent-project reopening | Present | F06; desktop folder bridge and browser adapter |
| C-P03 | Import a `.pcag` archive into an empty folder without damaging the current project on failure | Present | F06; archive validation and import flow |
| C-P04 | Change game name, target dimensions, and starting scene | Present | F06; Project view |
| C-P05 | See save/readiness status and actionable project errors | Partial | F06/B04; status and diagnostics exist, error navigation does not |
| C-P06 | Undo/redo ordinary project edits and reopen the result | Present | F06/R01; workspace history and local writes; qualify coverage by operation |
| C-P07 | Close or switch projects without losing pending writes | Present | F06; flush-before-close/switch path |
| C-P08 | Export an editable project backup and restore it | Present | F06/B01; basic round trip exists, compatibility/recovery hardening remains |
| C-P09 | Preview the selected scene in an isolated play session, then restart/close it | Present | M0/F06; currently inspection-only gameplay |
| C-P10 | Export a self-contained browser player ZIP and run it over HTTP | Present | M0/F06; current exported gameplay is inspection-only |
| C-P11 | Publish or host a game directly from PCAG | Later | Separate product decision; static ZIP is the first-release distribution path |

## Creator: assets and animation production

| ID | Use case and successful outcome | State | Delivery / evidence |
| --- | --- | --- | --- |
| C-A01 | Browse project folders and inspect image, audio, video, and atlas files | Present | F06; Assets view and preview |
| C-A02 | Import supported files into the correct root/subfolder with validation | Present | F06; signature, path, size, and SVG checks |
| C-A03 | Create, rename, move, copy, and delete folders/files without breaking referenced content silently | Partial | F06/R01; operations exist; reference coverage and history need qualification |
| C-A04 | Drag files into a folder or move a project file between folders | Present | F06; Assets view and browser workflow |
| C-A05 | Refresh the asset scan after an external file change | Present | F06; explicit Refresh and focus refresh |
| C-A06 | Load a video/GIF or image frames, select a loop, and inspect its timeline | Present in desktop | Animation editor and desktop bridge; browser renderer shows a desktop-only message |
| C-A07 | Edit loop frames, timing, background, pixel size, and palette with undo/redo | Present in desktop | Animation editor; desktop smoke coverage exists |
| C-A08 | Export GIF/atlas/metadata and regenerate a GIF from its atlas | Present in desktop | Animation editor and Assets integration; qualify packaging and platform setup |
| C-A09 | Crop, slice, pivot, or paint source artwork in a general art suite | Later | Candidate tools after core authoring is complete |

## Creator: scenes, characters, and story logic

| ID | Use case and successful outcome | State | Delivery / evidence |
| --- | --- | --- | --- |
| C-S01 | Create, select, and rename scenes; assign a background | Present | F06; Scene switcher and Inspector |
| C-S02 | Add, name, clone, delete, order, and inspect elements | Partial | Selected-element editing works; full reference and disk regression coverage remains in R01 |
| C-S03 | Draw/edit element click bounds directly on the canvas | Partial | Selected elements can be dragged to reposition; drawing and resizing bounds remain R02 |
| C-S04 | Draw walkable space and obstacles, set actor spawn/feet position | Planned | R02 |
| C-S05 | Set an approach marker separately from click bounds | Planned | R02; [interaction contract](07-character-and-interactions.md) |
| C-S06 | Connect scenes with exits and entry points; test return travel | Planned | R04 |
| C-C01 | Create, rename, and delete a character with a reference image | Present | Character editor and optional project character records |
| C-C02 | Assign required, optional, and custom animation files; adjust displayed height/mirroring | Present | Character editor; files are authoring data only today |
| C-C03 | Place/select the playable protagonist and map idle/walk/talk animations to runtime states | Partial | Animation mapping UI/data exists; placement and runtime actor do not |
| C-I01 | Define inventory items, ownership, icons, and observations | Planned | P02; no Item editor or item schema today |
| C-I02 | Author distinct View/Pick up/Use/Talk to/Give/Open/Close/Push/Pull rules with conditions and fallbacks | Planned | Elements no longer store View text; action/rule authoring remains future work |
| C-I03 | Author item-to-object and item-to-item combinations with atomic effects | Planned | P02/P03 |
| C-I04 | Author typed facts and durable room/object state changes | Partial | SceneState and shared GameState maps can be authored with Boolean, Number, and Text values; runtime conditions and durable effects remain P01/P04 |
| C-I05 | Write conditional dialogue, choices, topics, and consequences | Planned | D01 |
| C-I06 | Build a sequence with speech/audio/animation and equivalent skip effects | Planned | D02 |
| C-I07 | Configure a reachable ending | Planned | D03 |
| C-Q01 | Navigate from a validation error to its editor field and repair it | Partial | Diagnostics identify entity/path; error navigation and expanded checks remain |
| C-Q02 | Playtest a complete puzzle, correct it, and confirm preview/export parity | Planned | D04/B02; present preview/export parity covers inspection only |

## Player: exported game

| ID | Use case and successful outcome | State | Delivery / evidence |
| --- | --- | --- | --- |
| P-G01 | Load an exported game in a browser and see its starting room | Present | M0; shared Phaser room renderer |
| P-G02 | Click an element and receive a name-based observation | Present | M0; authored View text was removed pending action/rule authoring |
| P-G03 | See a protagonist, click walkable ground, and route around supported obstacles | Planned | R02/R03 |
| P-G04 | View an object through character-attributed speech without approaching by default | Planned | R03; replaces direct observation presentation |
| P-G05 | Select explicit verbs, preview a command, cancel/replace it, and get distinct feedback | Planned | R03/P01/P02 and [player UI requirements](08-player-actions-and-ui.md) |
| P-G06 | Reach an object before Pick up/Use/Open/Close/Push/Pull/Give effects execute | Planned | R03 foundation; P01/P02 effects |
| P-G07 | Traverse connected scenes through exits and return with coherent state | Planned | R04/P04 |
| P-G08 | Collect, inspect, use, give, and combine inventory items | Planned | P02/P03 |
| P-G09 | Talk to NPCs, choose conditional dialogue, and trigger an ending | Planned | D01/D03 |
| P-G10 | Watch/skip a sequence without changing its consequential outcome | Planned | D02 |
| P-G11 | Save/load progress and adjust reading/audio settings | Planned | D03/B02 |
| P-G12 | Complete core play with keyboard, readable labels, and visible focus | Partial | Existing browser shell has basic semantics; full keyboard gameplay is planned |

## Maintainer and release operations

| ID | Use case and successful outcome | State | Delivery / evidence |
| --- | --- | --- | --- |
| M-T01 | Build, typecheck, and run format/browser/desktop checks | Present | Package scripts and test suites |
| M-T02 | Validate project structure and references with stable diagnostics | Present | Project-format v1 validator; scope limited to existing schema |
| M-T03 | Extend authored data while preserving older projects or giving a clear migration failure | Partial | v1 rejection exists; migrations and compatibility policy remain |
| M-T04 | Test the same authored behavior in preview and exported player | Partial | Shared runtime for inspection; expand at each feature |
| M-T05 | Package and qualify a desktop creator release and static player on declared platforms | Planned | B02/B03/U03; Electron development shell exists, release packaging is not established |
| M-T06 | Maintain starter assets, licenses, sample game, and creator documentation | Partial | Sample and design assets exist; full creator guide and redistribution audit remain |

## End-to-end paths and dependencies

1. **Current proof:** C-P01 → C-A02 → C-S01/C-S02 → C-P09 → C-P08/C-P10 → P-G01/P-G02. This proves project I/O and a simple shared runtime, not a complete adventure.
2. **First playable exploration:** C-C03 + C-S03/C-S04/C-S05 → P-G03/P-G04/P-G05 → C-S06/P-G07. This is the M1 gate.
3. **First puzzle:** C-I01/C-I02/C-I03/C-I04 → P-G06/P-G08, using the M1 approach boundary. This is the M2 gate.
4. **Complete game:** C-I05/C-I06/C-I07 → P-G09/P-G10/P-G11 → C-Q02. This is the M3 gate.
5. **Independent release:** C-Q01, recovery, browser/desktop qualification, guidance, and one observed nontechnical authoring flow. This is M4/M5.

The [development plan](06-development-plan.md) owns sequencing and acceptance. A use case becomes **accepted** only when its creator UI, data, runtime (where applicable), save/reopen, export, and relevant regression evidence agree.
