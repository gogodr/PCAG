# Escoria reference review for F01

Reviewed: 2026-10-22. Reference: official **Escoria 4.0.0 documentation**, `en/devel` channel. This is a documentation review, not a source/runtime audit. The channel is mutable; no immutable source revision is claimed. The [documentation home](https://docs.escoria-framework.org/en/devel/) warns that information can be incomplete or outdated. No Escoria code or assets are incorporated.

## Findings and independent choices

| Area | Observed in the reference | PCAG choice and limits |
| --- | --- | --- |
| Rooms and actors | Rooms contain a background, optional terrain/items/location points. The player handles movement and actions; Escoria also allows games without a visible player. [Concepts](https://docs.escoria-framework.org/en/devel/general/what_is_escoria.html) | Use declarative room/actor records, not Godot nodes. PCAG requires a visible protagonist from M1; the temporary M0 inspection proof is not the release experience. |
| Durable room state | Object states are global, saved, and applied when scenes instantiate. [ASHES: object states](https://docs.escoria-framework.org/en/devel/scripting/z_ashes_reference.html#states) | Reconstruct room presentation from authored definitions plus durable session state. Do not store puzzle truth in sprites or React components. R04/P04 verify reconstruction. |
| Action execution | Input passes through the game interface to `escoria.do`; the documented path can move to an object's interaction position before dispatching its verb/tool event. Separate managers handle actions and event scheduling. [Architecture](https://docs.escoria-framework.org/en/devel/advanced/escoria_architecture.html) | Normalize input to actor/action/source/target requests. Separate click bounds from approach points. PCAG explicitly requires post-arrival revalidation and stale-action rejection; these guarantees were not established by this reference review. |
| Inventory | Inventory display supports actions on items and combinations with room or inventory targets. Configuration includes source/target direction and inventory-only use. [Inventory guide](https://docs.escoria-framework.org/en/devel/advanced/create_inventory.html) | Keep ownership in core state and source selection in UI state. Explicit combination direction and atomic consumption/production need PCAG rules and P02/P03 tests; the guide does not prove transactional behavior. |
| UI and dialogue | UI and dialogue implementations are separable from the core; basic speech/dialogue handling does not prescribe its display. [Setup guide](https://docs.escoria-framework.org/en/devel/getting_started/step_by_step/1_create_escoria_project.html) | Share one standard player UI between preview and export. Keep domain logic independent of renderer/UI, without building a plugin framework for F01/M0. |
| Save compatibility | Saves record engine/game versions, scene information, globals, and registered object data; game-specific migrations require developer logic. [Save system](https://docs.escoria-framework.org/en/devel/advanced/load_save.html) | Separate project-schema and player-save policies. A project backup is not a gameplay save. Specify safe resume boundaries in D03 and harden compatibility in B01/B02; do not copy Godot save resources. |

Escoria's text scripting is useful as a catalogue of adventure operations. PCAG instead needs typed, declarative conditions/actions edited through forms and cards; imported projects must not execute arbitrary code. This is a product choice, not a finding that Escoria's authoring workflow meets PCAG's nontechnical-user goal.

## Historical findings re-evaluated

Read historical records using `git show fdc0bda:archive/first-build-2026-10-22/docs/decisions/0002-escoria-reference-study.md` and the adjacent `0001-foundation-architecture.md`. The archive directory is absent from this working tree, so Git is the available historical source.

The former study's room/player and UI-separation observations still agree with the reviewed documentation. The new review adds explicit action, saved-state, and inventory references. Historical localStorage, embedded-image JSON, rectangular geometry, renderer mode, dependency versions, capacity limits, and passing browser tests are not adopted as validated rebuild decisions. They require new evidence in their owning items.

## Evidence boundary

The official pages above were opened and reviewed for this F01 pass. No demo was run and no source-level cancellation, skip, transaction, migration, or performance behavior was verified. If later implementation depends on such an Escoria detail, inspect a pinned source revision and reproduce the behavior first. PCAG's confirmed requirements take precedence over reference behavior.

Proceed to the [foundation decisions](../decisions/0001-rebuild-foundation.md) and [review guide](../development/f01-review.md).
