# Scene inspector redesign

Design source: [OpenPencil board](scene-inspector-redesign.fig). Previews: [elements, player, events](previews-inspector/board-1.png) and [state, walkable area, background](previews-inspector/board-2.png).

Desktop adaptation: [wide OpenPencil board](scene-inspector-desktop.fig) and [preview](previews-inspector/desktop.png).

The inspector remains below the scene canvas. Every selection uses the same header with its icon, kind, name, scene, and a useful detail such as an ID or item count. Compact, aligned controls sit in quiet bordered groups so the selected object and its editable properties are easy to scan.

- Box and Shape: name, position, and available actions. Shape keeps vertex editing on the canvas.
- Image: source file and type, geometry, aspect ratio, animation playback, and available actions.
- Overlay: full-scene image source and alignment guidance; no geometry or actions controls.
- Player: character and animation preview beside placement and anchor controls.
- SceneState and GameState: a compact variable list with name, type, current value, default value, and remove action.
- SceneManager: an event toolbar and compact event cards with trigger and script controls.
- Walkable Area: mask preview, file controls, and depth scale.
- Background: image preview and source control.

Desktop adaptation: the inspector uses its full working width up to a readable 1900px content measure. Box and Shape place name, geometry, and actions on one row. Image adds source and playback on a second row; Overlay places its source beside the name. Player puts animation controls beside the preview, with placement in a third panel. Variables and events flow into multiple columns as space permits. The layout collapses to one column at narrower widths. Existing control names and behaviors remain available to keyboard and assistive technology users.
