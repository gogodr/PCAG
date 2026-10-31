# Pose generation prompts

Mode: built-in image generation, one call per pose. Reference image for all seven calls: [animation-dummy-turnaround.png](../../tools/sprites/references/animation-dummy-turnaround.png), used for character identity and view guidance. Every call requested one full-body 16-bit pixel-art sprite with a genuinely transparent alpha background, no floor, shadow, extra characters, or text.

Shared character specification: the same mannequin dummy as the turnaround, with a featureless cream oval head, segmented cream body and limbs, muted teal round joints, and dark plum pixel outlines. Preserve proportions and palette, center the complete figure, and keep the feet visible.

| Pose | Motion-specific instruction |
| --- | --- |
| Walk front | Front view, orange chest plus; natural first contact with one foot forward and opposite arms offset. |
| Walk back | Back view, no chest plus; first contact for walking away, one foot forward and opposite arms offset. |
| Idle | Front view, orange chest plus; relaxed neutral stance, feet shoulder-width apart, arms at sides. |
| Talking | Front view, orange chest plus; standing with one hand slightly raised for a conversational gesture, featureless face unchanged. |
| Run right | Right-facing side profile; vigorous running contact with long stride, arms bent and pumping, slight forward lean. |
| Throw punch | Right-facing side profile; staggered fighting stance, hands raised, one fist cocked so the action can return to guard. |
| Receive hit | Right-facing side profile; neutral alert stance, planted feet and slightly raised arms, ready to recoil and recover. |

The resulting transparent `pose.png` files and the separate motion prompts for video generation are in each `dummy-*/` folder.
