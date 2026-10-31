"""Turn the eight Flux walk renders into a transparent 90x160 atlas and GIF."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


FRAME_SIZE = (90, 160)
SOURCE_CROP = (182, 80, 542, 720)
BACKGROUND = np.array([236, 214, 195], dtype=np.int16)


def extract_frame(path: Path) -> Image.Image:
    source = Image.open(path).convert("RGB")
    if source.size != (728, 720):
        raise ValueError(f"Expected a 728x720 render, got {source.size}: {path}")
    pixels = np.asarray(source, dtype=np.int16)
    distance = np.max(np.abs(pixels - BACKGROUND), axis=2)
    alpha = np.clip((distance - 5) * 255 // 12, 0, 255).astype(np.uint8)
    rgba = np.dstack((pixels.astype(np.uint8), alpha))
    frame = Image.fromarray(rgba, "RGBA").crop(SOURCE_CROP)
    return frame.resize(FRAME_SIZE, Image.Resampling.BOX)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path("generated/flux-runpod/walk_right"))
    parser.add_argument("--output", type=Path, default=Path("generated/flux-runpod/walk_right/packed"))
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    atlas = Image.new("RGBA", (FRAME_SIZE[0] * 8, FRAME_SIZE[1]))
    gif_frames = []
    for index in range(8):
        frame = extract_frame(args.input / f"frame_{index:02}.png")
        frame.save(args.output / f"frame_{index:02}.png")
        atlas.alpha_composite(frame, (index * FRAME_SIZE[0], 0))
        preview = Image.new("RGBA", FRAME_SIZE, (236, 214, 195, 255))
        preview.alpha_composite(frame)
        gif_frames.append(preview.convert("RGB"))

    atlas.save(args.output / "atlas.png")
    gif_frames[0].save(
        args.output / "animation.gif", save_all=True, append_images=gif_frames[1:],
        duration=125, loop=0, disposal=2,
    )
    (args.output / "atlas.json").write_text(json.dumps({
        "animation": "walk_right", "image": "atlas.png", "preview": "animation.gif",
        "frameWidth": FRAME_SIZE[0], "frameHeight": FRAME_SIZE[1],
        "frameCount": 8, "fps": 8, "loop": True,
        "sourceCrop": list(SOURCE_CROP),
        "frames": [
            {"index": index, "file": f"frame_{index:02}.png",
             "rect": {"x": index * FRAME_SIZE[0], "y": 0,
                      "width": FRAME_SIZE[0], "height": FRAME_SIZE[1]}}
            for index in range(8)
        ],
    }, indent=2) + "\n", encoding="utf-8")
    print(args.output / "atlas.png")


if __name__ == "__main__":
    main()
