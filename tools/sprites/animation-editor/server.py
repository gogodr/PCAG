"""Local browser editor for MiniMax first-loop animation frames."""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import uuid
from datetime import datetime
from functools import lru_cache
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from PIL import Image, ImageOps
import numpy as np
import cv2


ROOT = Path(__file__).resolve().parents[3]
RUNS = ROOT / "generated/minimax-h3"
STATIC = Path(__file__).resolve().parent / "web"
PIPELINE = ROOT / "tools/sprites/runpod-minimax-h3"
sys.path.insert(0, str(PIPELINE))
from make_six_fps import remove_background, shared_crop, sprite_frame  # noqa: E402


def animation_runs() -> dict[str, Path]:
    runs = {}
    if not RUNS.exists():
        return runs
    for folder in RUNS.iterdir():
        if folder.is_dir() and (folder / "first_loop/loop_analysis.json").is_file():
            runs[folder.name] = folder
    if (RUNS / "first_loop/loop_analysis.json").is_file():
        runs["original-walk-right"] = RUNS
    return runs


def run_info(slug: str, folder: Path, loop_name: str = "first_loop") -> dict:
    loop = folder / loop_name
    analysis = json.loads((loop / "loop_analysis.json").read_text(encoding="utf-8"))
    expected = int(analysis["keptFrames"])
    indices = [
        index for index in range(expected)
        if (loop / "loop_frames" / f"frame_{index:03}.png").is_file()
    ]
    if len(indices) != expected:
        raise ValueError(f"{slug} has {len(indices)} of {expected} source frames")
    return {
        "id": slug,
        "label": slug.replace("dummy-", "").replace("_", " ").replace("-", " ").title(),
        "sourceFps": float(analysis["fps"]),
        "frameCount": expected,
        "frames": indices,
        "width": int(analysis["width"]),
        "height": int(analysis["height"]),
    }


def frame_path(slug: str, index: int, runs: dict[str, Path] | None = None,
               loop_name: str = "first_loop") -> Path:
    runs = animation_runs() if runs is None else runs
    if slug not in runs:
        raise ValueError("Unknown animation")
    info = run_info(slug, runs[slug], loop_name)
    if index not in info["frames"]:
        raise ValueError("Unknown frame")
    return runs[slug] / loop_name / "loop_frames" / f"frame_{index:03}.png"


@lru_cache(maxsize=96)
def frame_png(path: str, modified_ns: int, remove_bg: bool) -> bytes:
    source = Path(path)
    frame = remove_background(source) if remove_bg else Image.open(source).convert("RGBA")
    data = io.BytesIO()
    frame.save(data, format="PNG")
    return data.getvalue()


def validate_manual(manual: object, indices: list[int]) -> dict[int, dict]:
    if not isinstance(manual, dict):
        raise ValueError("Invalid targeted background edits")
    result = {}
    for key, value in manual.items():
        if not isinstance(key, str) or not key.isdigit() or int(key) not in indices or not isinstance(value, dict):
            raise ValueError("Invalid targeted background frame")
        if type(value.get("baseAuto")) is not bool or not isinstance(value.get("seeds"), list) or len(value["seeds"]) > 100:
            raise ValueError("Invalid targeted background edits")
        for seed in value["seeds"]:
            if not isinstance(seed, dict) or any(type(seed.get(axis)) is not int for axis in ("x", "y")) or not isinstance(seed.get("color"), list) or len(seed["color"]) != 3 or any(type(channel) is not int or not 0 <= channel <= 255 for channel in seed["color"]):
                raise ValueError("Invalid targeted background point")
        result[int(key)] = value
    return result


def remove_connected_color(frame: Image.Image, x: int, y: int, sampled_color: list[int] | None = None) -> tuple[Image.Image, list[int], int]:
    pixels = np.asarray(frame.convert("RGBA")).copy()
    height, width = pixels.shape[:2]
    if not 0 <= x < width or not 0 <= y < height:
        raise ValueError("Target point is outside the frame")
    if pixels[y, x, 3] == 0:
        raise ValueError("Choose a visible background pixel")
    color = np.array(sampled_color if sampled_color is not None else pixels[y, x, :3], dtype=np.int16)
    if np.max(np.abs(pixels[y, x, :3].astype(np.int16) - color)) > 18:
        raise ValueError("The targeted background color changed")
    difference = np.max(np.abs(pixels[:, :, :3].astype(np.int16) - color), axis=2)
    candidates = np.uint8((difference <= 18) & (pixels[:, :, 3] > 0))
    _, labels = cv2.connectedComponents(candidates, connectivity=4)
    connected = labels[y, x]
    count = int(np.count_nonzero(labels == connected))
    pixels[labels == connected, 3] = 0
    return Image.fromarray(pixels, "RGBA"), [int(channel) for channel in color], count


