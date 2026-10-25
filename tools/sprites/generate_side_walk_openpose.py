"""Generate an eight-frame, side-view COCO/OpenPose walking guide.

Requires Pillow. Run: npm run sprite:walk-pose
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw


FRAME_WIDTH = 90
FRAME_HEIGHT = 160
FRAME_COUNT = 8
SCALE = 4
GROUND_Y = 146

# COCO-18 order, edges, and colors from huchenlei/sd-webui-openpose-editor,
# src/Openpose.ts (OpenposeBody). Anatomical side is retained through rotation.
KEYPOINT_NAMES = (
    "nose", "neck", "right_shoulder", "right_elbow", "right_wrist",
    "left_shoulder", "left_elbow", "left_wrist", "right_hip",
    "right_knee", "right_ankle", "left_hip", "left_knee", "left_ankle",
    "right_eye", "left_eye", "right_ear", "left_ear",
)
CONNECTIONS = (
    (0, 1), (1, 2), (2, 3), (3, 4), (1, 5), (5, 6), (6, 7),
    (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13),
    (0, 14), (14, 16), (0, 15), (15, 17),
)
# The original ControlNet OpenPose annotator draws the same COCO-18 joints in
# a different connection order. Its colors are indexed by THIS order, not by
# the editor's CONNECTIONS order above.
CONTROLNET_CONNECTIONS = (
    (1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7),
    (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13),
    (1, 0), (0, 14), (14, 16), (0, 15), (15, 17),
)
COLORS = (
    (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0),
    (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85),
    (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
    (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255),
    (255, 0, 170), (255, 0, 85),
)
SIDE_SWAP = (0, 1, 5, 6, 7, 2, 3, 4, 11, 12, 13, 8, 9, 10, 15, 14, 17, 16)


def knee_between(hip: tuple[float, float], ankle: tuple[float, float]) -> tuple[float, float]:
    """Two-bone IK, selecting the knee that bends toward screen right."""
    upper, lower = 29.0, 29.0
    dx, dy = ankle[0] - hip[0], ankle[1] - hip[1]
    distance = max(1.0, min(math.hypot(dx, dy), upper + lower - 0.01))
    along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
    across = math.sqrt(max(0.0, upper * upper - along * along))
    ux, uy = dx / distance, dy / distance
    first = (hip[0] + along * ux - across * uy, hip[1] + along * uy + across * ux)
    second = (hip[0] + along * ux + across * uy, hip[1] + along * uy - across * ux)
    return max((first, second), key=lambda point: point[0])


def foot_at(phase: float) -> tuple[float, float]:
    """Half a cycle planted, half swinging toward the next contact."""
    progress = (phase % (2 * math.pi)) / (2 * math.pi)
    if progress < 0.5:
        return 45 + 10 - 40 * progress, GROUND_Y
    swing = (progress - 0.5) * 2
    return 45 - 10 + 20 * swing, GROUND_Y - 5 * math.sin(math.pi * swing)


def pose(frame: int) -> tuple[tuple[float, float], ...]:
    phase = 2 * math.pi * frame / FRAME_COUNT
    bob = 1.5 * (1 - math.cos(2 * phase))
    right_hip = (42.0, 91.0 + bob)
    left_hip = (46.0, 91.0 + bob)
    right_ankle = foot_at(phase + math.pi)
    left_ankle = foot_at(phase)
    arm_swing = math.sin(phase)
    profile = (
        (52.0, 28.0 + bob),  # nose
        (43.0, 46.0 + bob),  # neck
        (41.0, 50.0 + bob),  # far shoulder before anatomical relabeling
        (41.0 + 8 * arm_swing, 70.0 + bob),
        (40.0 + 15 * arm_swing, 90.0 + bob),
        (45.0, 50.0 + bob),  # near shoulder before anatomical relabeling
        (45.0 - 8 * arm_swing, 69.0 + bob),
        (44.0 - 15 * arm_swing, 89.0 + bob),
        right_hip,
        knee_between(right_hip, right_ankle),
        right_ankle,
        left_hip,
        knee_between(left_hip, left_ankle),
        left_ankle,
        (48.0, 25.0 + bob),  # far eye before anatomical relabeling
        (49.0, 26.0 + bob),  # near eye before anatomical relabeling
        (38.0, 29.0 + bob),  # far ear before anatomical relabeling
        (39.0, 30.0 + bob),  # nearer ear in the source profile
    )
    # Facing screen right exposes the character's anatomical right side.
    return tuple(profile[index] for index in SIDE_SWAP)


def render_frame(points: tuple[tuple[float, float], ...],
                 visible: tuple[bool, ...] | None = None,
                 near_side: str = "right") -> Image.Image:
    canvas = Image.new("RGBA", (FRAME_WIDTH * SCALE, FRAME_HEIGHT * SCALE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    def scaled(index: int) -> tuple[int, int]:
        x, y = points[index]
        return round(x * SCALE), round(y * SCALE)

    # A neutral, non-COCO silhouette gives every rotation the same head shape.
    # Draw it first so the standard colored bones and landmarks stay legible.
    neck_x, neck_y = scaled(1)
    radius = 10 * SCALE
    center_y = neck_y - 17 * SCALE
    draw.ellipse((neck_x - radius, center_y - radius,
                  neck_x + radius, center_y + radius),
                 outline=(180, 180, 180), width=3 * SCALE)
    draw.line(((neck_x, center_y + radius), (neck_x, neck_y)),
              fill=(180, 180, 180), width=3 * SCALE)

    # Color belongs to the anatomical connection, never to its screen position.
    # Only the overlap order changes as the character turns.
    right_edges = (7, 1, 2, 3, 8, 9, 13, 14)
    left_edges = (10, 4, 5, 6, 11, 12, 15, 16)
    far_edges, near_edges = ((left_edges, right_edges) if near_side == "right"
                             else (right_edges, left_edges))
    order = far_edges + (0,) + near_edges
    for index in order:
        start, end = CONNECTIONS[index]
        if visible is not None and not (visible[start] and visible[end]):
            continue
        draw.line((scaled(start), scaled(end)), fill=COLORS[index], width=4 * SCALE)

    right_points = (2, 3, 4, 8, 9, 10, 14, 16)
    left_points = (5, 6, 7, 11, 12, 13, 15, 17)
    far_points, near_points = ((left_points, right_points) if near_side == "right"
                               else (right_points, left_points))
    for index in far_points + (0, 1) + near_points:
        if visible is not None and not visible[index]:
            continue
        color = COLORS[index]
        x, y = scaled(index)
        radius = 3 * SCALE
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)

    return canvas.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.LANCZOS)


def render_controlnet_frame(points: tuple[tuple[float, float], ...],
                            visible: tuple[bool, ...] | None = None) -> Image.Image:
    """Render the original ControlNet annotator's COCO-18 pose map on black."""
    canvas = Image.new("RGB", (FRAME_WIDTH * SCALE, FRAME_HEIGHT * SCALE), (0, 0, 0))

    def scaled(index: int) -> tuple[int, int]:
        x, y = points[index]
        return round(x * SCALE), round(y * SCALE)

    draw = ImageDraw.Draw(canvas)
    for index, color in enumerate(COLORS):
        if visible is not None and not visible[index]:
            continue
        x, y = scaled(index)
        radius = 4 * SCALE
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)

    for index, (start, end) in enumerate(CONTROLNET_CONNECTIONS):
        if visible is not None and not (visible[start] and visible[end]):
            continue
        limb = canvas.copy()
        limb_draw = ImageDraw.Draw(limb)
        start_xy, end_xy = scaled(start), scaled(end)
        radius = 4 * SCALE
        limb_draw.line((start_xy, end_xy), fill=COLORS[index], width=8 * SCALE)
        for x, y in (start_xy, end_xy):
            limb_draw.ellipse((x - radius, y - radius, x + radius, y + radius),
                              fill=COLORS[index])
        # Upstream uses cv2.addWeighted(canvas, .4, limb, .6, 0) per connection.
        canvas = Image.blend(canvas, limb, 0.6)
    return canvas.resize((FRAME_WIDTH, FRAME_HEIGHT), Image.Resampling.LANCZOS)


