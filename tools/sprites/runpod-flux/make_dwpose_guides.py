"""Render the walk-right COCO poses as full-resolution DW Pose-style guides.

The body points and their anatomical color assignments are taken directly from
the existing 18-keypoint pose JSON. Hand and head landmarks are synthesized for
the pose LoRA; they are visual guidance, not measured character keypoints.
"""

import argparse
import colorsys
import json
import math
from pathlib import Path
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from generate_side_walk_openpose import COLORS, CONTROLNET_CONNECTIONS


ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "generated/character-animations-openpose/walk_right"
OUTPUT = ROOT / "generated/flux-runpod/dwpose-guides"
SIZE = 1024
SCALE = 5.4
ORIGIN_X = 512
ORIGIN_Y = 90


def xy(point: tuple[float, float]) -> tuple[float, float]:
    return (ORIGIN_X + (point[0] - 43) * SCALE, ORIGIN_Y + point[1] * SCALE)


def circle(draw: ImageDraw.ImageDraw, point: tuple[float, float], radius: int, color: tuple[int, int, int]) -> None:
    x, y = point
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color)


def hand(draw: ImageDraw.ImageDraw, wrist: tuple[float, float], elbow: tuple[float, float]) -> None:
    dx, dy = wrist[0] - elbow[0], wrist[1] - elbow[1]
    length = max(1, math.hypot(dx, dy))
    forward = (dx / length, dy / length)
    across = (-forward[1], forward[0])
    edges = ((0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8),
             (0, 9), (9, 10), (10, 11), (11, 12), (0, 13), (13, 14), (14, 15),
             (15, 16), (0, 17), (17, 18), (18, 19), (19, 20))
    points = [wrist]
    for finger, spread in enumerate((-1.2, -0.55, 0, 0.55, 1.1)):
        for joint in range(1, 5):
            distance = 13 + joint * (9 if finger in (1, 2, 3) else 7)
            sideways = spread * (8 + joint * 3)
            points.append((wrist[0] + forward[0] * distance + across[0] * sideways,
                           wrist[1] + forward[1] * distance + across[1] * sideways))
    for index, (start, end) in enumerate(edges):
        r, g, b = colorsys.hsv_to_rgb(index / len(edges), 1, 1)
        draw.line((points[start], points[end]), fill=(round(r * 255), round(g * 255), round(b * 255)), width=2)
    for point in points:
        circle(draw, point, 3, (0, 0, 255))


def render(points: list[tuple[float, float]]) -> Image.Image:
    image = Image.new("RGB", (SIZE, SIZE), "black")
    draw = ImageDraw.Draw(image)
    scaled = [xy(point) for point in points]

    # Match the upstream DWPose body renderer's 4-pixel sticks and 4-pixel dots.
    # The connection palette is indexed by anatomy, never by screen position.
    for index, (start, end) in enumerate(CONTROLNET_CONNECTIONS):
        color = tuple(round(component * 0.6) for component in COLORS[index])
        draw.line((scaled[start], scaled[end]), fill=color, width=8)
    for index, point in enumerate(scaled):
        circle(draw, point, 4, COLORS[index])

    # DW Pose guides contain hand and face detail. Add a small side-profile
    # head contour without inventing facial expression for the blank dummy.
    center = xy((points[1][0], points[1][1] - 17))
    for index in range(23):
        angle = math.pi * (0.25 + index / 22 * 1.5)
        circle(draw, (center[0] + 51 * math.cos(angle), center[1] + 58 * math.sin(angle)), 3, (255, 255, 255))
    for wrist_index, elbow_index in ((4, 3), (7, 6)):
        hand(draw, scaled[wrist_index], scaled[elbow_index])
    return image


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for frame in range(8):
        document = json.loads((args.source / f"pose_{frame:02}.json").read_text(encoding="utf-8"))
        values = document["people"][0]["pose_keypoints_2d"]
        points = [(values[index], values[index + 1]) for index in range(0, len(values), 3)]
        if len(points) != 18:
            raise ValueError(f"Expected 18 COCO body keypoints for frame {frame}")
        render(points).save(args.output / f"dwpose_{frame:02}.png")
    print(args.output)


if __name__ == "__main__":
    main()