def manually_edited_frame(path: Path, entry: dict, extra: dict | None = None) -> Image.Image:
    frame = Image.open(io.BytesIO(frame_png(str(path), path.stat().st_mtime_ns, entry["baseAuto"]))).convert("RGBA")
    for seed in [*entry["seeds"], *([extra] if extra else [])]:
        frame, _, _ = remove_connected_color(frame, seed["x"], seed["y"], seed["color"])
    return frame


def load_frame(slug: str, index: int, remove_bg: bool,
               runs: dict[str, Path] | None = None,
               loop_name: str = "first_loop") -> Image.Image:
    path = frame_path(slug, index, runs, loop_name)
    return Image.open(io.BytesIO(frame_png(str(path), path.stat().st_mtime_ns, remove_bg))).convert("RGBA")


def validate_style(pixel_size: object, palette: object) -> tuple[int, list[str]]:
    if type(pixel_size) is not int or not 1 <= pixel_size <= 128:
        raise ValueError("Pixel size must be a whole number from 1 to 128")
    if not isinstance(palette, list) or len(palette) > 32 or any(
        not isinstance(color, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", color)
        for color in palette
    ):
        raise ValueError("Palette must contain at most 32 RGB colors")
    return pixel_size, palette


def style_frame(frame: Image.Image, pixel_size: int, palette: list[str]) -> Image.Image:
    frame = frame.convert("RGBA")
    if pixel_size > 1:
        width, height = frame.size
        frame = frame.resize(((width + pixel_size - 1) // pixel_size,
                              (height + pixel_size - 1) // pixel_size), Image.Resampling.NEAREST)
    if palette:
        pixels = np.asarray(frame).copy()
        colors = np.array([[int(color[i:i + 2], 16) for i in (1, 3, 5)]
                           for color in palette], dtype=np.int32)
        rgb = pixels[:, :, :3].astype(np.int32)
        nearest = np.zeros(rgb.shape[:2], dtype=np.uint8)
        best_distance = None
        for index, color in enumerate(colors):
            delta = rgb - color
            distance = (delta * delta).sum(axis=2)
            if best_distance is None:
                best_distance = distance
            else:
                closer = distance < best_distance
                nearest[closer] = index
                best_distance = np.minimum(best_distance, distance)
        pixels[:, :, :3] = colors[nearest].astype(np.uint8)
        frame = Image.fromarray(pixels, "RGBA")
    if pixel_size > 1:
        frame = frame.resize((frame.width * pixel_size, frame.height * pixel_size), Image.Resampling.NEAREST)
        frame = frame.crop((0, 0, width, height))
    return frame


def suggest_palette(frame: Image.Image, pixel_size: int, threshold: int = 80,
                    max_colors: int = 32) -> list[str]:
    """Group visible sprite colors by summed RGB channel distance."""
    if not 1 <= threshold <= 765 or not 1 <= max_colors <= 32:
        raise ValueError("Invalid palette suggestion settings")
    pixels = np.asarray(style_frame(frame, pixel_size, []))
    visible = pixels[:, :, :3][pixels[:, :, 3] >= 128].astype(np.int32)
    if not len(visible):
        raise ValueError("This frame has no visible colors to suggest")
    # Eight-level buckets suppress video compression noise before clustering.
    buckets = visible // 8
    keys, inverse, counts = np.unique(buckets, axis=0, return_inverse=True, return_counts=True)
    totals = np.stack([np.bincount(inverse, weights=visible[:, channel], minlength=len(keys))
                       for channel in range(3)], axis=1)
    order = np.argsort(-counts, kind="stable")
    groups: list[dict] = []
    for index in order:
        color = totals[index] / counts[index]
        distances = [np.abs(color - group["sum"] / group["count"]).sum() for group in groups]
        nearest = int(np.argmin(distances)) if distances else -1
        if nearest < 0 or (distances[nearest] > threshold and len(groups) < max_colors):
            groups.append({"sum": totals[index].copy(), "count": int(counts[index])})
        else:
            groups[nearest]["sum"] += totals[index]
            groups[nearest]["count"] += int(counts[index])
    groups.sort(key=lambda group: -group["count"])
    return ["#" + "".join(f"{int(round(channel)):02x}" for channel in group["sum"] / group["count"])
            for group in groups]


def sprite_frames(slug: str, indices: list[int], remove_bg: bool,
                  size: tuple[int, int], runs: dict[str, Path] | None = None,
                  loop_name: str = "first_loop", manual: dict[int, dict] | None = None) -> tuple[list[Image.Image], list[int] | None]:
    manual = manual or {}
    frames = [manually_edited_frame(frame_path(slug, index, runs, loop_name), manual[index])
              if index in manual else load_frame(slug, index, remove_bg, runs, loop_name) for index in indices]
    if remove_bg:
        crop = shared_crop(frames, size)
        return [sprite_frame(frame, crop, size) for frame in frames], list(crop)
    output = []
    for frame in frames:
        fitted = ImageOps.contain(frame, size, Image.Resampling.BOX)
        canvas = Image.new("RGBA", size)
        canvas.alpha_composite(fitted, ((size[0] - fitted.width) // 2,
                                        (size[1] - fitted.height) // 2))
        output.append(canvas)
    return output, None


def export_animation(request: dict, runs: dict[str, Path] | None = None,
                     loop_name: str = "first_loop") -> dict:
    slug = request.get("animation")
    runs = animation_runs() if runs is None else runs
    if not isinstance(slug, str) or slug not in runs:
        raise ValueError("Choose an animation")
    kind = request.get("kind")
    if kind not in ("gif", "atlas"):
        raise ValueError("Export must be GIF or atlas")
    info = run_info(slug, runs[slug], loop_name)
    indices = request.get("frames")
    if not isinstance(indices, list) or not indices or any(
        type(index) is not int or index not in info["frames"] for index in indices
    ):
        raise ValueError("Select at least one valid frame")
    if len(indices) != len(set(indices)):
        raise ValueError("Duplicate frames are not supported")
    fps = request.get("fps")
    width = request.get("width")
    height = request.get("height")
    if any(type(value) is not int for value in (fps, width, height)):
        raise ValueError("FPS and size must be whole numbers")
    if not (1 <= fps <= 60 and 1 <= width <= 1024 and 1 <= height <= 1024):
        raise ValueError("FPS or size is out of range")
    if width * height * len(indices) > 30_000_000:
        raise ValueError("Atlas is too large; reduce frames or export dimensions")
    remove_bg = request.get("removeBg")
    if type(remove_bg) is not bool:
        raise ValueError("Invalid background setting")

    pixel_size, palette = validate_style(request.get("pixelSize", 1), request.get("palette", []))
    manual = validate_manual(request.get("manual", {}), info["frames"])
    sprites, crop = sprite_frames(slug, indices, remove_bg, (width, height), runs, loop_name, manual)
    sprites = [style_frame(sprite, pixel_size, palette) for sprite in sprites]
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    export_id = f"{stamp}-{uuid.uuid4().hex[:6]}-{kind}"
    destination = runs[slug] / "manual_exports" / export_id
    destination.mkdir(parents=True, exist_ok=False)
    metadata = {
        "animation": info["label"], "source": slug, "fps": fps,
        "frameWidth": width, "frameHeight": height, "frameCount": len(indices),
        "sourceFrameIndices": indices, "backgroundRemoved": remove_bg,
        "sourceCrop": crop, "loop": True, "pixelSize": pixel_size, "palette": palette,
        "targetedBackgroundFrames": sorted(manual),
    }
    if kind == "atlas":
        atlas = Image.new("RGBA", (width * len(sprites), height))
        for position, sprite in enumerate(sprites):
            atlas.alpha_composite(sprite, (position * width, 0))
        atlas.save(destination / "atlas.png")
        metadata["image"] = "atlas.png"
        metadata["frames"] = [
            {"index": position, "sourceFrame": source,
             "rect": {"x": position * width, "y": 0, "width": width, "height": height}}
            for position, source in enumerate(indices)
        ]
        primary = "atlas.png"
    else:
        palette_atlas = Image.new("RGBA", (width * len(sprites), height))
        for position, sprite in enumerate(sprites):
            palette_atlas.alpha_composite(sprite, (position * width, 0))
        palette_source = palette_atlas.convert("RGB").quantize(
            colors=255, method=Image.Quantize.MEDIANCUT,
        )
        palette = palette_source.getpalette()[:255 * 3] + [255, 0, 255]
        gif_frames = []
        for sprite in sprites:
            indexed = sprite.convert("RGB").quantize(palette=palette_source)
            indexed.putpalette(palette)
            from numpy import asarray, uint8
            values = asarray(indexed).copy()
            values[asarray(sprite.getchannel("A")) < 128] = 255
            frame = Image.fromarray(uint8(values), "P")
            frame.putpalette(palette)
            gif_frames.append(frame)
        centiseconds = round(len(gif_frames) * 100 / fps)
        durations = [10 * (round((i + 1) * centiseconds / len(gif_frames))
                           - round(i * centiseconds / len(gif_frames)))
                     for i in range(len(gif_frames))]
        gif_frames[0].save(
            destination / "animation.gif", save_all=True,
            append_images=gif_frames[1:], duration=durations,
            loop=0, transparency=255, disposal=2, optimize=False,
        )
        primary = "animation.gif"
    metadata_name = "atlas.json" if kind == "atlas" else "animation.json"
    (destination / metadata_name).write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8",
    )
    display_root = ROOT if loop_name == "first_loop" else runs[slug]
    return {
        "folder": str(destination.relative_to(display_root)).replace("\\", "/"),
        "file": str((destination / primary).relative_to(display_root)).replace("\\", "/"),
        "download": f"/api/download/{slug}/{export_id}/{primary}",
        "metadata": f"/api/download/{slug}/{export_id}/{metadata_name}",
    }


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass

    def respond(self, status: int, data: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass

    def json(self, status: int, value: object) -> None:
        self.respond(status, json.dumps(value).encode("utf-8"), "application/json")

    def do_GET(self) -> None:
        url = urlparse(self.path)
        try:
            if url.path == "/api/animations":
                self.json(200, [run_info(slug, folder) for slug, folder in animation_runs().items()])
                return
            match = re.fullmatch(r"/api/frame/([A-Za-z0-9_-]+)/([0-9]+)", url.path)
            if match:
                path = frame_path(match[1], int(match[2]))
                remove_bg = parse_qs(url.query).get("bg", ["0"])[0] == "1"
                self.respond(200, frame_png(str(path), path.stat().st_mtime_ns, remove_bg), "image/png")
                return
            match = re.fullmatch(
                r"/api/download/([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)/(animation\.gif|atlas\.png|atlas\.json|animation\.json)",
                url.path,
            )
            if match and match[1] in animation_runs():
                path = animation_runs()[match[1]] / "manual_exports" / match[2] / match[3]
                if not path.is_file():
                    raise ValueError("Export not found")
                mime = "image/gif" if path.suffix == ".gif" else (
                    "image/png" if path.suffix == ".png" else "application/json")
                self.respond(200, path.read_bytes(), mime)
                return
            name = "index.html" if url.path == "/" else url.path.lstrip("/")
            if name not in ("index.html", "app.js", "style.css"):
                self.send_error(HTTPStatus.NOT_FOUND)
                return
            mime = {"index.html": "text/html; charset=utf-8",
                    "app.js": "text/javascript; charset=utf-8",
                    "style.css": "text/css; charset=utf-8"}[name]
            self.respond(200, (STATIC / name).read_bytes(), mime)
        except (ValueError, FileNotFoundError) as error:
            self.json(400, {"error": str(error)})
        except Exception as error:
            self.json(500, {"error": str(error)})

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/export":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 200_000:
                raise ValueError("Invalid request size")
            request = json.loads(self.rfile.read(length))
            if not isinstance(request, dict):
                raise ValueError("Invalid export request")
            self.json(200, export_animation(request))
        except (ValueError, KeyError, json.JSONDecodeError) as error:
            self.json(400, {"error": str(error)})
        except Exception as error:
            self.json(500, {"error": str(error)})


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"Animation editor: http://127.0.0.1:{server.server_port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
