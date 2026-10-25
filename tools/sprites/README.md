# Character animation pose guides

## Local pose-conditioned ComfyUI trial

The `comfy_walk.py` script runs Stable Diffusion 1.5 with the mPixel SD 1.5 LoRA and the OpenPose 1.1 ControlNet. It feeds the corrected `walk_right/controlnet_frame_XX.png` images directly to ControlNet and uses the existing dummy frame 0 as an img2img identity reference, with one fixed seed for all eight frames. The pose is a conditioning signal; exact joint placement and character identity still need visual review.

Requirements: Windows, Python 3.11, an NVIDIA GPU with a working CUDA PyTorch install, about 8 GB VRAM and 10 GB free disk space. Add `HF_TOKEN` and `CIVITAI_API_KEY` to the repository `.env` (see `.env.example`). The setup stores ComfyUI and models under `tools/sprites/.local/`, which Git ignores. The script binds the API to `127.0.0.1` and terminates the server after rendering.

```powershell
python tools/sprites/comfy_walk.py setup
python tools/sprites/comfy_walk.py render --frames 0
python tools/sprites/comfy_walk.py render
python tools/sprites/comfy_walk.py render --reference-source sheet-right --output-dir generated/character-animations-comfy/walk_right-sheet-profile
```

The first render is a single-frame smoke test saved in the `preview/` subfolder. The fourth command crops the right-facing side profile from the character turnaround and uses it as the image-to-image source for every pose; its results go to a separate directory for comparison. A complete render writes eight 90 × 160 frames, full-resolution raw frames, `reference_input.png`, `atlas.png`, `overlay_atlas.png`, `animation.gif`, and `settings.json`. Pass `--seed`, `--lora-strength`, or `--denoise` to make comparison runs and `--output-dir` to preserve variants; `--text-only` disables the dummy reference. Setup chooses the latest Civitai mPixel version marked SD 1.5, with its declared trigger word; inspect the version ID printed during setup before comparing runs. Model downloads are several gigabytes and may take time.

## Character reference sheet

The [animation dummy turnaround](references/animation-dummy-turnaround.png) is a transparent 16-bit-style pixel-art reference with front, back, left, and right views in that order. Use it alongside the OpenPose guides when generating the finished character loops. It is a design reference, not a frame atlas; the four views have not yet been normalized to the 90 × 160 animation cells.

## Dummy side-walk draft

The [right-facing dummy walk atlas](../../generated/character-animations-dummy/walk_right/atlas.png) combines the dummy's right-facing design with the eight OpenPose walking poses. Each of the eight `source_frames/frame_XX.png` images was generated separately against its matching `generated/character-animations-openpose/walk_right/frame_XX.png`; frame 0 also served as a style anchor for the later frames. The folder contains eight packed 90 × 160 PNG frames, `animation.gif`, and `atlas.json`. Run `npm run sprite:dummy-walk` to rebuild the 720 × 160 atlas and GIF from the separate source frames. `source_strip_first_pass.png` preserves the earlier strip attempt for comparison.

For pose comparison, [overlay_atlas.png](../../generated/character-animations-dummy/walk_right/overlay_atlas.png) and [overlay.gif](../../generated/character-animations-dummy/walk_right/overlay.gif) draw each corresponding OpenPose frame over the dummy, with a dark outline behind the colored bones. `overlay_00.png` through `overlay_07.png` show individual comparisons. The plain sprite files remain separate for game use.

The built-in image generator was prompted with the character turnaround, frame 0 style anchor, and each frame's colored pose image plus named joint coordinates. The prompt identified the near anatomical right shoulder/arm with `#FF5500`, `#FFAA00`, `#FFFF00`; near right torso/leg with `#00FF55`, `#00FFAA`, `#00FFFF`; far anatomical left shoulder/arm with `#AAFF00`, `#55FF00`, `#00FF00`; and far left torso/leg with `#00AAFF`, `#0055FF`, `#0000FF`. `#FF0000` identifies the neck-to-nose connection. These colors guided pose interpretation; the finished dummy retains its cream, teal, and plum palette without an OpenPose overlay.

The separate renders follow the guide more closely than the first strip, but image generation still approximates some joint positions and can vary small details between frames. Use this as a draft for visual review before treating it as a final game animation.

