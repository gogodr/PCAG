"""Install and drive a local ComfyUI SD1.5 + OpenPose + mPixel walk workflow."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import venv

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / "tools" / "sprites" / ".local"
COMFY = LOCAL / "ComfyUI"
VENV = LOCAL / ".venv"
PYTHON = VENV / "Scripts" / "python.exe" if os.name == "nt" else VENV / "bin" / "python"
POSE = ROOT / "generated" / "character-animations-openpose" / "walk_right"
OUTPUT = ROOT / "generated" / "character-animations-comfy" / "walk_right"
REFERENCE = ROOT / "generated" / "character-animations-dummy" / "walk_right" / "frame_00.png"
SHEET = ROOT / "tools" / "sprites" / "references" / "animation-dummy-turnaround.png"
SD_URL = "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.safetensors"
CONTROL_URL = "https://huggingface.co/lllyasviel/ControlNet-v1-1/resolve/main/control_v11p_sd15_openpose.pth"
SD_FILE = "v1-5-pruned-emaonly.safetensors"
CONTROL_FILE = "control_v11p_sd15_openpose.pth"
LORA_FILE = "mpixel.safetensors"


def env_keys() -> dict[str, str]:
    result = dict(os.environ)
    path = ROOT / ".env"
    if path.exists():
        for raw in path.read_text(encoding="utf-8-sig").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            result.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    return result


def request_json(url: str, token: str | None = None, data: dict | None = None) -> dict:
    headers = {"User-Agent": "PCAG-sprite-tool/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    payload = None if data is None else json.dumps(data).encode()
    if payload is not None:
        headers["Content-Type"] = "application/json"
    with urllib.request.urlopen(urllib.request.Request(url, payload, headers), timeout=90) as response:
        return json.load(response)


def download(url: str, path: Path, token: str | None = None) -> None:
    if path.exists() and path.stat().st_size > 1024 * 1024:
        print(f"Already present: {path.name}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".partial")
    headers = {"User-Agent": "PCAG-sprite-tool/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    print(f"Downloading {path.name}...")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as response, temporary.open("wb") as target:
            shutil.copyfileobj(response, target)
        if temporary.stat().st_size < 1024 * 1024:
            raise RuntimeError(f"Downloaded file is unexpectedly small: {path.name}")
        temporary.replace(path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def choose_lora(api_key: str) -> tuple[str, str]:
    model = request_json("https://civitai.com/api/v1/models/44960", api_key)
    versions = model.get("modelVersions", [])
    for version in versions:
        base = str(version.get("baseModel", "")).lower()
        if "1.5" not in base:
            continue
        files = version.get("files", [])
        file = next((item for item in files if item.get("type") == "Model" and item.get("downloadUrl")), None)
        if file:
            print(f"mPixel version id {version.get('id')} (base {version.get('baseModel')})")
            return file["downloadUrl"], version.get("trainedWords", [""])[0] if version.get("trainedWords") else ""
    raise RuntimeError("Civitai model 44960 has no downloadable SD 1.5 LoRA version")


def setup() -> None:
    keys = env_keys()
    if not (COMFY / "main.py").exists():
        LOCAL.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--depth", "1", "https://github.com/Comfy-Org/ComfyUI.git", str(COMFY)], check=True)
    if not PYTHON.exists():
        venv.create(VENV, system_site_packages=True, with_pip=True)
    subprocess.run([str(PYTHON), "-m", "pip", "install", "-r", str(COMFY / "requirements.txt")], check=True)
    download(SD_URL, COMFY / "models" / "checkpoints" / SD_FILE, keys.get("HF_TOKEN"))
    download(CONTROL_URL, COMFY / "models" / "controlnet" / CONTROL_FILE, keys.get("HF_TOKEN"))
    lora_path = COMFY / "models" / "loras" / LORA_FILE
    metadata_path = LOCAL / "mpixel_metadata.json"
    if not lora_path.exists() or not metadata_path.exists():
        if not keys.get("CIVITAI_API_KEY"):
            raise RuntimeError("Set CIVITAI_API_KEY in .env")
        lora_url, trigger = choose_lora(keys["CIVITAI_API_KEY"])
        download(lora_url, lora_path, keys["CIVITAI_API_KEY"])
        metadata_path.write_text(json.dumps({"trigger": trigger}, indent=2), encoding="utf-8")
    print("ComfyUI and models are ready.")


def prompts(trigger: str, preset: str) -> tuple[str, str]:
    if preset == "reference-faithful":
        positive = [
            trigger, "16-bit pixel art game sprite", "articulated animation mannequin",
            "blank smooth oval ivory head", "warm cream segmented body panels",
            "muted teal circular shoulder elbow hip knee and ankle joints",
            "dark plum pixel outline", "same character design as the reference image",
            "full body right-facing side profile", "walking pose", "centered single figure",
            "flat pale beige background", "crisp pixel edges",
        ]
        negative = "silver, chrome, metal armor, gray body, hair, eyes, nose, mouth, clothes, hat, skin texture, photorealism, 3d rendering, text, watermark, extra limbs, missing limbs, cropped body, multiple characters, motion blur"
    elif preset == "original":
        positive = [
            trigger, "16-bit pixel art game sprite", "full body faceless wooden mannequin robot doll",
            "blank cream oval head, cream segmented body, teal ball joints, dark plum outlines",
            "no hair, no clothes, no face", "side view facing right",
            "single character", "entire body visible", "clean silhouette", "plain solid background",
            "consistent costume and proportions", "walking animation frame",
        ]
        negative = "human, person, hair, face, eyes, mouth, nose, clothing, hat, photograph, 3d render, text, watermark, extra limbs, missing limbs, cropped body, multiple characters, detailed background, motion blur"
    else:
        raise ValueError(f"Unknown prompt preset: {preset}")
    return ", ".join(filter(None, positive)), negative


def workflow(pose_name: str, seed: int, trigger: str, prefix: str, strength: float, reference_name: str | None = None, denoise: float = 0.75, prompt_preset: str = "original", control_strength: float = 1.15) -> dict:
    prompt, negative = prompts(trigger, prompt_preset)
    graph = {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": SD_FILE}},
        "2": {"class_type": "LoraLoader", "inputs": {"model": ["1", 0], "clip": ["1", 1], "lora_name": LORA_FILE, "strength_model": strength, "strength_clip": strength}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": prompt}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 1], "text": negative}},
        "5": {"class_type": "LoadImage", "inputs": {"image": pose_name}},
        "6": {"class_type": "ControlNetLoader", "inputs": {"control_net_name": CONTROL_FILE}},
        "7": {"class_type": "ControlNetApplyAdvanced", "inputs": {"positive": ["3", 0], "negative": ["4", 0], "control_net": ["6", 0], "image": ["5", 0], "strength": control_strength, "start_percent": 0.0, "end_percent": 1.0}},
        "8": {"class_type": "EmptyLatentImage", "inputs": {"width": 512, "height": 896, "batch_size": 1}},
        "9": {"class_type": "KSampler", "inputs": {"model": ["2", 0], "positive": ["7", 0], "negative": ["7", 1], "latent_image": ["8", 0], "seed": seed, "steps": 30, "cfg": 7.0, "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": denoise if reference_name else 1.0}},
        "10": {"class_type": "VAEDecode", "inputs": {"samples": ["9", 0], "vae": ["1", 2]}},
        "11": {"class_type": "SaveImage", "inputs": {"images": ["10", 0], "filename_prefix": prefix}},
    }
    if reference_name:
        graph["12"] = {"class_type": "LoadImage", "inputs": {"image": reference_name}}
        graph["13"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["12", 0], "vae": ["1", 2]}}
        graph["9"]["inputs"]["latent_image"] = ["13", 0]
        del graph["8"]
    return graph


def api(base: str, path: str, payload: dict | None = None) -> dict:
    return request_json(base + path, data=payload)


def prepare_reference(source_name: str) -> Image.Image:
    background = "#f0d9c5"
    if source_name == "sheet-right":
        with Image.open(SHEET) as sheet:
            rgba = sheet.convert("RGBA")
            # The fourth figure is the right-facing profile. Find its visible pixels
            # within the rightmost quarter so transparent margins do not shrink it.
            region = rgba.crop((1152, 0, rgba.width, rgba.height))
            visible = region.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
            box = visible.getbbox()
            if box is None:
                raise RuntimeError("Could not find the right-facing figure in the reference sheet")
            left, top, right, bottom = box
            figure = region.crop((max(0, left - 12), max(0, top - 12),
                                  min(region.width, right + 12), min(region.height, bottom + 12)))
            scale = min(842 / figure.height, 480 / figure.width)
            figure = figure.resize((round(figure.width * scale), round(figure.height * scale)), Image.Resampling.NEAREST)
            canvas = Image.new("RGBA", (512, 896), background)
            canvas.alpha_composite(figure, ((512 - figure.width) // 2, 870 - figure.height))
            return canvas.convert("RGB")
    if source_name == "dummy-frame":
        with Image.open(REFERENCE) as source:
            canvas = Image.new("RGBA", source.size, background)
            canvas.alpha_composite(source.convert("RGBA"))
            return canvas.convert("RGB").resize((512, 896), Image.Resampling.NEAREST)
    raise ValueError(f"Unknown reference source: {source_name}")


def render(args: argparse.Namespace) -> None:
    if not COMFY.exists():
        raise RuntimeError("Run setup first")
    trigger = ""
    metadata = LOCAL / "mpixel_metadata.json"
    if metadata.exists():
        trigger = json.loads(metadata.read_text(encoding="utf-8")).get("trigger", "")
    controls = args.frames if args.frames else list(range(8))
    out = args.output_dir or (OUTPUT if controls == list(range(8)) else OUTPUT / "preview")
    out.mkdir(parents=True, exist_ok=True)
    reference_name = None
    if not args.text_only:
        reference_name = f"pcag_{args.reference_source.replace('-', '_')}_reference.png"
        image = prepare_reference(args.reference_source)
        image.save(COMFY / "input" / reference_name)
        image.save(out / "reference_input.png")
    base = f"http://127.0.0.1:{args.port}"
    if not PYTHON.exists():
        raise RuntimeError("Run setup to create the local Python environment")
    process = subprocess.Popen([str(PYTHON), str(COMFY / "main.py"), "--listen", "127.0.0.1", "--port", str(args.port), "--disable-auto-launch", "--disable-all-custom-nodes"], cwd=COMFY)
    try:
        for _ in range(120):
            if process.poll() is not None:
                raise RuntimeError(f"ComfyUI exited with code {process.returncode}")
            try:
                api(base, "/object_info")
                break
            except (urllib.error.URLError, TimeoutError):
                time.sleep(1)
        else:
            raise RuntimeError("ComfyUI did not become ready in 120 seconds")
        outputs = []
        for index in controls:
            pose = POSE / f"controlnet_frame_{index:02d}.png"
            if not pose.exists():
                raise FileNotFoundError(pose)
            # Keep pose coordinates fixed while expanding to SD1.5's working resolution.
            with Image.open(pose) as source:
                image = Image.new("RGB", (512, 896), "black")
                image.paste(source.convert("RGB").resize((504, 896), Image.Resampling.NEAREST), (4, 0))
            input_name = f"pcag_pose_{index:02d}.png"
            image.save(COMFY / "input" / input_name)
            graph = workflow(input_name, args.seed, trigger, f"pcag_walk_{index:02d}", args.lora_strength, reference_name, args.denoise, args.prompt_preset, args.control_strength)
            queued = api(base, "/prompt", {"prompt": graph, "client_id": str(uuid.uuid4())})
            if queued.get("node_errors"):
                raise RuntimeError(f"Workflow validation failed: {queued['node_errors']}")
            prompt_id = queued["prompt_id"]
            print(f"Rendering frame {index:02d}...")
            for _ in range(900):
                history = api(base, f"/history/{prompt_id}").get(prompt_id)
                if history:
                    status = history.get("status", {})
                    if status.get("status_str") == "error":
                        raise RuntimeError(f"ComfyUI frame {index:02d} failed: {status.get('messages')}")
                    images = history.get("outputs", {}).get("11", {}).get("images", [])
                    if images:
                        item = images[0]
                        query = urllib.parse.urlencode({"filename": item["filename"], "subfolder": item.get("subfolder", ""), "type": item.get("type", "output")})
                        with urllib.request.urlopen(base + "/view?" + query, timeout=90) as response:
                            raw = out / f"raw_{index:02d}.png"
                            raw.write_bytes(response.read())
                        with Image.open(raw) as generated:
                            generated.convert("RGB").resize((90, 160), Image.Resampling.NEAREST).save(out / f"frame_{index:02d}.png")
                        outputs.append(index)
                        break
                time.sleep(1)
            else:
                raise TimeoutError(f"Frame {index:02d} took over 15 minutes")
        if outputs == list(range(8)):
            frames = [Image.open(out / f"frame_{i:02d}.png").convert("RGB") for i in outputs]
            atlas = Image.new("RGB", (720, 160))
            overlay_atlas = Image.new("RGBA", (720, 160))
            for i, frame in enumerate(frames):
                atlas.paste(frame, (i * 90, 0))
                with Image.open(POSE / f"controlnet_frame_{i:02d}.png") as guide:
                    rgba = guide.convert("RGBA")
                    rgba.putalpha(guide.convert("RGB").convert("L").point(lambda value: 180 if value > 0 else 0))
                    overlaid = frame.convert("RGBA")
                    overlaid.alpha_composite(rgba)
                    overlay_atlas.alpha_composite(overlaid, (i * 90, 0))
            atlas.save(out / "atlas.png")
            overlay_atlas.save(out / "overlay_atlas.png")
            frames[0].save(out / "animation.gif", save_all=True, append_images=frames[1:], duration=125, loop=0)
        (out / "settings.json").write_text(json.dumps({"seed": args.seed, "lora_strength": args.lora_strength, "denoise": args.denoise, "prompt_preset": args.prompt_preset, "control_strength": args.control_strength, "reference_source": args.reference_source if reference_name else None, "reference": str(SHEET if args.reference_source == "sheet-right" else REFERENCE) if reference_name else None, "frames": outputs, "workflow": workflow("pcag_pose_00.png", args.seed, trigger, "pcag_walk_00", args.lora_strength, reference_name, args.denoise, args.prompt_preset, args.control_strength)}, indent=2), encoding="utf-8")
        print(f"Saved {len(outputs)} frame(s) to {out}")
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("setup")
    run = sub.add_parser("render")
    run.add_argument("--frames", type=int, nargs="*", choices=range(8), help="Selected frame numbers (default: all eight)")
    run.add_argument("--seed", type=int, default=44960)
    run.add_argument("--lora-strength", type=float, default=0.8)
    run.add_argument("--denoise", type=float, default=0.75, help="Reference image strength, 0-1 (higher changes more)")
    run.add_argument("--text-only", action="store_true", help="Disable image reference and start from noise")
    run.add_argument("--reference-source", choices=("dummy-frame", "sheet-right"), default="dummy-frame", help="Image-to-image source (default: prior dummy frame)")
    run.add_argument("--prompt-preset", choices=("original", "reference-faithful"), default="original")
    run.add_argument("--control-strength", type=float, default=1.15)
    run.add_argument("--port", type=int, default=8188)
    run.add_argument("--output-dir", type=Path, help="Override the output directory for comparison runs")
    args = parser.parse_args()
    if args.command == "setup":
        setup()
    else:
        render(args)


if __name__ == "__main__":
    main()
