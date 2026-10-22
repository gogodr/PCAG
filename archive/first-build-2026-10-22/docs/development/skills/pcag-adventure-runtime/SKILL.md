---
name: pcag-adventure-runtime
description: Implement PCAG interaction rules, puzzle state, inventory, dialogue, sequence execution, and safe player-save behavior. Use for renderer-independent adventure semantics and interruption correctness.
---

# PCAG adventure runtime

Read [interaction execution and state](../../../planning/03-framework-plan.md), [gameplay behavior](../../../research/01-gameplay-and-ux.md), and the active P/D backlog items in the [development plan](../../../planning/06-development-plan.md).

## Domain contract

Follow the confirmed [character and interaction rules](../../../planning/07-character-and-interactions.md). View/Look maps to `inspect` and produces protagonist-attributed speech without approach by default. Pick up and scene-targeted Use require arrival at the authored approach point before effects. Inventory-only inspection/combination requires no scene movement. An unreachable physical action produces feedback and no state change. Keep scene click bounds separate from proximity destinations.

Every input method submits the same request: actor + action + optional source item + target. Follow the [action vocabulary and execution requirements](../../../planning/08-player-actions-and-ui.md); keep Open/Close/Push/Pull/Use distinct and validate Give recipients/ownership. Quick actions and explicit verbs submit identical semantic requests. The core owns rules and durable state; presentation owns rendering/media and reports completion or cancellation through explicit interfaces.

For an interaction, validate mode, references, ownership, and prerequisites; resolve explicit rule precedence; approach if required; revalidate after movement; execute presentation and commit effects at declared boundaries; release input ownership with meaningful feedback. Report ambiguous rule matches in authoring rather than relying on accidental array order.

## Implement by feature

- **Cancellation:** give pending work an identity or equivalent invalidation mechanism. A replaced/canceled walk, room transition, or disposed preview cannot later execute its old action. Define how menus, dialogue, cutscenes, and walking cancel or suspend one another. Release input ownership on failure as well as success.
- **Facts and world state:** use declared typed flags/counters/enums. Reconstruct rooms from durable state; do not store puzzle truth solely on rendering objects.
- **Inventory:** specify ownership, ordering, source/target order policy, prerequisites, consumed inputs, outputs, and transfer semantics. Validate the whole change before committing it atomically. Invalid or canceled combinations preserve inventory; successful effects commit once. Showing, giving, and combining an item have different semantics.
- **Dialogue:** preserve stable node/option identity, conditional visibility, visited state, speaker/text references, choice effects, and explicit exit behavior. Conditions are evaluated against current game state. Prevent stale or repeated choice submissions from duplicating effects.
- **Sequences:** begin with the planned command vocabulary. Distinguish presentation from consequential effects and document commit/cancellation boundaries. Skipping must reach the same consequential state as normal playback without duplicate rewards. Do not implement skip by simply abandoning remaining effects.
- **Player saves:** serialize durable state and a valid resume location, not arbitrary asynchronous continuations or renderer objects. Defer saves during non-resumable work until a safe point and expose pending/succeeded/failed status. Coordinate identity/version checks and storage with project I/O.

Keep programmer extensions behind shared action/state contracts. Ordinary authored gameplay must remain possible with the visual condition and action controls; do not introduce an author-facing scripting language.

## Verification and handoff

Use focused domain tests for rule precedence, typed conditions, inventory conservation, dialogue effects, and one-time commits. Exercise connected systems for cancel-after-approach, prerequisites changing during movement, repeated requests, unreachable targets, room revisit, normal-versus-skipped playback, and save/load. Compare consequential state, not animation timing. Supply creator-facing configuration examples and diagnostics alongside runtime APIs; coordinate the corresponding visual controls before marking a feature complete.