The overlay reveals a structural limitation: the image generator used each pose PNG as a visual reference, not as a pose-control input. The packaging script also crops, rescales, and centers each generated figure, so the packed pixels do not retain the guide's absolute joint coordinates. For high-fidelity posing, use a pose-conditioned model or a deterministic 2D rig. The `controlnet_atlas.png` and `controlnet_frame_XX.png` exports now use the [original ControlNet OpenPose annotator's](https://github.com/lllyasviel/ControlNet/blob/main/annotator/openpose/util.py) connection order and palette on black, without the extra gray head outline. These are the pose-control inputs; `atlas.png`, `frame_XX.png`, and `editor_black_atlas.png` retain the editor's palette for visual review.

Final image-generation prompt: “Edit the provided character turnaround sheet. Remove only the background and make every background pixel genuinely transparent, including the spaces between the four figures. Preserve all four 16-bit pixel-art animation dummy views exactly: same geometry, pixel edges, positions, colors, lighting, tiny orange chest mark, and order. Do not redraw the characters, add shadows, labels, grid, or scenery. Keep the complete image size and all four full-body figures.” The original generation prompt specified a featureless, gender-neutral articulated mannequin with warm cream panels, muted teal joints, a dark plum outline, and front/back/left/right standing views.

Generate eight OpenPose-style skeleton animations:

```powershell
python -m pip install -r tools/sprites/requirements.txt
npm run sprite:animations
```

The script writes `generated/character-animations-openpose/` with `walk_right`, `walk_left`, `walk_front`, `walk_back`, `talk`, `stand_idle`, `punch_right`, and `being_hit_right` folders. Each folder contains a transparent editor-colored `atlas.png`, a ControlNet-compatible black `controlnet_atlas.png`, an editor-colored black `editor_black_atlas.png`, eight transparent frame PNGs, eight ControlNet frame PNGs, eight COCO-18 pose JSON files, an `atlas.json`, and a looping `animation.gif`. Each frame is 90 × 160 pixels; each atlas is 720 × 160 pixels. The preview runs at 8 fps. An `animations.json` file lists the set, and `overview.png` shows the editor-colored atlases together.

Talk, idle, punch, and hit use a right-facing profile. `punch_right` means punching toward screen right; `being_hit_right` means a right-facing character recoiling from an impact on its front. Every view draws the same gray head outline in the PNGs. The back walk marks unseen face landmarks with zero confidence in the pose JSON. The outline is a visual guide, not a COCO keypoint.

The timing and poses draw on SkillDB's [acting for animation](https://skilldb.dev/skills/animation-principles-skills/acting-for-animation), [stop-motion animation](https://skilldb.dev/skills/animation-principles-skills/stop-motion-animation), and [twelve principles](https://skilldb.dev/skills/animation-principles-skills/twelve-principles). The walks keep planted feet stable, shift weight, and let the head lag the torso. Talk has a single prepared gesture with a pause, idle uses restrained breathing, the punch has a windup and quick strike, and the hit staggers the torso, head, and arms. Action GIFs use individual frame durations; see `frameDurationsMs` in each `atlas.json`. These principles guide the poses and timing rather than adding arbitrary motion to every joint.

## OpenPose side and color convention

Joint labels are anatomical: `right_shoulder` remains the character's right shoulder in every view. From the front, right limbs appear on screen left; from the back, they appear on screen right. The right-facing profile shows the right limbs in front, and the left-facing profile shows the left limbs in front. Turning the profile mirrors positions **and swaps the left/right joint assignments**. Connection colors are fixed by connection index in the [editor's OpenposeBody source](https://github.com/huchenlei/sd-webui-openpose-editor/blob/main/src/Openpose.ts), so colors follow the anatomical bones instead of staying on a fixed side of the image. The shared gray head outline is outside the OpenPose palette; unseen face joints serialize as `[0, 0, 0]`.

Run `npm run sprite:check` to check the palette, connections, anatomical orientation, mirroring, and hidden-keypoint serialization.

These are pose guides for later character image generation, with no rendered character artwork. Joint order, connections, and colors follow the [OpenposeBody definition in sd-webui-openpose-editor](https://github.com/huchenlei/sd-webui-openpose-editor/blob/main/src/Openpose.ts).

## Original side-view walking guide

Generate a transparent, eight-frame OpenPose-style skeleton loop:

```powershell
python -m pip install -r tools/sprites/requirements.txt
npm run sprite:walk-pose
```

The script writes `generated/side-walk-openpose/atlas.png` (transparent editor palette, 720 × 160), `controlnet_atlas.png` (original ControlNet connection order and colors on black), `editor_black_atlas.png` (editor palette on black), `walk.gif` (looping preview at 8 fps), eight individual 90 × 160 PNG frames and eight ControlNet frame PNGs, and `atlas.json` with frame rectangles and named joints. Each `pose_XX.json` has the standard 18 COCO body keypoints as `[x, y, confidence]` triplets in `pose_keypoints_2d`.

Joint order, the 17 body connections, and colors follow the [OpenposeBody definition in sd-webui-openpose-editor](https://github.com/huchenlei/sd-webui-openpose-editor/blob/main/src/Openpose.ts). This is the COCO-18 body layout used by that editor; it does not include face or hand landmarks. Frames run left to right at 8 fps and loop back to frame 0. The figure faces right; use the generated `walk_left` animation for a correctly relabeled left-facing guide.

This is a pose guide for later character image generation. It contains no rendered character artwork.
