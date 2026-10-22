# Player actions and UI requirements

Date: 2026-10-22. Status: implementation requirements derived from the requested classic-adventure reference. The visible protagonist and arrival-gated Pick up/Use are confirmed user requirements. M1 implements the Walk/View UI subset and approach/cancellation foundation; [M1 evidence](../development/m1-evidence.md) records its scope. Inventory, physical verb effects, conversation, and remaining release UI/settings are pending. The classic verb bar, detailed control mappings, and reset policies remain implementation defaults to validate with users.

Read the [reference findings](../research/03-classic-actions-and-controls.md) for historical evidence and the [character specification](07-character-and-interactions.md) for movement/execution invariants. This document governs the initial player UI and supersedes earlier contextual-only primary-action recommendations. It does not change the completed scope of M0.

## Action vocabulary

**ACT-01:** Support the following first-release actions as distinct semantic identifiers. UI labels may be localized; saved rules refer to stable identifiers. View is the player label for existing `inspect`. Other identifiers below are proposed contracts to settle when their schema is introduced, not APIs already present.

| Player action | Proposed identity | Input | Approach policy | Intended behavior |
| --- | --- | --- | --- | --- |
| Walk to | `walk` | Ground point or scene target | Movement itself | Move the protagonist along a valid route; walking to an object alone never operates it |
| View | `inspect` | Scene object or owned item | None by default | Protagonist says the authored observation |
| Pick up | `pick_up` | Scene object | Required | After arrival and checks, acquire the item and update its world representation once |
| Use | `use` | Scene object alone, or owned item + target | Required for a scene target; none for inventory-only combinations | Operate an object or apply a specifically authored item rule |
| Talk to | `talk_to` | Character/conversation target | Required at a conversation approach point by default | Begin the configured conversation; remote conversations would need an explicit later exception |
| Give | `give` | Owned item + recipient | Required | Transfer only if the recipient's authored rule accepts it; refusal keeps ownership unchanged |
| Open | `open` | Scene object | Required | Execute its opening rule, including locks/conditions |
| Close | `close` | Scene object | Required | Execute its closing rule |
| Push | `push` | Scene object | Required | Execute the authored push behavior |
| Pull | `pull` | Scene object | Required | Execute the authored pull behavior |

**ACT-02:** Open, Close, Push, and Pull must remain independently authorable even when they share a command runner. They cannot silently resolve to a generic Use action. These verbs do not imply a physics simulation: a lever may change a fact and animation through a rule.

**ACT-03:** Turn on/off, taste, smell, bite, and other specialized verbs are future extensions. Do not infer that every historical verb must ship. Switching devices can be authored through Use initially. Inventory combinations are expressed as Use item A with item B, not a separate crafting interface.

## Player screen

**UI-01:** Use one stable desktop layout: scene and visible protagonist above; command sentence immediately below; readable verb buttons and inventory below that. Include a visible Walk control and Cancel control. Menu/settings remain reachable separately. Preserve scene aspect ratio and usable control sizes when the window changes. Themes may change appearance, not the location/meaning of core controls arbitrarily.

Conceptual layout, not a pixel specification:

```text
+---------------------------------------------------------+
| Scene: character, scenery, objects, exits       [Menu]   |
| Character-attributed speech appears here or in subtitles |
+---------------------------------------------------------+
| Use brass key with cabinet                    [Cancel]  |
+-----------------------------+---------------------------+
| [Walk to]                   | Inventory icons + names   |
| Give     Pick up    Use      | [Key] [String] [Magnet]   |
| Open     View       Push    |                           |
| Close    Talk to    Pull    | [Previous] [Next]         |
+-----------------------------+---------------------------+
```

**UI-02:** All nine interaction verbs remain visibly available by release, with Walk as the default exploration mode. Avoid hiding verbs according to whether a puzzle solution would succeed. Unsupported object/verb pairings produce feedback. Earlier milestones expose only implemented controls; do not ship nonfunctional buttons merely to match the final layout.

**UI-03:** Show selected verb and selected item persistently. Hover or keyboard focus previews the target name and full command, such as `Open cabinet`, `View window`, `Use brass key with cabinet`, or `Give letter to keeper`. Use neutral wording for incomplete commands, such as `Use brass key with…`. Hover/focus alone never executes gameplay or changes inventory.

