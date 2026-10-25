"""Pack eight separately generated dummy walk renders into 90x160 cells."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageFilter


FRAME_COUNT = 8
FRAME_WIDTH = 90
FRAME_HEIGHT = 160
ALPHA_THRESHOLD = 32
# The pose guide lowers the head at the passing positions by about 3 pixels.
TARGET_HEIGHTS = (145, 143, 142, 143, 145, 143, 142, 143)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path,
                        default=Path("generated/character-animations-dummy/walk_right/source_frames"))
    parser.add_argument("--output", type=Path,
                        default=Path("generated/character-animations-dummy/walk_right"))
    parser.add_argument("--pose", type=Path,
                        default=Path("generated/character-animations-openpose/walk_right"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (FRAME_COUNT * FRAME_WIDTH, FRAME_HEIGHT))
    overlay_atlas = Image.new("RGBA", atlas.size)
    gif_frames = []
    overlay_gif_frames = []
    frames = []
    for index, target_height in enumerate(TARGET_HEIGHTS):
        source_path = args.input / f"frame_{index:02d}.png"
        with Image.open(source_path) as source:
            image = source.convert("RGBA")
        mask = image.getchannel("A").point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
        box = mask.getbbox()
        if box is None:
            raise ValueError(f"No visible character in {source_path}")
        crop = image.crop(box)
        target_width = round(crop.width * target_height / crop.height)
        if target_width > FRAME_WIDTH - 8:
            raise ValueError(f"Frame {index} is too wide for a {FRAME_WIDTH}px cell")
        sprite = crop.resize((target_width, target_height), Image.Resampling.NEAREST)
        frame = Image.new("RGBA", (FRAME_WIDTH, FRAME_HEIGHT))
        x = (FRAME_WIDTH - target_width) // 2
        y = FRAME_HEIGHT - 5 - target_height
        frame.alpha_composite(sprite, (x, y))
        filename = f"frame_{index:02d}.png"
        frame.save(args.output / filename)
        atlas.alpha_composite(frame, (index * FRAME_WIDTH, 0))
        with Image.open(args.pose / filename) as pose_source:
            pose = pose_source.convert("RGBA")
        if pose.size != frame.size:
            raise ValueError(f"Pose frame {index} must be {frame.size}, got {pose.size}")
        # Black two-pixel halo makes the exact OpenPose colors legible over the
        # cream sprite without changing the pose image or its joint locations.
        halo = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        halo.putalpha(pose.getchannel("A").filter(ImageFilter.MaxFilter(5)))
        overlay = frame.copy()
        overlay.alpha_composite(halo)
        overlay.alpha_composite(pose)
        overlay_filename = f"overlay_{index:02d}.png"
        overlay.save(args.output / overlay_filename)
        overlay_atlas.alpha_composite(overlay, (index * FRAME_WIDTH, 0))
        black = Image.new("RGBA", frame.size, (0, 0, 0, 255))
        black.alpha_composite(frame)
        gif_frames.append(black.convert("RGB"))
        overlay_black = Image.new("RGBA", frame.size, (0, 0, 0, 255))
        overlay_black.alpha_composite(overlay)
        overlay_gif_frames.append(overlay_black.convert("RGB"))
        frames.append({"index": index, "file": filename,
                       "overlay": overlay_filename,
                       "source": f"source_frames/{filename}",
                       "rect": {"x": index * FRAME_WIDTH, "y": 0,
                                "width": FRAME_WIDTH, "height": FRAME_HEIGHT}})
    atlas.save(args.output / "atlas.png")
    overlay_atlas.save(args.output / "overlay_atlas.png")
    gif_frames[0].save(args.output / "animation.gif", save_all=True,
                       append_images=gif_frames[1:], duration=[120, 130] * 4,
                       loop=0, disposal=2, optimize=False)
    overlay_gif_frames[0].save(args.output / "overlay.gif", save_all=True,
                               append_images=overlay_gif_frames[1:],
                               duration=[120, 130] * 4, loop=0,
                               disposal=2, optimize=False)
    (args.output / "atlas.json").write_text(json.dumps({
        "animation": "walk_right", "image": "atlas.png", "preview": "animation.gif",
        "overlayImage": "overlay_atlas.png", "overlayPreview": "overlay.gif",
        "source": "source_frames", "frameWidth": FRAME_WIDTH,
        "frameHeight": FRAME_HEIGHT, "frameCount": FRAME_COUNT,
        "fps": 8, "loop": True,
        "characterReference": "../../../tools/sprites/references/animation-dummy-turnaround.png",
        "poseReference": "../../character-animations-openpose/walk_right",
        "frames": frames,
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Packed {FRAME_COUNT} frames to {args.output / 'atlas.png'}")


if __name__ == "__main__":
    main()
