# Foundation fixture

`project.json` is the schema-v2 exploration fixture used by the creator, development player, and tests. It has a study, a hall, a visible explorer, supported navigation geometry, and return exits. `project-v1.json` preserves the original M0 fixture for migration checks.

`study.png` is original geometric artwork drawn for this repository during M0. `explorer.png` is an original 8-frame, 48 × 80-pixel character sheet drawn during M1: frame 0 idle, frames 1–4 walk, frames 5–7 talk. `character.json` stores its embedded image for the new-project starter template. Embedded copies make projects portable. There are no third-party art, font, or audio dependencies; no external asset license is required for these fixtures.

Inspectable objects exercise stable identity and protagonist speech. These engineering fixtures were assembled programmatically; they are not the later complete reference adventure or evidence of independent human authoring. Browser tests separately create projects, connect rooms, draw shapes, and map imported character artwork through actual creator controls.
