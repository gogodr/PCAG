"""Inspect and confirm project-local animation loops for PCAG Creator."""

from __future__ import annotations

import base64
import json
import os
import re
import shutil
import sys
import tempfile
import uuid
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageSequence

PIPELINE = Path(__file__).resolve().parents[1] / "runpod-minimax-h3"
sys.path.insert(0, str(PIPELINE))
from extract_first_loop import suggest_return  # noqa: E402
from server import (export_animation, frame_path, frame_png, manually_edited_frame,
                    remove_connected_color, run_info, sprite_frames, style_frame, suggest_palette, validate_manual,
                    validate_style)  # noqa: E402


def source_identity(video: Path) -> dict:
    stat = video.stat()
    return {"file": video.name, "size": stat.st_size, "modifiedNs": str(stat.st_mtime_ns)}


def require_current_source(video: Path, helper: Path) -> None:
    if json.loads((helper / "source.json").read_text(encoding="utf-8")) != source_identity(video):
        raise ValueError("The source animation changed. Select it again before editing or exporting.")


def frames_of(video: Path):
    if video.suffix.lower() == ".gif":
        with Image.open(video) as source:
            durations = [frame.info.get("duration", 100) or 100 for frame in ImageSequence.Iterator(source)]
            fps = 1000 / (sum(durations) / len(durations))
            for frame in ImageSequence.Iterator(source):
                rgb = np.asarray(frame.convert("RGB"))
                yield cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), fps
        return
    capture = cv2.VideoCapture(str(video))
    if not capture.isOpened():
        raise ValueError(f"Cannot decode {video.name}. Install the codec required by this file.")
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    if not 0 < fps <= 120:
        capture.release()
        raise ValueError("Video has no usable frame rate.")
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            yield frame, fps
    finally:
        capture.release()


def inspect(video: Path, helper: Path) -> dict:
    identity = source_identity(video)
    helper.mkdir(exist_ok=True)
    manifest = helper / "source.json"
    if manifest.exists():
        if json.loads(manifest.read_text(encoding="utf-8")) != identity:
            raise ValueError("This video changed since processing. Remove its existing work folder before processing it again.")
    else:
        manifest.write_text(json.dumps(identity, indent=2) + "\n", encoding="utf-8")
    loop = helper / "animation_loop"
    if (loop / "loop_analysis.json").is_file():
        info = run_info("project", helper, "animation_loop")
        return {"status": "confirmed", **info}

    distances = []
    thumbs: list[str] = []
    first = None
    fps = 0.0
    width = height = 0
    for frame, fps in frames_of(video):
        height, width = frame.shape[:2]
        crop = frame[int(height * .04):int(height * .96), int(width * .04):int(width * .96)]
        sample = cv2.resize(crop, None, fx=.5, fy=.5, interpolation=cv2.INTER_AREA)
        if first is None:
            first = sample.astype(np.int16)
        distances.append(float(np.abs(sample.astype(np.int16) - first).mean()))
        thumbnail = cv2.resize(frame, (max(1, round(width * 110 / height)), 110), interpolation=cv2.INTER_AREA)
        ok, encoded = cv2.imencode(".jpg", thumbnail, [cv2.IMWRITE_JPEG_QUALITY, 65])
        if not ok:
            raise ValueError("Could not create timeline thumbnails.")
        thumbs.append(base64.b64encode(encoded).decode("ascii"))
    if len(distances) < 2:
        raise ValueError("Animation needs at least two frames.")
    suggested = suggest_return(distances) if len(distances) >= 10 else {"returnFrame": None, "closeReturns": []}
    end = suggested["returnFrame"] or len(distances)
    return {"status": "select", "fps": fps, "width": width, "height": height,
            "frameCount": len(distances), "start": 0, "end": end,
            "matched": suggested["returnFrame"] is not None,
            "thumbnails": thumbs, "distances": distances}


