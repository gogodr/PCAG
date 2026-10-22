# Playable character and interaction rules

Date: 2026-10-22. Status: confirmed product direction, with implementation defaults identified below. M1 implements character movement, View speech, room traversal, and the approach/cancellation boundary. Physical pickup/use effects remain M2 work. See [M1 evidence](../development/m1-evidence.md).

## Confirmed experience

PCAG targets third-person adventures with a visible, playable character moving through the scene. The user's reference is the classic character-led adventure experience associated with ScummVM games. Clicking a location directs the character there. Interactions are actions performed by that character.

- **View:** the character says what they see.
- **Pick up:** the character walks to the object, if able, and then picks it up.
- **Use:** the character walks to the scene object, if able, and then uses it or applies the selected inventory item.

The original M0 player was a direct-hotspot inspection proof for authoring, persistence, and export. M1 replaces that characterless presentation with the visible protagonist and character-attributed observations. M0's historical gate remains limited to the foundation workflow.

## Action behavior

The following defaults make the confirmed direction implementable. View/Look/Inspect refer to the same observation action; retain the existing internal `inspect` identity rather than adding three different actions. The [player actions and UI requirements](08-player-actions-and-ui.md) now specify a classic verb bar, sentence preview, inventory targeting, and contextual shortcut as the implementation default. View remains explicit and distinct from Pick up/Use.

| Input or action | Movement | Result |
| --- | --- | --- |
| Click walkable scene space | Route the visible character to the clicked destination | Walk animation while moving; idle on arrival |
| View a scene object | Default: observe from the current position, with no required approach | Character delivers the authored observation |
| Pick up a scene object | Reach its authored approach point first | Revalidate, then transfer the item and update its world appearance once |
| Use a scene object | Reach its authored approach point first | Revalidate, then perform the configured interaction |
| Use an inventory item on a scene object | Reach the target's authored approach point first | Recheck ownership/conditions, then apply the item rule |
| Open / Close / Push / Pull | Reach the object's authored approach point first | Execute the selected verb's distinct authored rule |
| Give an inventory item to a recipient | Reach the recipient's approach point first | Transfer only if the authored response accepts it |
| Talk to a character | Approach a conversation point by default | Start the authored conversation; this proximity policy is a PCAG default |
| Inspect an inventory item | No scene movement | Character delivers the item's observation |
| Combine two inventory items | No scene movement | Apply the authored combination rule atomically |

The no-approach View default follows the distinction between observing and physically interacting. View is not blocked just because an object's approach point is unreachable. Visibility/enabled conditions still apply. A future exceptional close-up action needs an explicit rule; do not silently make all View actions require walking.

For speech, the initial presentation default is readable text clearly attributed to the protagonist, with talk animation where available. Speech may use a bubble or a speaker-labeled subtitle area. Recorded voice is optional; voice production is not required to author an observation. Basic character observations belong in M1, before the full M3 conversation system.

## Approach and execution contract

Object bounds describe what the player can click. An **approach point** describes where the character's feet must arrive to interact, usually on walkable ground beside or in front of the object. Do not route to the center of a cabinet, wall, or elevated item just because that is its click target.

1. Validate the actor, selected action, target, item ownership, and currently known prerequisites.
2. For actions requiring proximity, find a valid route from the character's current feet position to the authored approach point. If already within the defined arrival tolerance, no extra walk is necessary.
3. Move the character along that route. Keep the intended action pending; picking up, consuming items, changing flags, and triggering interaction effects must wait.
4. On arrival, confirm the pending action is still current, the target still exists and is enabled, prerequisites still hold, and the character is in range. Face the object, then execute once.
5. Show the action result and return control according to the action/sequence policy.

If no valid route exists, the character gives understandable feedback such as “I can't reach that.” No pickup/use effect occurs and inventory remains unchanged. Never teleport or execute remotely as a fallback. Distinguish this from an invalid combination or a failed puzzle condition, which may have its own response.

During approach, a new destination/action or Cancel invalidates the old pending interaction. Room changes and preview teardown do the same. A late arrival callback cannot execute a superseded action. Once consequential execution has begun, follow declared sequence boundaries instead of promising cancellation can reverse committed effects.

## Creator requirements

Creators must be able to configure these without code:

- Place the protagonist and set its spawn position, feet/pivot anchor, facing, and supplied idle/walk/talk animation mappings.
- Draw supported walkable space and obstacles, with clear feedback for unsupported geometry.
- Place object click bounds independently of an approach marker, and set the desired facing where needed.
- Choose available object actions and write the protagonist's View response and unreachable feedback.
- Preview the character's movement and interactions using the same runtime as exported games.

Provide defaults and validation for missing actors, invalid spawn positions, and approach points outside walkable space. Whether a valid point is reachable from the actor's current position is also a runtime pathfinding check. Do not claim static validation establishes all dynamic reachability.

## Delivery and acceptance

The [roadmap](05-roadmap.md) and [backlog](06-development-plan.md) keep the existing milestone order:

| Stage | Required evidence |
| --- | --- |
| M1 / R02 | A visibly placed protagonist, feet anchor, walkable geometry, approach markers, and animation mappings are editable and survive save/reopen |
| M1 / R03 | Click-to-walk routes around a supported obstacle; View produces a character-attributed observation without an approach; cancellation invalidates a queued proximity action; unreachable approach requests fail clearly |
| M1 / R04 | The character traverses two connected rooms with valid entrance placement and no stale action from the previous room |
| M2 / P02–P04 | Real pickup and use effects occur only after arrival/revalidation; item/world state changes once and survives room revisit |

M1 can test the pending-action boundary with an integration fixture; that does not count as shipping inventory or pickup authoring before M2. M1's basic `say` presentation is reused and expanded by M3 dialogue/sequences.

Regression scenarios must include: View on a distant object; View on an observable object with no reachable approach; pickup/use on a reachable distant object; pickup/use while already in range; an obstructed route; an unreachable target; a new movement click during approach; target/condition changes before arrival; and a room change during approach. Compare preview and exported behavior. Assert that no physical interaction effect occurs before valid arrival or after cancellation.
