# Shared gameplay features and proposed UX

Date: 2026-10-21. Status: initial research and design proposal.

## Scope and terminology

The target is a reusable framework for third-person 2D graphical adventures: authored locations, a visible protagonist, interactive objects, conversations, and state-dependent puzzles.

Confirmed clarification, 2026-10-22: the visible protagonist moves through scene clicks. View makes the character say what they see; Pick up and Use require walking to the object when reachable before execution. The [character and interaction specification](../planning/07-character-and-interactions.md) defines the action-specific behavior and acceptance cases. M0's characterless inspection is temporary prototype behavior.

Product clarification: games target browsers and are authored by nontechnical creators; programmers maintain the framework. Every standard gameplay feature therefore needs an approachable authoring workflow, not only a programming API. See the [browser creator proposal](../planning/04-browser-creator.md).

The authoring requirement is end-to-end: one nontechnical person must be able to create a complete small adventure using the provided tools. Every feature included in the supported baseline needs creation, editing, preview, validation, and persistence support that does not depend on a programmer.

SCUMM was a LucasArts adventure technology; ScummVM is a collection of replacement runtimes that plays supported games using their original data. ScummVM is a useful reference for the genre, but is not the authoring environment proposed here. [ScummVM project](https://www.scummvm.org/), [project README](https://github.com/scummvm/scummvm)

## Representative interaction families

This is a qualitative reference sample, not a popularity ranking or a claim that every adventure shares every feature. Original releases and remasters can differ.

| Reference | Pattern to study | Framework implication |
| --- | --- | --- |
| The Secret of Monkey Island | Explicit verbs combined with world objects and inventory; player-selected conversation lines | Represent actions independently from mouse buttons and UI widgets |
| Day of the Tentacle | Multiple protagonists and puzzles whose effects cross character/location boundaries | Keep durable world state separate from the currently loaded room |
| The Curse of Monkey Island | A compact contextual verb coin | A smaller visible action set can still express rich interactions |
| Broken Sword II | Context-sensitive primary action, secondary inspection, and icon-based conversation topics | Dialogue choices need stable IDs; their presentation can be text or icons |
| Thimbleweed Park | A later reference for multiple protagonists and a classic adventure vocabulary | Character identity belongs in the data model even if version one uses one protagonist |

Sources: [LucasArts classic collection manual](https://mocagh.org/lucasfilm/classiccollection-manual.pdf), [Day of the Tentacle manual](https://www.mocagh.org/lucasfilm/lucasartsarchives1-alt-manual.pdf), [Curse manual](https://www.mocagh.org/lucasfilm/mi3-manual.pdf), [Broken Sword II original manual](https://evercade.info/wp-content/uploads/2025/02/Broken-Sword-II-The-Smoking-Mirror-USA.pdf), [Thimbleweed Park developer discussion of characters](https://blog.thimbleweedpark.com/character_sheet.html).

Evidence limitation: the first two large manual PDFs exceeded the browser retrieval limit. Their indexed excerpts were available, but full page-by-page verification was not performed. Treat the table as an initial design reference and verify exact controls in a later hands-on comparison. The developer post confirms Thimbleweed Park's multiple protagonists; its detailed controls still need direct verification.

## Shared systems to standardize

The following is our synthesis of the reference patterns and the recurring systems documented by existing adventure frameworks. It is a proposed scope, not a universal checklist of historical games. Existing tools independently group inventory, interaction, dialogue, movement, and persistence as adventure concerns. [Escoria feature overview](https://escoria-framework.org/), [Adventure Creator](https://adventurecreator.org/)

| System | Common player behavior | Proposed framework responsibility |
| --- | --- | --- |
| Rooms and exploration | Visit locations and move between them | Room definitions, exits, transitions, spawn positions, camera limits |
| Character movement | Click to walk; approach an object before acting | Walkable regions, paths, approach points, facing, unreachable feedback |
| Hotspots | Discover and identify interactive scenery or people | Hit regions, labels, priority for overlapping objects, enabled state |
| Actions | Inspect, operate, pick up, talk, give, or use an item | Shared action identifiers, validation, execution, and fallback responses |
| Inventory | Collect, inspect, select, use, and lose items | Ownership, stable item IDs, selection, item state, deterministic ordering |
| Item combinations | Use one possession with another | Authored combination rules, prerequisites, consumption, resulting items |
| Dialogue | Choose lines/topics and learn information | Conditional options, visited topics, reusable nodes, effects, exit behavior |
| Puzzle progression | Change the world and unlock possibilities | Typed state, conditions, effects, one-time actions, persistent consequences |
| Sequences | Watch speech, gestures, and scripted events | Ordered commands, input ownership, interruption and skip behavior |
| Presentation | Understand feedback through animation, text, and sound | Speaker labels, subtitle timing, audio hooks, character animation hooks |
| Persistence | Resume without losing puzzle progress | Save/load, settings, stable identifiers, schema versions |

Branching dialogue does not imply branching endings. Many conversations simply reveal information, enable another topic, or set a puzzle flag. The framework should support those small consequences without requiring a large narrative tree.

## Item combination versus crafting

For this project, start with **authored item combinations** rather than a general crafting economy.

Example: `string + magnet -> magnet_on_string` may consume both ingredients. Using a reusable tool on an item may transform the item but retain the tool. Giving an item to a character is a transfer, not a combination. Showing an item to a character may only start dialogue.

Each rule should declare its prerequisites, whether ingredient order matters, consumed items, produced items, state changes, and response. Commit inventory changes together so cancellation or failure cannot destroy only half the ingredients. A failed combination should leave inventory unchanged.

Resource harvesting, stacks, durability, workbenches, and recipe discovery are optional future extensions. They are not necessary to support the requested classic adventure loop.

## Proposed standard player experience

Recommendation: ship one consistent default interface first. Theme colors, fonts, icons, and panel artwork per game, while retaining the same interaction rules and layout structure.

Updated 2026-10-22: the [classic-actions reference review](03-classic-actions-and-controls.md) and [player UI requirements](../planning/08-player-actions-and-ui.md) select a visible verb bar, command sentence, and inventory as the initial desktop default.

1. Clicking walkable empty space moves the protagonist.
2. Hover or keyboard focus identifies a hotspot and previews its primary action.
3. Select an explicit verb, then primary-click its target. Default Walk mode moves toward a scene target without operating it. Physical actions first approach, revalidate, and then execute; unreachable targets produce feedback without effects.
4. View is an explicit verb and does not require walking by default: the protagonist delivers an attributed observation. In Walk mode, secondary click invokes the object's displayed suggested action; while composing a command, it cancels. Both operations have visible controls.
5. Inventory uses a consistent panel. Click an item to select it, then click its target. Dragging can be an additional shortcut, never the only method.
6. The UI previews the intended command, such as “Use key with cabinet,” before execution.
7. Cancel clears the selected item or pending action. Once an irreversible scripted effect begins, cancellation follows the sequence's declared policy.
8. Dialogue uses a consistent option panel and marks previously selected topics. Game rules decide whether exhausted topics disappear or remain available.
9. Invalid actions produce a short authored response or a shared fallback. Silence should not look like an input failure.

Keep these rules configurable only where a game actually needs an exception. Supporting many interchangeable interfaces immediately would dilute the standardization goal.

The classic verb bar is now the selected implementation default to validate. Open, Close, Push, Pull, and Use retain distinct authored meanings. The contextual suggestion is a shortcut, not the only available interaction or an indication that the suggested action solves a puzzle.

## Quality-of-life proposals

- Adjustable subtitle size and speed, clear speaker identification, and separate audio levels.
- Keyboard focus and activation for hotspots, inventory, and dialogue.
- Optional hotspot reveal; avoid requiring pixel hunting.
- No essential information available only through color, hover, or sound.
- Skippable presentation with the same resulting game state as normal playback.
- Manual saves plus autosaves at safe boundaries.
- Default puzzle policy: avoid permanently consuming essential items without a recovery route.

These are proposed standards, not claims about the original games. Touch and controller mappings should preserve the action model, but need their own usability validation.

## Optional genre features

Multiple protagonists, time travel, journals, hint systems, timed puzzles, death/retry, close-up puzzle screens, and minigames should be extensions. A reusable core should not assume all games need them.

## Next research step

Play a small, comparable segment of each reference and record: discovering a hotspot, inspecting, taking an item, using it in the room, combining items, selecting dialogue, canceling, and saving/loading. Record the exact edition, inputs, feedback, and exceptions. This will validate the proposed UX before implementation.