def confirm(video: Path, helper: Path, start: int, end: int) -> dict:
    if (helper / "animation_loop").exists():
        raise ValueError("This animation loop has already been confirmed.")
    require_current_source(video, helper)
    if type(start) is not int or type(end) is not int or start < 0 or end <= start:
        raise ValueError("Select a valid start and end frame.")
    temporary = helper / f"animation_loop.tmp-{uuid.uuid4().hex[:8]}"
    frames_dir = temporary / "loop_frames"
    frames_dir.mkdir(parents=True)
    count = 0
    source_count = 0
    fps = 0.0
    width = height = 0
    try:
        for index, (frame, fps) in enumerate(frames_of(video)):
            source_count = index + 1
            if start <= index < end:
                height, width = frame.shape[:2]
                if not cv2.imwrite(str(frames_dir / f"frame_{count:03}.png"), frame):
                    raise ValueError("Could not save a loop frame.")
                count += 1
        if count != end - start:
            raise ValueError("The video ended before the selected loop end.")
        analysis = {"source": str(video), "sourceFrameCount": source_count,
                    "width": width, "height": height, "fps": fps,
                    "firstLoopStartFrame": start, "firstLoopReturnFrame": end,
                    "keptFrames": count, "durationSeconds": count / fps,
                    "animation": video.stem, "sourceFrameIndices": list(range(start, end))}
        (temporary / "loop_analysis.json").write_text(json.dumps(analysis, indent=2) + "\n", encoding="utf-8")
        os.replace(temporary, helper / "animation_loop")
        return {"status": "confirmed", **run_info("project", helper, "animation_loop")}
    except Exception:
        import shutil
        shutil.rmtree(temporary, ignore_errors=True)
        raise


def import_frames(video: Path, helper: Path, paths: list[str], fps: int) -> dict:
    if not isinstance(paths, list) or len(paths) < 2 or len(paths) > 1000 or fps < 1 or fps > 60:
        raise ValueError('Select between 2 and 1000 frames.')
    if video.exists() or helper.exists():
        raise ValueError('An animation with this name already exists.')
    temporary = helper.with_name(helper.name + '.tmp-' + uuid.uuid4().hex[:8])
    frames_dir = temporary / 'animation_loop' / 'loop_frames'
    frames_dir.mkdir(parents=True)
    try:
        size = None
        images = []
        for index, raw_path in enumerate(paths):
            source = Path(raw_path)
            if source.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.webp'}:
                raise ValueError('Choose PNG, JPEG, or WebP frames.')
            with Image.open(source) as opened:
                image = opened.convert('RGBA')
            if size is None:
                size = image.size
            elif image.size != size:
                raise ValueError('Every frame must have the same dimensions.')
            image.save(frames_dir / f'frame_{index:03}.png')
            images.append(image)
        write_gif(images, fps, video)
        analysis = {'source': str(video), 'sourceFrameCount': len(images), 'width': size[0], 'height': size[1],
                    'fps': fps, 'firstLoopStartFrame': 0, 'firstLoopReturnFrame': len(images),
                    'keptFrames': len(images), 'durationSeconds': len(images) / fps,
                    'animation': video.stem, 'sourceFrameIndices': list(range(len(images)))}
        (temporary / 'animation_loop' / 'loop_analysis.json').write_text(json.dumps(analysis, indent=2) + '\n', encoding='utf-8')
        (temporary / 'source.json').write_text(json.dumps(source_identity(video), indent=2) + '\n', encoding='utf-8')
        os.replace(temporary, helper)
        return {'status': 'confirmed', **run_info('project', helper, 'animation_loop')}
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        video.unlink(missing_ok=True)
        raise


def write_gif(sprites: list[Image.Image], fps: int, target: Path) -> None:
    atlas = Image.new("RGBA", (sum(sprite.width for sprite in sprites), max(sprite.height for sprite in sprites)))
    offset = 0
    for sprite in sprites:
        atlas.alpha_composite(sprite, (offset, 0))
        offset += sprite.width
    palette_source = atlas.convert("RGB").quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    gif_palette = palette_source.getpalette()[:255 * 3] + [255, 0, 255]
    gif_frames = []
    for sprite in sprites:
        indexed = sprite.convert("RGB").quantize(palette=palette_source)
        values = np.asarray(indexed).copy()
        values[np.asarray(sprite.getchannel("A")) < 128] = 255
        frame = Image.fromarray(np.uint8(values), "P")
        frame.putpalette(gif_palette)
        gif_frames.append(frame)
    centiseconds = round(len(gif_frames) * 100 / fps)
    durations = [10 * (round((i + 1) * centiseconds / len(gif_frames))
                       - round(i * centiseconds / len(gif_frames)))
                 for i in range(len(gif_frames))]
    gif_frames[0].save(target, save_all=True, append_images=gif_frames[1:],
                       duration=durations, loop=0, transparency=255, disposal=2, optimize=False)


