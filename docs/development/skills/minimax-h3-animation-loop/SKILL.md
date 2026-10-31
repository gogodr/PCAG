---
name: minimax-h3-animation-loop
description: Generate a looping character animation from a requested character and motion with MiniMax H3 on Runpod, then detect the first cycle and export transparent frames, a sprite atlas, and a GIF. Use for any character and repeatable motion, including idle, walk, run, talk, or an action that returns to its starting pose.
---

# MiniMax H3 character animation loop

Work from the repository root. Read the [pipeline README](../../../../tools/sprites/runpod-minimax-h3/README.md). Give each character and animation its own directory under `generated/minimax-h3/`; the existing dummy walk is an example, not a required subject or motion.

## 1. Generate the first and last pose

Start with the user's character reference or description and requested motion. Generate **one image of that character in a pose suitable for the start and end of the cycle**. This is the first creative stage of every new animation. Choose a readable pose at a natural loop boundary: for example, a contact pose for walking, a neutral stance for an idle or punch cycle, or a resting mouth shape for talking. Keep the character's design, colors, proportions, and facing direction consistent with the reference. Show the whole silhouette with room for the motion; avoid clipping limbs. Save a transparent PNG as `generated/minimax-h3/<character>-<animation>/pose.png`, and inspect it before proceeding. If no reference was supplied, generate from the description. Ask for missing identity details only when they are essential to the result.

Composite that pose onto a flat color distinct from the character and save the video keyframe. The flat backdrop makes later removal possible. Pick a color for the subject; the example below is only a default.

```powershell
python tools/sprites/runpod-minimax-h3/prepare_keyframe.py --pose generated/minimax-h3/<character>-<animation>/pose.png --output generated/minimax-h3/<character>-<animation>/keyframe.png --background '#644d4f'
```

## 2. Animate with the same image at both ends

Write `generated/minimax-h3/<character>-<animation>/prompt.txt` for the specific motion. Describe the character's identity and appearance, facing direction, full action through one or more cycles, camera/framing, consistent background, and a clear return to the exact starting pose. Adapt the prompt to the requested motion; do not assume side walking or an in-place action. Inspect the keyframe and prompt together.