## Pointer and command selection

**INPUT-01:** In default Walk mode, primary click on walkable ground starts walking. Primary click on a scene object requests walking to its approach point and performs no interaction. Choosing a verb first, then primary-clicking a scene target, requests that verb. A visible verb button must always provide the explicit route to the same action.

**INPUT-02:** Clicking walkable empty ground while a verb/item is selected cancels that selection and starts a new walk. Clicking non-walkable empty space produces an unreachable-destination response without moving through obstacles. Choose object hit testing before ground hit testing; clicking inventory or controls must not also issue a ground click.

**INPUT-03:** An object's configured suggested action can be highlighted while in default Walk mode and shown as a labeled quick action. Secondary click in that mode invokes it; the same quick action must have a visible, keyboard-operable control for the focused object. Suggested actions come from authored object behavior, not automatic discovery of the correct inventory pairing. If no suggestion is configured, use View. Preserve explicit verb selection even when another action is suggested.

**INPUT-04:** While composing a verb/item command, secondary click cancels that command instead of invoking a different quick action. Visible Cancel and Escape provide the same cancellation. Show the context-dependent shortcut in the command hint. After a completed or rejected action, clear verb/item selection and return to Walk mode; a retained item remains in inventory. This reset policy is a PCAG default to validate, not a historical compatibility promise.

## Inventory and two-target actions

**INV-01:** Clicking an owned item in Walk mode selects it as the source of Use; it does not consume it or immediately use it on itself. Show its icon near the pointer where practical, but retain the textual command for keyboard users. With View selected, clicking an item produces its observation. With Give selected, clicking an owned item selects the gift and waits for a recipient.

**INV-02:** With a source item selected, clicking a scene object completes Use or Give and submits the corresponding action. Clicking another owned item completes a combination attempt for Use. Give to an inventory icon is invalid unless a future explicit recipient model supports it. Selecting Give requires a source before a recipient; guide the player rather than guessing the item.

**INV-03:** Selecting Use then a scene object without an inventory source operates that object directly. A scene object never becomes a portable inventory source until a pickup/transfer rule grants ownership. For single-item self-use, defer specialized controls until a real game requires them.

**INV-04:** Invalid pairings, refused gifts, canceled approaches, and unreachable targets leave items unchanged. Valid combinations commit consumed/produced items together. Inventory ordering remains deterministic; scrolling/paging must retain selection and focus. Dragging may be a future shortcut, never the only path.

## Movement, speech, and control ownership

**EXEC-01:** Use the approach/revalidation contract in document 07. Physical verbs run only after valid arrival; no effect occurs merely because a click was accepted. Already-in-range interactions do not add an unnecessary walk. Invalidating the pending action prevents delayed execution after a later command or room transition.

**EXEC-02:** View defaults to an observation from the current position, including when a visible object's physical approach point is unreachable. A View request during an interruptible approach stops that approach and cancels its pending effect before the character speaks. Speaker identity must remain clear; voice files are optional.

**EXEC-03:** During walking, keep the intended command visible and allow replacement/cancellation. During consequential action execution, dialogue, a menu, or a cutscene, make input ownership explicit. Locked controls explain their temporary state; repeated clicks cannot enqueue duplicate effects. Opening a menu pauses/suspends gameplay input, and closing it restores a documented state.

**DIALOGUE-01:** Talking opens a clearly separate choice panel. Show available lines/topics with keyboard focus, select one once, and mark visited topics when retained. World verbs cannot fire underneath the conversation. Authors provide an exit option or explicit conversation completion; returning to exploration restores Walk mode.

**FEEDBACK-01:** Distinguish unsupported action, failed puzzle prerequisite, unreachable destination, and successful action. Prefer short in-character responses with shared fallbacks. Do not silently ignore a click or reveal which hidden puzzle condition will make it succeed. View text is an observation, not an engine notification.

## Accessible controls and settings

**ACCESS-01:** All verbs, targets, items, quick actions, dialogue options, and menus support Tab/Shift+Tab focus and Enter/Space activation with visible focus. Escape cancels an active selection/pending walk, otherwise closes an applicable panel or opens the pause menu. It must not both cancel and skip a sequence on one press. Provide a separate visible Skip control for skippable sequences.

