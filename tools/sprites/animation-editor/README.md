# Local animation editor

Import an MP4, WebM, MOV, or GIF into the project's `video/` asset folder, then open **Animations** in the PCAG desktop Creator app and select that file. The native React editor uses the same Python image processing routines as the sprite pipeline, so Pillow, NumPy, and OpenCV are required.

The browser-only Creator mode cannot run local video processing through Electron.

Projects created before the `video/` root still show their `animation/` assets. Move a source file from `animation/` to `video/` in Assets to make it available in the editor; its existing `_name` work folder moves with it.

On first selection, Creator creates `_video_name` beside the source file (for example, `video/walk_dummy.webm` → `video/_walk_dummy/`). This work folder stays hidden in Assets. The detector suggests a first loop, and the preview and timeline let you adjust the start and end frames. **Confirm Animation Loop** writes the chosen frames and `loop_analysis.json` into `_video_name/animation_loop/`. Selecting the same video later opens the loop editor directly. Renaming or moving the video within `video/` moves its work folder; deleting the source also removes its work folder.

In the loop editor, changes remain in the Creator session until export. The original video and confirmed source frames are never rewritten.

- **Reduce frames to target FPS** selects evenly spaced frames from the current sequence, keeping its first and last source frames. The playback rate becomes the target FPS.
- **Remove frame** deletes the selected thumbnail from the current sequence.
- **Undo / redo** cover frame reduction, frame removal, both background tools, pixel quantization, and applied palettes. Use the buttons or Ctrl+Z / Ctrl+Y (Cmd on macOS).
- **Remove background** previews the existing flat-background segmentation method. Toggle it again to restore the source backdrop. Inspect the preview for holes or fringes before export.
- **Targeted removal** removes the color region connected to a click on the current frame. An enclosed part of the character with the same color remains intact. The clicked frame keeps its manual edits when whole-loop background removal is turned on; that automatic pass skips manually edited frames.
- **Preview navigation** supports dragging to pan without dragging the image itself, the mouse wheel or +/- buttons to zoom without scrolling the page, and **Reset view** to fit and center the frame again.
- **Pixel quantize** previews the selected pixel size and a light grid over the current frame when the size exceeds 1. **Apply pixel quantize** uses nearest-neighbor sampling for every loop frame; size 1 restores full resolution.
- **Color palette builder** adds, edits, and removes RGB colors through its color dialog or by sampling the preview with the eyedropper. **Suggest palette** groups visible colors from the current sprite when their summed RGB channel difference is at most 80, up to 32 colors. Review and edit the suggested colors before **Apply Color Palette**, which maps each pixel block to its nearest palette color while preserving alpha. Remove all draft colors and apply to clear the palette.
- **Export GIF and atlas** opens a folder picker starting in the project's `animation/` asset root. One export writes a named GIF, PNG atlas, and atlas JSON into the selected folder. Exports use the current frames, fps, background setting, dimensions, applied pixel size, and palette. Repeated exports receive a new name instead of replacing existing files.

When the destination is inside the project's `animation/` folder, Assets shows the atlas JSON as one entry and plays its companion GIF in the preview. Its **Regenerate GIF from atlas** action rebuilds the GIF from the atlas PNG, frame rectangles, and FPS in the JSON. The companion GIF and PNG stay on disk and are hidden from the asset list. Moving or deleting the JSON entry also moves or deletes its companions. Exports into `images/` keep showing the GIF and PNG there. **Show in folder** reveals the exported GIF. GIF transparency is one bit; atlas PNGs retain full alpha. The Creator module does not submit Runpod jobs or open a local HTTP server.

The standalone browser editor still works with the older `generated/minimax-h3/*/first_loop/` directories: run `npm run sprite:editor` and open [http://127.0.0.1:8765](http://127.0.0.1:8765). It is separate from project assets.
