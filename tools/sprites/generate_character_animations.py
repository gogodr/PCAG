"""Generate eight COCO-18 pose animation guides, each with eight 90x160 frames."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw

from generate_side_walk_openpose import (
    COLORS, CONNECTIONS, CONTROLNET_CONNECTIONS, FRAME_COUNT, FRAME_HEIGHT,
    FRAME_WIDTH, KEYPOINT_NAMES, SIDE_SWAP, knee_between,
    pose as walk_right_pose, pose_document, render_controlnet_frame, render_frame,
)


ANIMATIONS = (
    "walk_right", "walk_left", "walk_front", "walk_back",
    "talk", "stand_idle", "punch_right", "being_hit_right",
)
FRAME_DURATIONS = {
    "talk": (150, 130, 110, 120, 120, 140, 130, 100),
    "punch_right": (170, 120, 70, 70, 100, 130, 150, 190),
    "being_hit_right": (180, 90, 60, 80, 120, 150, 160, 160),
}


def side_walk(frame: int) -> tuple[tuple[float, float], ...]:
    points = list(walk_right_pose(frame))
    phase = 2 * math.pi * frame / FRAME_COUNT
    # The planted ankles stay put while the pelvis shifts weight. The head
    # follows a beat behind the shoulders instead of moving as one rigid part.
    weight = 0.9 * math.sin(phase)
    head_lag = 0.6 * math.sin(phase - math.pi / 4)
    for index in (1, 2, 3, 4, 5, 6, 7, 8, 11):
        x, y = points[index]
        points[index] = (x + weight, y)
    for index in (0, 14, 15, 16, 17):
        x, y = points[index]
        points[index] = (x + weight + head_lag, y)
    points[9] = knee_between(points[8], points[10])
    points[12] = knee_between(points[11], points[13])
    return tuple(points)


def side_stance(frame: int, action: str) -> tuple[tuple[float, float], ...]:
    phase = 2 * math.pi * frame / FRAME_COUNT
    breath = 0.55 * math.sin(phase)
    points = list(walk_right_pose(0))
    # Planted feet and a quiet weight shift give the gesture a stable base.
    points[10] = (50.0, 146.0)
    points[13] = (38.0, 146.0)
    weight = 0.7 * math.sin(phase - math.pi / 4)
    for index in (0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 14, 15, 16, 17):
        x, y = points[index]
        points[index] = (x + weight, y)
    points[9] = knee_between(points[8], points[10])
    points[12] = knee_between(points[11], points[13])
    for index in (0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 16, 17):
        x, y = points[index]
        points[index] = (x, y + breath)

    if action == "talk":
        # One thought, one hand gesture: prepare, emphasize, then settle.
        gesture = (0.0, 0.0, 0.25, 0.8, 1.0, 0.8, 0.35, 0.0)[frame]
        lead = (0.0, 0.0, 0.0, 0.2, 0.55, 0.7, 0.4, 0.0)[frame]
        points[3] = (47 + 9 * gesture, 69 - 8 * gesture + breath)
        points[4] = (45 + 18 * gesture, 89 - 30 * gesture + breath)
        points[0] = (52 + 2 * lead, 28 + breath - lead)
    elif action == "punch_right":
        # Wind up against the strike, snap forward, hold the readable contact,
        # then let the torso and rear arm settle after the fist retracts.
        drive = (0.0, -0.15, -0.28, 0.82, 1.0, 0.65, 0.20, 0.0)[frame]
        fist = (0.0, -0.20, -0.35, 0.92, 1.0, 0.75, 0.25, 0.0)[frame]
        torso = 3.5 * drive
        for index in (0, 1, 2, 5, 14, 15, 16, 17):
            x, y = points[index]
            points[index] = (x + torso, y - 1.5 * max(0, drive))
        points[3] = (51 + 12 * fist, 65 - 10 * max(0, fist) + breath)
        points[4] = (49 + 30 * fist, 72 - 20 * max(0, fist) + breath)
        points[6] = (39 - 5 * drive, 68 + breath)
        points[7] = (36 - 9 * drive, 86 - 5 * max(0, drive) + breath)
        points[8] = (points[8][0] + 1.5 * drive, points[8][1])
        points[11] = (points[11][0] + 1.5 * drive, points[11][1])
    elif action == "being_hit_right":
        # The center of mass recoils first; head and hands lag, then recover.
        impact = (0.0, -0.08, 0.55, 1.0, 0.95, 0.60, 0.25, 0.05)[frame]
        head_lag = (0.0, 0.0, 0.15, 0.75, 1.0, 0.75, 0.35, 0.05)[frame]
        arm_lag = (0.0, 0.0, 0.2, 0.65, 1.0, 0.8, 0.35, 0.05)[frame]
        for index in (0, 1, 2, 3, 4, 5, 6, 7, 14, 15, 16, 17):
            x, y = points[index]
            points[index] = (x - 9 * impact, y + 4 * impact)
        for index in (0, 14, 15, 16, 17):
            x, y = points[index]
            points[index] = (x - 4 * head_lag, y - 4 * head_lag)
        points[6] = (39 - 12 * arm_lag, 69 - 7 * arm_lag)
        points[7] = (40 - 17 * arm_lag, 87 - 20 * arm_lag)
        points[3] = (47 - 3 * arm_lag, 69 - 10 * arm_lag)
        points[4] = (44 + 12 * arm_lag, 89 - 30 * arm_lag)
        points[8] = (points[8][0] - 3 * impact, points[8][1] + 2 * impact)
        points[11] = (points[11][0] - 3 * impact, points[11][1] + 2 * impact)
    points[9] = knee_between(points[8], points[10])
    points[12] = knee_between(points[11], points[13])
    return tuple(points)


def depth_walk(frame: int, direction: str) -> tuple[tuple[float, float], ...]:
    phase = 2 * math.pi * frame / FRAME_COUNT
    swing = math.sin(phase)
    bob = 1.2 * (1 - math.cos(2 * phase))
    sway = 1.2 * math.sin(phase)
    right_hip, left_hip = (38.0 + sway, 91.0 + bob), (52.0 + sway, 91.0 + bob)
    right_ankle = (38 - 5 * swing, 145 - 5 * max(0.0, swing))
    left_ankle = (52 + 5 * swing, 145 - 5 * max(0.0, -swing))
    right_knee = (38 - 3 * swing, 118 + bob - 3 * max(0.0, swing))
    left_knee = (52 + 3 * swing, 118 + bob - 3 * max(0.0, -swing))
    # Front and back share the same silhouette. The back omits facial landmarks.
    face_y = 30 + bob
    front_pose = (
        (45.0 + sway, face_y), (45.0 + sway, 46.0 + bob),
        (34.0 + sway, 50.0 + bob), (31 + 3 * swing + sway, 70.0 + bob),
        (30 + 5 * swing + sway, 91.0 + bob),
        (56.0 + sway, 50.0 + bob), (59 - 3 * swing + sway, 70.0 + bob),
        (60 - 5 * swing + sway, 91.0 + bob),
        right_hip, right_knee, right_ankle,
        left_hip, left_knee, left_ankle,
        (41.0 + sway, 26.0 + bob), (49.0 + sway, 26.0 + bob),
        (34.0 + sway, 29.0 + bob), (56.0 + sway, 29.0 + bob),
    )
    # Turning to face away reverses screen position, not anatomical identity.
    return (tuple((FRAME_WIDTH - x, y) for x, y in front_pose)
            if direction == "back" else front_pose)


def animation_pose(name: str, frame: int) -> tuple[tuple[tuple[float, float], ...], tuple[bool, ...]]:
    visible = (True,) * len(KEYPOINT_NAMES)
    if name == "walk_right":
        return side_walk(frame), visible
    if name == "walk_left":
        source = side_walk(frame)
        return tuple((FRAME_WIDTH - source[index][0], source[index][1]) for index in SIDE_SWAP), visible
    if name in ("walk_front", "walk_back"):
        if name == "walk_back":
            visible = tuple(index not in (0, 14, 15, 16, 17) for index in range(len(KEYPOINT_NAMES)))
        return depth_walk(frame, "back" if name == "walk_back" else "front"), visible
    return side_stance(frame, name), visible


def write_animation(root: Path, name: str) -> None:
    output = root / name
    output.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (FRAME_WIDTH * FRAME_COUNT, FRAME_HEIGHT))
    controlnet_atlas = Image.new("RGB", atlas.size, (0, 0, 0))
    gif_frames = []
    frames = []
    for index in range(FRAME_COUNT):
        points, visible = animation_pose(name, index)
        frame = render_frame(points, visible,
                             near_side="left" if name == "walk_left" else "right")
        frame_file = f"frame_{index:02d}.png"
        pose_file = f"pose_{index:02d}.json"
        frame.save(output / frame_file)
        controlnet_file = f"controlnet_frame_{index:02d}.png"
        controlnet_frame = render_controlnet_frame(points, visible)
        controlnet_frame.save(output / controlnet_file)
        controlnet_atlas.paste(controlnet_frame, (index * FRAME_WIDTH, 0))
        (output / pose_file).write_text(json.dumps(pose_document(points, visible), indent=2) + "\n", encoding="utf-8")
        atlas.paste(frame, (index * FRAME_WIDTH, 0))
        black = Image.new("RGBA", frame.size, (0, 0, 0, 255))
        black.alpha_composite(frame)
        gif_frames.append(black.convert("RGB"))
        frames.append({
            "index": index, "file": frame_file, "pose": pose_file,
            "controlnet": controlnet_file,
            "rect": {"x": index * FRAME_WIDTH, "y": 0, "width": FRAME_WIDTH, "height": FRAME_HEIGHT},
            "joints": {joint: [round(x, 3), round(y, 3)]
                       for joint, (x, y) in zip(KEYPOINT_NAMES, points)},
        })

    atlas.save(output / "atlas.png")
    black_atlas = Image.new("RGBA", atlas.size, (0, 0, 0, 255))
    black_atlas.alpha_composite(atlas)
    black_atlas.convert("RGB").save(output / "editor_black_atlas.png")
    controlnet_atlas.save(output / "controlnet_atlas.png")
    gif_frames[0].save(output / "animation.gif", save_all=True,
                       append_images=gif_frames[1:],
                       duration=FRAME_DURATIONS.get(name, (120, 130) * 4),
                       loop=0, disposal=2, optimize=False)
    (output / "atlas.json").write_text(json.dumps({
        "animation": name, "image": "atlas.png", "controlnetImage": "controlnet_atlas.png",
        "editorBlackImage": "editor_black_atlas.png",
        "preview": "animation.gif", "format": "COCO-18", "keypointNames": KEYPOINT_NAMES,
        "connections": CONNECTIONS, "controlnetConnections": CONTROLNET_CONNECTIONS,
        "controlnetColors": COLORS[:17],
        "frameWidth": FRAME_WIDTH, "frameHeight": FRAME_HEIGHT,
        "frameCount": FRAME_COUNT, "fps": 8, "loop": True,
        "frameDurationsMs": FRAME_DURATIONS.get(name, (120, 130) * 4),
        "visualGuides": ["neutral head outline"],
        "frames": frames,
    }, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("generated/character-animations-openpose"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for name in ANIMATIONS:
        write_animation(args.output, name)
    overview = Image.new("RGB", (820, len(ANIMATIONS) * 180), "#141414")
    overview_draw = ImageDraw.Draw(overview)
    for row, name in enumerate(ANIMATIONS):
        overview_draw.text((5, row * 180 + 6), name, fill="white")
        with Image.open(args.output / name / "editor_black_atlas.png") as atlas:
            overview.paste(atlas, (95, row * 180 + 12))
    overview.save(args.output / "overview.png")
    (args.output / "animations.json").write_text(json.dumps({
        "animations": list(ANIMATIONS), "frameWidth": FRAME_WIDTH,
        "frameHeight": FRAME_HEIGHT, "frameCount": FRAME_COUNT, "fps": 8,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(ANIMATIONS)} animations to {args.output}")


if __name__ == "__main__":
    main()