The [MiniMax H3 Hub worker](https://console.runpod.io/hub/listing/huchukato/runpod-minimax-h3) uses the `MiniMaxH3-Turbo-FL2VA.json` workflow. `submit_loop.py` sends the **same** keyframe PNG as both first and last images. It uses the `native_turbo` preset without RIFE or upscaling. The video may contain multiple cycles; the next stage extracts the first usable one.

Before a paid job, check whether an existing video or job can be reused. Read the live endpoint, attached volumes, GPU price, and account balance; the endpoint and volume IDs in the [pipeline README](../../../../tools/sprites/runpod-minimax-h3/README.md) are historical identifiers, not proof of current state. Use the Runpod infrastructure tools and their current instructions for provisioning and endpoint changes. Confirm that the endpoint's model volume exists, is attached in the endpoint's data center, and contains the worker's required model files. If it was removed, create a suitable volume, attach it to the endpoint (or redeploy the Hub worker when required), and let the worker populate it. Verify a worker can load the workflow before submitting the real animation. Explain the current storage and GPU costs before provisioning. Do not create a second volume when the existing one is usable.

When generation is needed and authorized, set maximum workers to one, submit one job, and save its ID. Keep `RUNPOD_API_KEY` in `.env` or the process environment; never print or commit it.

```powershell
python tools/sprites/runpod-minimax-h3/submit_loop.py --keyframe generated/minimax-h3/<character>-<animation>/keyframe.png --prompt-file generated/minimax-h3/<character>-<animation>/prompt.txt --output-dir generated/minimax-h3/<character>-<animation> --job-name <character>-<animation> --endpoint-id ENDPOINT_ID --dry-run
python tools/sprites/runpod-minimax-h3/submit_loop.py --keyframe generated/minimax-h3/<character>-<animation>/keyframe.png --prompt-file generated/minimax-h3/<character>-<animation>/prompt.txt --output-dir generated/minimax-h3/<character>-<animation> --job-name <character>-<animation> --endpoint-id ENDPOINT_ID
```

If polling stops, use `--job-id JOB_ID` with the same output directory to resume; do not submit a duplicate. Verify the downloaded video, then set maximum workers back to zero and read back the endpoint state. For local reprocessing, skip this stage entirely.

### Storage decision after generation

After the video is downloaded and verified locally, ask: **“Do you want to generate another MiniMax video soon? If no, I’ll remove this endpoint's model volume to stop its storage charge. Reusing the endpoint later will require recreating and loading the volume.”** Do this after each generation session, even if loop extraction or sprite editing will continue locally.

- **Yes:** keep the volume for the next generation. Leave maximum workers at zero between jobs unless the user requests otherwise. Report that storage continues billing.
- **No:** first confirm the current volume ID belongs to this MiniMax workflow, that no other endpoint or pod depends on it, and that no needed outputs exist only on the volume. Ensure the video and job metadata are saved locally and no jobs are active. Detach the volume or remove the endpoint's volume association as the current Runpod API requires, delete that specific volume, and read back the endpoint and volume lists. Report the deletion and that a future run needs storage setup again.
- **No answer or unclear answer:** leave the volume intact, keep workers at zero, and make the continuing storage charge explicit. Do not interpret silence as permission to delete data.

If generation fails or the local download is not verified, pause workers and diagnose or resume the job before making the storage decision. Never delete a volume that may contain the only copy of a result.

## 3. Import the video and confirm the first complete cycle

Import the downloaded video into the open project's `animation/` asset folder (a subfolder is fine). Open **Animations** in the desktop Creator app and select the video. Creator creates a hidden `_video_name` work folder beside it, analyzes the video with the same return-matching logic as `extract_first_loop.py`, and shows a suggested first cycle. Inspect the source preview and timeline, adjust the start and end handles, then choose **Confirm Animation Loop**. This writes the chosen frames to `_video_name/animation_loop/`. On a later selection, the existing loop opens directly in the editor.

For a headless run without a project, the original extraction command remains available. Replace `VIDEO_PATH` with the downloaded WebM path:

```powershell
python tools/sprites/runpod-minimax-h3/extract_first_loop.py --video VIDEO_PATH --output generated/minimax-h3/<character>-<animation>/first_loop --name <animation>
```

For the headless path, inspect `loop_analysis.json`, `frame_distances.csv`, and the trimmed MP4/GIF preview. The detector requires motion before accepting a return, but it can still select a later repeated cycle or reject a plausible return when the video drifts from its starting pose. If the chosen boundary is wrong, rerun with `--return-frame FRAME_NUMBER`; adjust `--minimum-cycle-frames` when needed. The return frame is excluded so the starting pose does not appear twice at the seam.

## 4. Refine and export in the local editor

After confirming the project loop, the native editor opens its frames automatically. Reduce to the requested target fps, remove unwanted frames, undo or redo as needed, and toggle background removal. Export the GIF and atlas after inspecting playback. Each export is saved under that video's hidden work folder, and the source frames remain intact. See the [editor README](../../../../tools/sprites/animation-editor/README.md) for controls and output details.

For old generated runs that have not been imported into a project, the standalone browser editor remains available:

```powershell
npm run sprite:editor
```

Open `http://127.0.0.1:8765` and select a run under `generated/minimax-h3/`.

For scripted or reproducible batch packaging, the older command remains available:

```powershell
python tools/sprites/runpod-minimax-h3/make_six_fps.py --loop-dir generated/minimax-h3/<character>-<animation>/first_loop --output generated/minimax-h3/<character>-<animation>/six_fps --animation <animation> --fps 6 --frame-width 90 --frame-height 160
```

The scripted exporter samples the chosen loop at 6 fps by default, estimates a nearly flat background from each frame's corners, and uses shared character bounds across selected frames so motion is framed consistently. It saves transparent full-resolution PNGs and APNG, sized sprite PNGs and APNG, a GIF preview, `atlas.png`, and `atlas.json`. Change fps and sprite dimensions when the project calls for another format. A complex or changing video background may require improved segmentation before packaging; inspect the mask rather than accepting it blindly. GIF transparency is one bit, so review PNG/APNG for accurate edges.

## 5. Verify the loop and deliver

Check the first-to-last seam, action readability at the chosen fps, frame count and duration, atlas dimensions, alpha on a checkerboard, background residue, holes, color fringes, and clipped motion. Preserve the source pose, prompt, keyframe, WebM, loop analysis, and final sprites so the run can be reproduced. Report visual drift if the video only approximates the requested pose or a seamless loop.

The existing `generated/minimax-h3/` dummy walk demonstrates the process: return frame 37, source frames 0–36, and nine selected frames at 6 fps. Its inputs and artifacts are documented in the pipeline README.