def regenerate_gif(metadata_path: Path, atlas_path: Path, gif_path: Path) -> dict:
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    fps = metadata.get("fps")
    frames = metadata.get("frames")
    if metadata.get("format") != "pcag-animation-atlas" or type(fps) is not int or not 1 <= fps <= 60 or not isinstance(frames, list) or not 1 <= len(frames) <= 1000:
        raise ValueError("Invalid animation atlas metadata.")
    with Image.open(atlas_path) as source:
        atlas = source.convert("RGBA")
    sprites = []
    for frame in frames:
        rect = frame.get("rect") if isinstance(frame, dict) else None
        if not isinstance(rect, dict) or any(type(rect.get(key)) is not int for key in ("x", "y", "width", "height")):
            raise ValueError("Invalid atlas frame rectangle.")
        x, y, width, height = (rect[key] for key in ("x", "y", "width", "height"))
        if x < 0 or y < 0 or width < 1 or height < 1 or x + width > atlas.width or y + height > atlas.height:
            raise ValueError("Atlas frame rectangle is outside the image.")
        sprites.append(atlas.crop((x, y, x + width, y + height)))
    with tempfile.NamedTemporaryFile(prefix=".pcag-gif-", suffix=".gif", dir=gif_path.parent, delete=False) as temporary:
        temp_path = Path(temporary.name)
    try:
        write_gif(sprites, fps, temp_path)
        temp_path.replace(gif_path)
    finally:
        temp_path.unlink(missing_ok=True)
    return {"gif": str(gif_path)}


def export_bundle(video: Path, helper: Path, destination: Path, request: dict) -> dict:
    """Write the current sequence as a GIF, atlas PNG, and atlas metadata."""
    require_current_source(video, helper)
    if not destination.is_dir():
        raise ValueError("Choose an existing export folder.")
    info = run_info("project", helper, "animation_loop")
    indices = request.get("frames")
    if not isinstance(indices, list) or not indices or any(type(index) is not int or index not in info["frames"] for index in indices) or len(indices) != len(set(indices)):
        raise ValueError("Select at least one valid frame without duplicates.")
    fps, width, height = (request.get(key) for key in ("fps", "width", "height"))
    if any(type(value) is not int for value in (fps, width, height)) or not (1 <= fps <= 60 and 1 <= width <= 1024 and 1 <= height <= 1024):
        raise ValueError("FPS and export dimensions are invalid.")
    if width * height * len(indices) > 30_000_000:
        raise ValueError("Atlas is too large; reduce frames or export dimensions.")
    remove_bg = request.get("removeBg")
    if type(remove_bg) is not bool:
        raise ValueError("Invalid background setting.")
    pixel_size, palette = validate_style(request.get("pixelSize", 1), request.get("palette", []))
    manual = validate_manual(request.get("manual", {}), info["frames"])
    sprites, crop = sprite_frames("project", indices, remove_bg, (width, height), {"project": helper}, "animation_loop", manual)
    sprites = [style_frame(sprite, pixel_size, palette) for sprite in sprites]

    base = re.sub(r"[^A-Za-z0-9_-]+", "_", video.stem).strip("_") or "animation"
    stem = base
    number = 2
    while any((destination / name).exists() for name in (f"{stem}.gif", f"{stem}_atlas.png", f"{stem}_atlas.json")):
        stem = f"{base}_{number}"
        number += 1
    gif_name, atlas_name, metadata_name = f"{stem}.gif", f"{stem}_atlas.png", f"{stem}_atlas.json"
    metadata = {
        "format": "pcag-animation-atlas", "animation": video.stem, "image": atlas_name,
        "gif": gif_name, "fps": fps, "frameWidth": width, "frameHeight": height,
        "frameCount": len(indices), "sourceFrameIndices": indices,
        "backgroundRemoved": remove_bg, "targetedBackgroundFrames": sorted(index for index in manual if index in indices),
        "sourceCrop": crop, "loop": True, "pixelSize": pixel_size, "palette": palette,
        "frames": [{"index": position, "sourceFrame": index,
                    "rect": {"x": position * width, "y": 0, "width": width, "height": height}}
                   for position, index in enumerate(indices)],
    }
    with tempfile.TemporaryDirectory(prefix=".pcag-export-", dir=destination) as temporary_name:
        temporary = Path(temporary_name)
        atlas = Image.new("RGBA", (width * len(sprites), height))
        for position, sprite in enumerate(sprites):
            atlas.alpha_composite(sprite, (position * width, 0))
        atlas.save(temporary / atlas_name)
        write_gif(sprites, fps, temporary / gif_name)
        (temporary / metadata_name).write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
        created = []
        try:
            for name in (gif_name, atlas_name, metadata_name):
                target = destination / name
                with target.open("xb") as output:
                    created.append(target)
                    with (temporary / name).open("rb") as source:
                        shutil.copyfileobj(source, output)
        except Exception:
            for target in created:
                target.unlink(missing_ok=True)
            raise
    return {"folder": str(destination), "gif": str(destination / gif_name),
            "atlas": str(destination / atlas_name), "metadata": str(destination / metadata_name)}


