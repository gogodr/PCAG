# Animation dummy loop batch

These seven runs use [animation-dummy-turnaround.png](../../tools/sprites/references/animation-dummy-turnaround.png) as the character reference. Each `dummy-*/` folder contains its generated transparent `pose.png`, the solid-background `keyframe.png` used as both first and last video frame, `prompt.txt`, MiniMax WebM, first-loop analysis and frames, and a `six_fps/` package with transparent 90 × 160 frames, `atlas.png`, `atlas.json`, APNG, and GIF.

| Animation | Return frame (24 fps source) | 6 fps frames | Preview |
| --- | ---: | ---: | --- |
| Walk front | 31 | 8 | [GIF](dummy-walk_front/six_fps/animation_90x160.gif) |
| Walk back | 28 | 7 | [GIF](dummy-walk_back/six_fps/animation_90x160.gif) |
| Idle | 66 | 16 | [GIF](dummy-idle/six_fps/animation_90x160.gif) |
| Talking with hand movement | 98 | 24 | [GIF](dummy-talking/six_fps/animation_90x160.gif) |
| Run right | 26 | 6 | [GIF](dummy-run_right/six_fps/animation_90x160.gif) |
| Throw punch | 85 | 21 | [GIF](dummy-throw_punch/six_fps/animation_90x160.gif) |
| Receive hit | 91 | 23 | [GIF](dummy-receive_hit/six_fps/animation_90x160.gif) |

The first-loop detector needed manual return-frame choices for walk back (frame 28) and run right (frame 26). The other boundaries were automatic after tightening action detection so an opening hold is not mistaken for a full loop. MiniMax added a small red impact mark in the receive-hit motion despite the prompt's request for no effects. Walk and run seams show more pose drift than idle, talking, punch, and hit; review them in motion before game use.

The older `walk_pose_source.png` and `six_fps/` at this directory's root are the earlier right-walk experiment, separate from these seven runs.
