# Classic adventure actions and controls

Research date: 2026-10-22. Purpose: inform PCAG's player interface. This is a primary-document review, not a hands-on game audit. Implementation requirements are in [player actions and UI](../planning/08-player-actions-and-ui.md).

## Scope of the reference

ScummVM has application-level controls and game-specific controls. Its official documentation directs users to individual games for their controls; it does not define a universal adventure verb list. Keep runtime menu shortcuts separate from game actions. [ScummVM keyboard documentation](https://docs.scummvm.org/en/latest/use_scummvm/keyboard_shortcuts.html)

For PCAG, use classic LucasArts SCUMM adventures as the principal reference, especially the original verb-panel interfaces. This narrows the user's ScummVM reference without implying every supported game shares that design.

## Verified interface patterns

| Reference | Documented behavior | Relevance to PCAG |
| --- | --- | --- |
| Monkey Island 2, KIXX manual, printed pp. 2 and 4–5 | Nine verbs: Give, Pick up, Use, Open, Look at, Push, Close, Talk to, Pull. Walking is the default. Scene above, verb panel and inventory below, sentence preview between. Hover suggests a verb; right-click invokes it. Other verbs remain selectable. | Explicit choices plus a faster contextual shortcut; readable command construction |
| Day of the Tentacle, White Label manual, printed pp. 2–4 | Verb-plus-object commands can take two objects. Selecting an inventory item can begin Use; the item becomes the cursor. Dialogue presents selectable lines. The tutorial shows both Look at and Pick up walking to the object. | Inventory targeting and conversation modes; proximity cannot be inferred from a universal historical Look rule |
| Curse of Monkey Island demo instructions, LucasArts Archives III manual, printed p. 35 | Holding a click opens a three-part verb coin: hand for physical actions, skull for observation, parrot for speech/mouth actions. Release executes the chosen interaction. | A compact alternative groups several verbs; it does not remove their underlying meanings |

Sources: [Monkey Island 2 original manual scan](https://www.mocagh.org/lucasfilm/mi2kixx-manual.pdf), [Day of the Tentacle original manual scan](https://www.mocagh.org/lucasfilm/maniac2wl-manual.pdf), [Curse demo instructions in the publisher's collection manual](https://www.mocagh.org/lucasfilm/lucasartsarchives3-manual.pdf).

Evidence limits: the first two PDFs were available as extracted full text. The large collection PDF exceeded retrieval limits; the Curse comparison uses its indexed publisher-manual excerpt and is specifically about the demo. No claim is made that every edition, remaster, or platform has identical inputs. No exact historical interface artwork is reused.

## Interpretation for this project

Adopt the explicit classic verb-panel pattern as PCAG's initial desktop implementation default. It makes the available puzzle language visible and supports distinct outcomes for Open, Push, and Use. A sentence preview communicates what will happen before the player commits a target. Inventory selection and dialogue need separate, clearly indicated interaction states.

This replaces the earlier recommendation that a contextual primary click should be the only main action path. Retain a contextual shortcut as an aid, while keeping explicit verbs accessible. A verb coin can be evaluated later if observations show the persistent controls consume too much space; shipping several switchable interface systems is not required now.

PCAG deliberately keeps View available without approach by default, as documented in the [character specification](../planning/07-character-and-interactions.md). That is our design default, not a claim about all SCUMM games. Physical interaction and conversation proximity, cancellation, keyboard access, failure feedback, and persistence are specified independently in the requirements.