def main() -> None:
    request = json.load(sys.stdin)
    if request['operation'] == 'import-frames':
        json.dump(import_frames(Path(request['video']), Path(request['helper']), request['frames'], request['fps']), sys.stdout)
        return
    if request["operation"] == "regenerate-gif":
        json.dump(regenerate_gif(Path(request["metadata"]), Path(request["atlas"]), Path(request["gif"])), sys.stdout)
        return
    video = Path(request["video"])
    helper = Path(request["helper"])
    operation = request["operation"]
    if operation == "inspect":
        result = inspect(video, helper)
    elif operation == "confirm":
        result = confirm(video, helper, request["start"], request["end"])
    elif operation == "frame":
        require_current_source(video, helper)
        path = frame_path("project", request["index"], {"project": helper}, "animation_loop")
        manual = validate_manual(request.get("manual", {}), run_info("project", helper, "animation_loop")["frames"])
        pixel_size, palette = validate_style(request.get("pixelSize", 1), request.get("palette", []))
        if request["index"] in manual:
            from io import BytesIO
            output = BytesIO()
            manually_edited_frame(path, manual[request["index"]]).save(output, format="PNG")
            original = output.getvalue()
        else:
            original = frame_png(str(path), path.stat().st_mtime_ns, request["removeBg"])
        if pixel_size == 1 and not palette:
            encoded = original
        else:
            from io import BytesIO
            output = BytesIO()
            style_frame(Image.open(BytesIO(original)), pixel_size, palette).save(output, format="PNG")
            encoded = output.getvalue()
        result = {"data": base64.b64encode(encoded).decode("ascii")}
    elif operation == "target":
        require_current_source(video, helper)
        path = frame_path("project", request["index"], {"project": helper}, "animation_loop")
        manual = validate_manual(request.get("manual", {}), run_info("project", helper, "animation_loop")["frames"])
        entry = manual.get(request["index"], {"baseAuto": request["removeBg"], "seeds": []})
        frame = manually_edited_frame(path, entry)
        _, color, count = remove_connected_color(frame, request["x"], request["y"])
        result = {"color": color, "pixels": count, "baseAuto": entry["baseAuto"]}
    elif operation == "suggest-palette":
        require_current_source(video, helper)
        path = frame_path("project", request["index"], {"project": helper}, "animation_loop")
        manual = validate_manual(request.get("manual", {}), run_info("project", helper, "animation_loop")["frames"])
        pixel_size, _ = validate_style(request["pixelSize"], [])
        if request["index"] in manual:
            frame = manually_edited_frame(path, manual[request["index"]])
        else:
            from io import BytesIO
            frame = Image.open(BytesIO(frame_png(str(path), path.stat().st_mtime_ns, request["removeBg"]))).convert("RGBA")
        result = {"colors": suggest_palette(frame, pixel_size)}
    elif operation == "export":
        require_current_source(video, helper)
        payload = {**request["export"], "animation": "project"}
        result = export_animation(payload, {"project": helper}, "animation_loop")
    elif operation == "export-bundle":
        result = export_bundle(video, helper, Path(request["destination"]), request["export"])
    else:
        raise ValueError("Unsupported animation operation.")
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
