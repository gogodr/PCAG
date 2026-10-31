# MiniMax H3 character animation loops

The [pipeline skill](../../../docs/development/skills/minimax-h3-animation-loop/SKILL.md) covers the complete workflow. Start each run by generating a transparent PNG of the requested character in a pose that can serve as both the first and last frame of the requested animation. Save a motion-specific prompt alongside it. The character and animation are inputs, not fixed properties of the worker.

The [huchukato MiniMax H3 Runpod Hub release](https://console.runpod.io/hub/listing/huchukato/runpod-minimax-h3) was deployed as endpoint `3degt62uakpdsc` with an RTX PRO 6000 Blackwell Server Edition worker and 160 GB model volume `n1bt75wga8` in `US-NE-1`. These are historical identifiers; read the current endpoint, volume attachment, and pricing before another paid run. The [pipeline skill](../../../docs/development/skills/minimax-h3-animation-loop/SKILL.md) now checks or recreates model storage before generation and asks whether to remove it after the video has been saved. A retained network volume bills while workers are paused.

## New animation

Replace `RUN_DIR`, `ANIMATION`, `VIDEO_PATH`, and `ENDPOINT_ID` with the run's paths and values. Put the generated transparent image at `RUN_DIR/pose.png` and the character and motion prompt at `RUN_DIR/prompt.txt`.

```powershell
python tools/sprites/runpod-minimax-h3/prepare_keyframe.py --pose RUN_DIR/pose.png --output RUN_DIR/keyframe.png --background '#644d4f'
python tools/sprites/runpod-minimax-h3/submit_loop.py --keyframe RUN_DIR/keyframe.png --prompt-file RUN_DIR/prompt.txt --output-dir RUN_DIR --job-name ANIMATION --endpoint-id ENDPOINT_ID --dry-run
python tools/sprites/runpod-minimax-h3/submit_loop.py --keyframe RUN_DIR/keyframe.png --prompt-file RUN_DIR/prompt.txt --output-dir RUN_DIR --job-name ANIMATION --endpoint-id ENDPOINT_ID
```

`prepare_keyframe.py` composites the transparent pose over a nearly flat color chosen to contrast with the character. `submit_loop.py` sends that **same PNG as both the first and last frame** to `MiniMaxH3-Turbo-FL2VA.json`. It defaults to five seconds and the `native_turbo` preset, without RIFE or upscaling. Use `--seconds` when another duration is appropriate. It writes `job.json`; after interruption, resume polling with `--job-id JOB_ID --output-dir RUN_DIR` instead of submitting again. Set maximum workers to zero after the video is saved and verified; then follow the skill's storage decision.

```powershell
python tools/sprites/runpod-minimax-h3/extract_first_loop.py --video VIDEO_PATH --output RUN_DIR/first_loop --name ANIMATION
python tools/sprites/runpod-minimax-h3/make_six_fps.py --loop-dir RUN_DIR/first_loop --output RUN_DIR/six_fps --animation ANIMATION --fps 6 --frame-width 90 --frame-height 160
```

`extract_first_loop.py` compares decoded frames with frame zero and selects the earliest close return after meaningful motion. Inspect `loop_analysis.json`, `frame_distances.csv`, and the preview; pass `--return-frame` if the selected cycle is wrong. The return frame is excluded from the loop to avoid a doubled pose at playback wrap. `--save-all-frames` retains every source PNG for debugging.

For hands-on frame selection and export after extraction, run `npm run sprite:editor` and use the [local animation editor](../animation-editor/README.md). The following `make_six_fps.py` command remains available for automated batch packaging.

`make_six_fps.py` reads the detected loop duration, samples at the requested fps, estimates a flat background from frame corners, and uses shared subject bounds for cropping. It exports full-resolution transparent PNG/APNG, sized PNG/APNG/GIF frames, `atlas.png`, and `atlas.json`. The GIF has one-bit transparency; PNG/APNG preserve alpha. A complex video background or major subject drift may require manual segmentation or framing adjustments.

## Existing dummy walk example

The previous run used `generated/minimax-h3/walk_pose_source.png`, derived from the [dummy turnaround](../references/animation-dummy-turnaround.png). Its prompt is [walk_prompt.txt](../../../generated/minimax-h3/walk_prompt.txt), its composited first/last frame is `walk_loop_keyframe.png`, and its result is `pcag-dummy-walk-loop_0_00001-audio.webm` (124 frames at 24 fps, 832 × 1248 pixels).

The first matching return was frame 37, so frames 0–36 form a roughly 1.54-second loop. Sampling indices `0, 4, 9, 14, 18, 22, 27, 32, 36` made a nine-frame, 1.5-second 6 fps loop. Its outputs are in `first_loop/` and `six_fps/`; the sprite atlas is 810 × 160. This run illustrates the workflow and does not set a required character, pose, motion, or cycle length.
