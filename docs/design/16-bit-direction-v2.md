# PCAG Adventure Workbench — design direction v2

This is a new OpenPencil exploration for the creator app. It replaces the visual direction of the first design file, while keeping that file for comparison. The seven editable boards cover Welcome, Project, Assets, Characters, Scenes, Animations, and the component language.

## Research translated into UI

- The SNES used tile-based graphics and palette-selected colors. That supports deliberate clusters, a small set of color ramps, and crisp scale changes rather than decorative blur or arbitrary gradients. Sources: [SNESdev palette reference](https://snes.nesdev.org/wiki/Palettes), [SNES PPU overview](https://snes.nesdev.org/wiki/SNES_PPU_for_NES_developers).
- Original period menus made actions and item categories visible in the play context. The *Secret of Mana* manual documents item, weapon, menu, and spell rings, with a separate icon/name for the current choice. The editor borrows this clarity through visible category rails, selected states, and scene context. Source: [Nintendo's original manual](https://www.nintendo.com/es-es/games/oms/snes-classic/manuals/secret-of-mana/manual.pdf).
- Point-and-click adventures made the scene and inventory equally important. The editor gives the scene canvas priority while keeping layers and element properties adjacent. Source for period visual reference: [ScummVM's Monkey Island screenshot archive](https://www.scummvm.org/en/screenshots/lucasarts/mi/).

These are visual and interaction references, not copied game assets. PCAG remains a modern desktop creation tool; this is not a hardware-accurate SNES simulation.

## Art direction

- **Brand:** PCAG / Adventure Studio. A simple doorway-like `P` crest and the phrase **The Adventure Workbench** frame the product as a place to make stories.
- **Palette:** near-black ink `#101727`, deep navy `#233650`, ocean blue `#34526C`, brass `#C8954D`, lantern gold `#F1C777`, parchment `#F6E2AE`, sea glass `#71C5B4`, coral `#E17D69`.
- **Surfaces:** stepped corners, outer shadow, colored bevel, inset wells, small brass corner jewels, and artwork inside the working windows. Large blank panels should contain a preview, a next action, or relevant project data. Interactive buttons and navigation use an 8–10 px radius; the surrounding game windows keep their pixel-cut corners.
- **Type:** Pixelify Sans is for large headings and meaningful numbers. IBM Plex Sans carries controls, labels, metadata, and long copy at readable sizes. Do not use tiny pixel text for functional UI.
- **Icons:** use the rounded [Material Symbols](https://developers.google.com/fonts/docs/material_symbols) set as editable vectors for all buttons and navigation, at 22–25 px. Keep pixel styling in the artwork, typography, and window trim. Consistent vector icons make small controls easier to recognize than the earlier 6×6 pixel glyphs.
- **Art:** original generated workbench vignette on Welcome, original Mara sprite in character and motion views, and an existing PCAG scene illustration in scene and asset previews.

## UX rules for implementation

- Scene canvas takes the primary space; scene list and element inspector remain visible around it.
- Assets use a browsable gallery with an always-visible selected asset preview and metadata.
- Character setup keeps sprite preview and animation readiness close to editable fields.
- Animation frames stay visible on a strip below the stage. Playback and frame controls should be functional, keyboard accessible, and easy to distinguish from decoration.
- Preview and export have different emphasis: preview is the everyday action, export is available but secondary.
- Pixel ornaments are decorative. Text and controls need real focus styles, labels, adequate pointer targets, and contrast against their immediate surface.
- Transitions should support orientation: a short 120–180 ms fade or 2–4 px movement for panels or selection; no continuous motion in the work area. Honor reduced motion settings. Use discrete frame changes for sprite playback, not smoothing.

## Assets and generated prompts

Both assets were created with the built-in image generation tool and saved into this workspace.

- `assets/adventure-workbench-v2.png`: “Create a compact 16-bit-era adventure workshop vignette: an ornate arched doorway opening onto a moonlit forest ruin, a brass compass, a rolled map, a tiny lantern, and a few inventory treasures arranged at its base. Strong readable silhouette, hand-placed crisp pixel clusters at a consistent coarse grid, subtle tile-like texture and layered shadows, rich indigo/teal/bronze/amber palette with limited color ramps. No text, no controls, transparent background.”
- `assets/mara-lighthouse-keeper-v2.png`: “Create one full-body female lighthouse keeper named Mara, standing in a neutral idle pose, facing slightly left. Practical coral-red coat over dark indigo clothes, brass lantern held at her side, short dark hair, sturdy boots. Crisp SNES-era pixel clusters, restrained 16-color palette, transparent background. No text, UI, scenery, extra poses, or characters.”

The images are editable as independent image fills in the OpenPencil document. Frames, type, colors, layouts, and state examples are native canvas elements.