**ACCESS-02:** Provide a keyboard movement path: in Walk mode, focus the scene and use arrows to position a visible destination marker; Enter requests walking to that marker. Arrows must not move the character through collisions or steal keys from text fields. Hotspots and exits also remain focusable targets. Document this control in Help. This is PCAG's accessibility adaptation, not copied historical behavior.

**ACCESS-03:** Do not require right-click, hover, holding a button, precise dragging, or color discrimination for an essential action. Optional single-letter verb accelerators must be documented and suppressible/remappable or otherwise avoid interfering with assistive technology and text entry. Standard browser shortcuts retain their meaning; do not assign F5 to game saving.

**ACCESS-04:** Provide readable character labels/subtitles, text-size and reading-speed settings, audio levels, and a visible player menu for saves/settings. Player saves are distinct from creator project backups. Dialogue advancement and sequence skipping must preserve their declared consequential effects. Full touch/controller mappings remain later scope.

## Nontechnical authoring requirements

**AUTHOR-01:** In the object inspector, configure separate verb responses/rules, a suggested action, View speech, proximity destination/facing, and fallbacks. Supply presets for scenery, collectible, door, lever, and conversation target. Standard physical verbs automatically use the shared approach pipeline; authors must not repeat walk commands in every rule.

**AUTHOR-02:** Keep object affordances separate from rule success. A locked door may still suggest Open and answer that it is locked. Do not disable Open solely because the required key is missing. Author rule conditions and effects through typed pickers/cards; report ambiguous precedence before export.

**AUTHOR-03:** Validate suggested-action references, missing interaction destinations, actors, asset/text references, item ownership rules, and dialogue destinations. Provide error navigation. Preview and export consume the same authored action data and interpreter. Introducing the expanded model must include an explicit compatibility path for existing M0 inspection projects; retain `inspect` identity and never invent missing protagonist artwork/geometry silently.

## Milestones and acceptance

These requirements refine existing backlog items. R01–R04's constrained M1 implementation is recorded in the evidence above; the remaining M2/M3 requirements are pending. They do not change the milestone sequence or expand M0's historical scope.

| Requirement group | Backlog | Acceptance evidence |
| --- | --- | --- |
| UI-01/03, INPUT-01/02/04, EXEC-01/02; Walk and View subset | R02–R04 | Visible character walks; commands/focus are readable; View speaks without approach; pending actions cancel correctly; save/reopen/export agree |
| ACT-01/02 physical verbs, INV-01–04, AUTHOR-01/02 | P01–P04 | Explicit verbs have distinct rules; pickup/use/give wait for arrival; combinations are atomic; failed physical actions preserve state |
| Talk to, DIALOGUE-01, EXEC-03, ACCESS-04 | D01–D03 | Conversation approach and choices work; input cannot leak to world; menu/save/skip behavior is consistent |
| ACCESS-01/02/03 and error navigation | Begin R03; complete D03; qualify B03/B04 | Full core flow works using keyboard and without secondary click; readable failure guidance |
| AUTHOR-03, full preview/export consistency | Each affected item; B01/B02 hardening | Compatible content is preserved or rejected clearly; same action outcomes in preview/export |
| Usability of the selected defaults | U01/U02, earlier observations when available | Participant understands verb selection, source/target composition, cancellation, and arrival requirements without developer rescue |

Minimum behavioral cases:

1. Select View, then a distant observable object: protagonist speaks and does not approach.
2. Select Open and Push on the same authored object: each reaches its own rule; neither silently becomes Use.
3. Select Pick up on a distant item: inventory changes only after arrival; repeat clicks do not duplicate it.
4. Select key, hover cabinet, then click: command previews Use with both names; no early item consumption.
5. Attempt an incorrect combination or refused Give: response appears and inventory is unchanged.
6. Cancel or replace a walk-to-use request: no old effect occurs later; unreachable approach likewise changes nothing.
7. Hover/focus a locked door: suggestion can be Open without disclosing its hidden unlocking condition.
8. Use the quick action and explicit verb path: both submit the same semantic request and produce the same result.
9. Operate movement, View, inventory targeting, cancellation, and conversation using keyboard only.
10. Run the same authored sequence in preview and exported game: action, speech, inventory, and world-state outcomes match.
