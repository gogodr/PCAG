# PCAG Creator: 16-bit visual direction

Date: 2026-10-29. Status: OpenPencil design file complete; implementation pending.

Current design file: [PCAG Adventure Studio](../design/pcag-adventure-studio.fig). Pages: Welcome, Project, Assets, Characters, Scenes, Animations, Components. The earlier [Figma concept](https://www.figma.com/design/IxmkU0ihCIMO7YkC8HzHB9) remains a research reference.

## Product idea

PCAG is a workshop for building point-and-click adventures. The editor should feel adjacent to the game world without making routine authoring harder. The design language borrows the clear silhouettes, limited palette, and crisp edges of 16-bit pixel art. Dense tools use readable modern type and conventional controls.

Working brand line: **PCAG Adventure Studio**. The mark is a small doorway/cursor motif: a scene is an entrance to a world the creator can edit.

## Research and decisions

| Evidence | Design decision |
| --- | --- |
| [ScummVM's Monkey Island gallery](https://www.scummvm.org/en/screenshots/lucasarts/mi/) shows the scene as the visual center of the classic adventure experience. | Give the welcome screen one authored scene image, and keep the scene canvas dominant in the editor. Avoid copying game artwork or the verb interface. |
| [Godot's editor overview](https://docs.godotengine.org/en/4.3/getting_started/introduction/first_look_at_the_editor.html) separates scene tree, viewport, inspector, files, and play controls. Its [inspector documentation](https://docs.godotengine.org/en/stable/tutorials/editor/inspector_dock.html) links selection to properties. | Keep PCAG's scene list, viewport, and inspector spatially stable. Make selection and the active scene unambiguous. |
| [Aseprite's timeline documentation](https://www.aseprite.org/docs/timeline/) separates layers, frames, cels, and loop ranges. Its [UI scaling guidance](https://www.aseprite.org/docs/preferences/) distinguishes image pixels from control size. | Use a clear frame strip and loop range in Animations. Pixel styling does not shrink text or targets. |
| PCAG's own [classic action research](03-classic-actions-and-controls.md) favors explicit actions and visible command construction. | Use named actions and file states. Icons support labels; they do not replace them. |

## Design system proposal

- **Palette:** midnight `#0B1824`, panel `#142636`, raised `#1C3444`, border `#365364`, parchment `#E8E3D3`, muted `#A8B9BB`, lantern `#F0C36F`, sea glass `#69BDB2`, warning `#E28F82`.
- **Type:** Pixelify Sans for the wordmark and major headings; IBM Plex Sans for forms, lists, and longer text. Tabular numerals for dimensions, frames, and time.
- **Shapes:** square corners, 1–2 px borders, an occasional offset pixel corner on a showcase panel. No CRT scanlines, glow, glass, or repeated decorative grids.
- **Icons:** one 16×16 pixel-grid family for project, assets, characters, scenes, animation, files, folders, background, elements, and playback. Always pair navigation icons with text.
- **Artwork:** an original moonlit coastal ruin made for this exploration, stored at `apps/creator/public/art/moonlit-ruins.png`. It is illustrative brand material, not a starter game asset.
- **Motion:** 240 ms ease-out for the rare welcome transition; 150–180 ms ease-out for menus and floating feedback; 100–160 ms press feedback. No animated list navigation, form editing, frame selection, or canvas decoration. Reduce positional motion when the OS requests reduced motion.

## Screens designed in OpenPencil

1. **Welcome:** scene art, concise product promise, one primary Create project action, distinct Import and Open actions.
2. **Project:** game dimensions and start scene beside save/readiness and export actions.
3. **Assets:** folder rail, file list, preview/details, clear import action and empty state.
4. **Characters:** roster, reference image, required animation progress and sprite slots.
5. **Scenes:** scene switcher, element list, game canvas, selected element inspector.
6. **Animations:** source selection, loop controls, large pixel preview and frame timeline.
7. **Components:** mark, navigation, buttons, fields, panels, status, file and scene icons, and interaction states.

## Review questions

- Does the workspace feel like an adventure creation tool when the sample art is absent?
- Can a new creator find Create, Import, Preview, and Export without decoding the visual theme?
- Are text, focus, selected states, and controls clear at 100% and 125% display scaling?
- Does the pixel language stay crisp while the game art remains the main visual asset?

The screen content is illustrative concept data. The moonlit artwork was generated with the built-in image tool from a prompt for a 16-bit moonlit coastal ruin, then placed as image fill layers in OpenPencil. Interface text, frames, controls, icons, components, and color variables are editable design objects.
