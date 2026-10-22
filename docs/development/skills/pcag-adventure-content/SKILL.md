---
name: pcag-adventure-content
description: Author PCAG reference adventures, reusable puzzle behaviors, starter assets, and creator walkthroughs through the supported tools. Use for playable content and onboarding that validate framework reuse.
---

# PCAG adventure content

Read the [proof adventure](../../../planning/03-framework-plan.md), [creator acceptance](../../../planning/04-browser-creator.md), and P04/D04/B04 in the [development plan](../../../planning/06-development-plan.md). This skill exercises the creator; it does not authorize implementing a new art suite or generating assets through paid services.

## Content responsibilities

Build understandable puzzles using the supported actions, facts, inventory, dialogue, and sequences. Keep content separate from engine code. A missing editor capability is a product gap to record, not a reason to hard-code the sample or manually repair its data and declare authoring complete.

Use supplied or imported art/audio with recorded origins and redistribution permissions. Keep character scales, pivots, animation mappings, and inventory icons consistent with the implemented import contract. Original artwork production is not a release prerequisite.

## Reference adventure

Author two rooms, one playable character, one NPC, a locked cabinet, and a modest inventory. Use the planned progression: learn information through dialogue; collect string and magnet; combine them; recover a key; unlock the cabinet; give its contents to the NPC; reach an ending. Include incorrect item use and a conditionally unlocked dialogue option.

Before authoring, sketch the dependency chain: prerequisite facts/items → action → consequential changes → next available action. Specify consumed versus retained items, one-time effects, failure feedback, and the intended ending condition. Check that essential items cannot be permanently consumed without the intended recovery path. Do not assume the validator proves the puzzle solvable.

Create the content through visual tools. During early engineering, fixtures may be written programmatically for tests, but label those as fixtures rather than evidence of creator-authored content. Keep the maintained reference adventure reproducible and record the tool version used.

## Templates and guidance

Provide editable starter behaviors for collectibles, locked objects, and combinations as those features arrive. Templates must create valid independent IDs/references and remain understandable after insertion. Avoid special engine branches that only recognize the sample's names or IDs.

Write creator walkthroughs using actual UI labels and actions. Cover new project, asset import, rooms, interactions, dialogue, preview, error correction, save/reopen, backup, and playable export. Explain the distinction between editing a project and saving player progress. Keep terminal/setup instructions in maintainer documentation, not required creator steps.

## Verification

Complete the reference adventure in preview and export, exercise incorrect actions and room revisits, and check the same final consequences. Create a second small puzzle with different content through the existing tools and without runtime changes. Record authored files, playthrough steps, asset provenance, and uncovered gaps. The M5 independent participant must invent a new adventure; completing this prepared scenario does not satisfy that separate gate.
