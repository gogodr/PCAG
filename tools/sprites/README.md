# Character sprite animation

The active character-animation pipeline uses the [MiniMax H3 Runpod worker](runpod-minimax-h3/README.md) to animate a newly generated character pose and detects the first complete cycle. From there, use the [local animation editor](animation-editor/README.md) to choose frames, target fps, and background removal before exporting a GIF or atlas. The reusable [pipeline skill](../../docs/development/skills/minimax-h3-animation-loop/SKILL.md) describes the workflow.

The current dummy walk is an example under `generated/minimax-h3/`:

- `walk_pose_source.png`: transparent right-facing walking pose derived from the [dummy turnaround](references/animation-dummy-turnaround.png).
- `walk_loop_keyframe.png`: solid-background first and last video frame.
- `pcag-dummy-walk-loop_0_00001-audio.webm`: generated MiniMax H3 video.
- `first_loop/`: detected cycle, frame sequence, and match analysis.
- `six_fps/`: transparent frames, 90 × 160 atlas, APNG, and GIF.

Earlier OpenPose, Stable Diffusion, Flux, and Qwen experiments have been removed from `generated/`. Their source scripts remain in `tools/sprites/` as historical tooling, but their generated outputs are no longer part of this pipeline.
