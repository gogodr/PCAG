"""Find and extract the first visually matching animation cycle from a video."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


DEFAULT_VIDEO = Path("generated/minimax-h3/pcag-dummy-walk-loop_0_00001-audio.webm")


def suggest_return(distances: list[float], minimum_cycle_frames: int = 8) -> dict:
    """Find the first meaningful near-return to frame zero without writing output."""
    frame_count = len(distances)
    minima = [index for index in range(minimum_cycle_frames, frame_count - 1)
              if distances[index] <= distances[index - 1]
              and distances[index] <= distances[index + 1]]
    typical_distance = float(np.median(distances[minimum_cycle_frames:]))
    threshold = max(1.2, min(typical_distance * .35, max(distances[-1] * 2.5, 5.5)))
    minimum_excursion = max(2.0, typical_distance * .45)
    close_returns = [index for index in minima
                     if distances[index] <= threshold
                     and max(distances[:index + 1]) >= minimum_excursion]
    return {"returnFrame": close_returns[0] if close_returns else None,
            "closestMinima": sorted(minima, key=lambda i: distances[i])[:5],
            "closeReturns": close_returns, "matchThreshold": threshold,
            "minimumMotionExcursion": minimum_excursion}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", type=Path, default=DEFAULT_VIDEO)
    parser.add_argument("--output", type=Path, default=Path("generated/minimax-h3/first_loop"))
    parser.add_argument("--minimum-cycle-frames", type=int, default=8)
    parser.add_argument("--return-frame", type=int,
                        help="Use this return frame if automatic matching selects the wrong cycle")
    parser.add_argument("--name", default="walk_right", help="Animation name for output filenames")
    parser.add_argument("--save-all-frames", action="store_true",
                        help="Also keep every source frame as a PNG for inspection")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_-]+", args.name):
        parser.error("--name must contain only letters, numbers, underscores, or hyphens")

    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        raise RuntimeError(f"Cannot open {args.video}")
    fps = capture.get(cv2.CAP_PROP_FPS)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if fps <= 0 or width <= 0 or height <= 0:
        raise RuntimeError("Video is missing frame rate or size metadata")

    loop_dir = args.output / "loop_frames"
    args.output.mkdir(parents=True, exist_ok=True)
    loop_dir.mkdir(parents=True, exist_ok=True)
    for previous in loop_dir.glob("frame_*.png"):
        previous.unlink()
    if args.save_all_frames:
        all_dir = args.output / "all_frames"
        all_dir.mkdir(parents=True, exist_ok=True)
    samples = []
    frame_count = 0
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        if args.save_all_frames:
            cv2.imwrite(str(all_dir / f"frame_{frame_count:03}.png"), frame)
        # Compare the character region at half size. The constant background
        # otherwise makes dissimilar poses appear artificially close.
        crop = frame[int(height * .04):int(height * .96), int(width * .04):int(width * .96)]
        samples.append(cv2.resize(crop, None, fx=.5, fy=.5, interpolation=cv2.INTER_AREA))
        frame_count += 1
    capture.release()
    if frame_count < args.minimum_cycle_frames + 2:
        raise RuntimeError(f"Only {frame_count} frames available")

    first = samples[0].astype(np.int16)
    distances = [float(np.abs(sample.astype(np.int16) - first).mean()) for sample in samples]
    suggestion = suggest_return(distances, args.minimum_cycle_frames)
    close_returns = suggestion["closeReturns"]
    threshold = suggestion["matchThreshold"]
    minimum_excursion = suggestion["minimumMotionExcursion"]
    if args.return_frame is not None:
        if not args.minimum_cycle_frames <= args.return_frame < frame_count:
            parser.error("--return-frame must be within the decoded video after the minimum cycle")
        end_frame = args.return_frame
    elif close_returns:
        end_frame = close_returns[0]
    else:
        raise RuntimeError(
            f"No loop return found; closest local minima: "
            f"{suggestion['closestMinima']}"
        )

    stem = f"{args.name}_first_loop"

    writer = cv2.VideoWriter(
        str(args.output / f"{stem}.mp4"),
        cv2.VideoWriter_fourcc(*"mp4v"), fps, (width, height),
    )
    if not writer.isOpened():
        raise RuntimeError("Cannot open MP4 writer")
    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        writer.release()
        raise RuntimeError(f"Cannot reopen {args.video}")
    preview_frames = []
    for index in range(end_frame):
        ok, bgr = capture.read()
        if not ok:
            writer.release()
            capture.release()
            raise RuntimeError(f"Video ended before loop frame {index}")
        writer.write(bgr)
        cv2.imwrite(str(loop_dir / f"frame_{index:03}.png"), bgr)
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        preview_frames.append(Image.fromarray(rgb).resize((width // 2, height // 2)))
    writer.release()
    capture.release()
    preview_frames[0].save(
        args.output / f"{stem}.gif", save_all=True,
        append_images=preview_frames[1:], duration=round(1000 / fps),
        loop=0, disposal=2,
    )

    with (args.output / "frame_distances.csv").open("w", newline="", encoding="utf-8") as file:
        rows = csv.writer(file)
        rows.writerow(("frame", "seconds", "mean_absolute_difference_from_frame_0"))
        rows.writerows((index, round(index / fps, 6), round(distance, 4))
                       for index, distance in enumerate(distances))
    (args.output / "loop_analysis.json").write_text(json.dumps({
        "source": str(args.video), "sourceFrameCount": frame_count,
        "width": width, "height": height, "fps": fps,
        "firstLoopStartFrame": 0, "firstLoopReturnFrame": end_frame,
        "keptFrames": end_frame, "durationSeconds": end_frame / fps,
        "returnFrameDifference": round(distances[end_frame], 4),
        "matchThreshold": round(threshold, 4),
        "minimumMotionExcursion": round(minimum_excursion, 4),
        "otherCloseReturns": [i for i in close_returns if i != end_frame],
        "animation": args.name,
        "loopVideo": f"{stem}.mp4",
        "loopPreview": f"{stem}.gif",
    }, indent=2) + "\n", encoding="utf-8")
    print(f"First loop: frames 0-{end_frame - 1} ({end_frame / fps:.3f}s); "
          f"return at frame {end_frame} with difference {distances[end_frame]:.3f}")
    print(args.output.resolve())


if __name__ == "__main__":
    main()
