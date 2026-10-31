"""Sample a detected animation loop and export transparent frames and an atlas."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


DEFAULT_LOOP_DIR = Path("generated/minimax-h3/first_loop")
DEFAULT_OUTPUT = Path("generated/minimax-h3/six_fps")


def remove_background(path: Path) -> Image.Image:
    bgr = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if bgr is None:
        raise FileNotFoundError(path)
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    corners = np.concatenate([
        rgb[:40, :40].reshape(-1, 3), rgb[:40, -40:].reshape(-1, 3),
        rgb[-40:, :40].reshape(-1, 3), rgb[-40:, -40:].reshape(-1, 3),
    ])
    background = np.median(corners, axis=0).astype(np.int16)
    distance = np.max(np.abs(rgb.astype(np.int16) - background), axis=2)

    # Keep the character and its antialiased edge, while discarding isolated
    # compression noise in the flat background.
    solid = np.uint8(distance > 6)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(solid)
    if count < 2:
        raise RuntimeError(f"No foreground detected in {path}")
    main = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    connected = np.uint8(labels == main)
    connected = cv2.dilate(connected, np.ones((3, 3), np.uint8))
    alpha = np.clip((distance.astype(np.float32) - 3) * (255 / 12), 0, 255)
    alpha = np.uint8(alpha) * connected
    return Image.fromarray(np.dstack((rgb, alpha)), "RGBA")


def shared_crop(frames: list[Image.Image], sprite_size: tuple[int, int]) -> tuple[int, int, int, int]:
    boxes = [frame.getchannel("A").getbbox() for frame in frames]
    if any(box is None for box in boxes):
        raise RuntimeError("A selected frame has no visible subject")
    left = min(box[0] for box in boxes)
    top = min(box[1] for box in boxes)
    right = max(box[2] for box in boxes)
    bottom = max(box[3] for box in boxes)
    margin = round(min(frames[0].size) * .03)
    width = right - left + 2 * margin
    height = bottom - top + 2 * margin
    ratio = sprite_size[0] / sprite_size[1]
    width = max(width, round(height * ratio))
    height = max(height, round(width / ratio))
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    x0 = round(center_x - width / 2)
    y0 = round(center_y - height / 2)
    return (x0, y0, x0 + width, y0 + height)


def sprite_frame(frame: Image.Image, crop_box: tuple[int, int, int, int],
                 sprite_size: tuple[int, int]) -> Image.Image:
    return frame.crop(crop_box).resize(sprite_size, Image.Resampling.BOX)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--loop-dir", type=Path, default=DEFAULT_LOOP_DIR)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--animation", help="Animation identifier in atlas.json; defaults to loop analysis")
    parser.add_argument("--fps", type=int, default=6)
    parser.add_argument("--frame-width", type=int, default=90)
    parser.add_argument("--frame-height", type=int, default=160)
    args = parser.parse_args()
    if min(args.fps, args.frame_width, args.frame_height) <= 0:
        parser.error("FPS and frame dimensions must be positive")
    analysis = json.loads((args.loop_dir / "loop_analysis.json").read_text(encoding="utf-8"))
    source = args.loop_dir / "loop_frames"
    output = args.output
    animation = args.animation or analysis.get("animation") or "animation"
    sprite_size = (args.frame_width, args.frame_height)
    target_fps = args.fps
    source_fps = float(analysis["fps"])
    source_frame_count = int(analysis["keptFrames"])
    # Match the detected cycle duration and retain its last near-seam pose.
    target_count = max(2, round(source_frame_count * target_fps / source_fps))
    indices = [round(value) for value in np.linspace(0, source_frame_count - 1, target_count)]
    full_dir = output / "frames_full"
    sprite_dir_name = f"frames_{sprite_size[0]}x{sprite_size[1]}"
    sprite_dir = output / sprite_dir_name
    full_dir.mkdir(parents=True, exist_ok=True)
    sprite_dir.mkdir(parents=True, exist_ok=True)
    for directory in (full_dir, sprite_dir):
        for previous in directory.glob("frame_*.png"):
            previous.unlink()
    full_frames = [remove_background(source / f"frame_{source_index:03}.png")
                   for source_index in indices]
    crop_box = shared_crop(full_frames, sprite_size)
    sprites = []
    atlas = Image.new("RGBA", (sprite_size[0] * len(indices), sprite_size[1]))
    for sequence_index, frame in enumerate(full_frames):
        frame.save(full_dir / f"frame_{sequence_index:02}.png")
        sprite = sprite_frame(frame, crop_box, sprite_size)
        sprite.save(sprite_dir / f"frame_{sequence_index:02}.png")
        sprites.append(sprite)
        atlas.alpha_composite(sprite, (sequence_index * sprite_size[0], 0))

    atlas.save(output / "atlas.png")
    # APNG preserves full alpha at both resolutions, unlike a palette GIF.
    full_frames[0].save(
        output / "animation_full.apng", save_all=True,
        append_images=full_frames[1:], duration=round(1000 / target_fps), loop=0,
    )
    preview_name = f"animation_{sprite_size[0]}x{sprite_size[1]}"
    sprites[0].save(
        output / f"{preview_name}.apng", save_all=True,
        append_images=sprites[1:], duration=round(1000 / target_fps), loop=0,
    )
    # GIF has one-bit transparency, so share one palette across all frames and
    # reserve its last entry for transparent pixels.
    palette_source = atlas.convert("RGB").quantize(
        colors=255, method=Image.Quantize.MEDIANCUT,
    )
    palette = palette_source.getpalette()[:255 * 3] + [255, 0, 255]
    gif_frames = []
    for sprite in sprites:
        indexed = sprite.convert("RGB").quantize(palette=palette_source)
        values = np.asarray(indexed).copy()
        values[np.asarray(sprite.getchannel("A")) < 128] = 255
        gif_frame = Image.fromarray(values, "P")
        gif_frame.putpalette(palette)
        gif_frames.append(gif_frame)
    total_centiseconds = round(len(gif_frames) * 100 / target_fps)
    gif_durations = [10 * (round((i + 1) * total_centiseconds / len(gif_frames))
                           - round(i * total_centiseconds / len(gif_frames)))
                     for i in range(len(gif_frames))]
    gif_frames[0].save(
        output / f"{preview_name}.gif", save_all=True,
        append_images=gif_frames[1:], duration=gif_durations,
        loop=0, transparency=255, disposal=2, optimize=False,
    )
    (output / "atlas.json").write_text(json.dumps({
        "animation": animation, "image": "atlas.png",
        "preview": f"{preview_name}.gif", "fps": target_fps,
        "frameWidth": sprite_size[0], "frameHeight": sprite_size[1],
        "frameCount": len(indices), "loop": True,
        "sourceFrameIndices": indices,
        "sourceCrop": list(crop_box),
        "frames": [
            {"index": i, "file": f"{sprite_dir_name}/frame_{i:02}.png",
             "rect": {"x": i * sprite_size[0], "y": 0,
                      "width": sprite_size[0], "height": sprite_size[1]}}
            for i in range(len(indices))
        ],
    }, indent=2) + "\n", encoding="utf-8")
    print(f"Selected {len(indices)} frames {indices} at {target_fps} fps")
    print(output.resolve())


if __name__ == "__main__":
    main()