def pose_document(points: tuple[tuple[float, float], ...],
                  visible: tuple[bool, ...] | None = None) -> dict[str, object]:
    return {
        "canvas_width": FRAME_WIDTH,
        "canvas_height": FRAME_HEIGHT,
        "people": [{
            "pose_keypoints_2d": [value for index, (x, y) in enumerate(points)
                                  for value in ((round(x, 3), round(y, 3), 1.0)
                                                if visible is None or visible[index]
                                                else (0.0, 0.0, 0.0))],
            "face_keypoints_2d": [],
            "hand_left_keypoints_2d": [],
            "hand_right_keypoints_2d": [],
        }],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("generated/side-walk-openpose"),
                        help="Directory for atlas PNGs, frame PNGs, and pose JSON files")
    output = parser.parse_args().output
    output.mkdir(parents=True, exist_ok=True)

    atlas = Image.new("RGBA", (FRAME_WIDTH * FRAME_COUNT, FRAME_HEIGHT), (0, 0, 0, 0))
    controlnet_atlas = Image.new("RGB", atlas.size, (0, 0, 0))
    frames = []
    gif_frames = []
    for index in range(FRAME_COUNT):
        points = pose(index)
        frame = render_frame(points)
        filename = f"frame_{index:02d}.png"
        pose_filename = f"pose_{index:02d}.json"
        frame.save(output / filename)
        controlnet_filename = f"controlnet_frame_{index:02d}.png"
        controlnet_frame = render_controlnet_frame(points)
        controlnet_frame.save(output / controlnet_filename)
        controlnet_atlas.paste(controlnet_frame, (index * FRAME_WIDTH, 0))
        black_frame = Image.new("RGBA", frame.size, (0, 0, 0, 255))
        black_frame.alpha_composite(frame)
        gif_frames.append(black_frame.convert("RGB"))
        (output / pose_filename).write_text(json.dumps(pose_document(points), indent=2) + "\n", encoding="utf-8")
        atlas.paste(frame, (index * FRAME_WIDTH, 0))
        frames.append({
            "index": index,
            "file": filename,
            "pose": pose_filename,
            "controlnet": controlnet_filename,
            "rect": {"x": index * FRAME_WIDTH, "y": 0, "width": FRAME_WIDTH, "height": FRAME_HEIGHT},
            "joints": {name: [round(x, 3), round(y, 3)] for name, (x, y) in zip(KEYPOINT_NAMES, points)},
        })

    atlas.save(output / "atlas.png")
    editor_black = Image.new("RGBA", atlas.size, (0, 0, 0, 255))
    editor_black.alpha_composite(atlas)
    editor_black.convert("RGB").save(output / "editor_black_atlas.png")
    controlnet_atlas.save(output / "controlnet_atlas.png")
    gif_frames[0].save(output / "walk.gif", save_all=True, append_images=gif_frames[1:],
                       duration=[120, 130] * (FRAME_COUNT // 2), loop=0,
                       disposal=2, optimize=False)
    (output / "atlas.json").write_text(json.dumps({
        "image": "atlas.png", "controlnetImage": "controlnet_atlas.png",
        "editorBlackImage": "editor_black_atlas.png",
        "format": "COCO-18", "keypointNames": KEYPOINT_NAMES,
        "connections": CONNECTIONS, "controlnetConnections": CONTROLNET_CONNECTIONS,
        "controlnetColors": COLORS[:17],
        "frameWidth": FRAME_WIDTH, "frameHeight": FRAME_HEIGHT,
        "frameCount": FRAME_COUNT, "fps": 8, "direction": "right", "loop": True,
        "frames": frames,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {FRAME_COUNT} COCO-18 frames and {atlas.width}x{atlas.height} atlas to {output}")


if __name__ == "__main__":
    main()
