"""Run one OpenPose walk frame through the Pose Selector Flux Kontext graph."""

import argparse
import base64
from io import BytesIO
import json
import os
from pathlib import Path
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[3]
POSES = ROOT / "generated/character-animations-openpose/walk_right"
REFERENCE = ROOT / "tools/sprites/references/animation-dummy-turnaround.png"


def node(kind: str, **inputs: object) -> dict:
    return {"class_type": kind, "inputs": inputs}


def workflow(seed: int, prompt: str, steps: int) -> dict:
    # Equivalent to the recommended LoRA variant, with GUI image stitching,
    # resizing, cropping, rgthree, and TeaCache removed. The client supplies a
    # stitched image and crops the result after the job completes.
    return {
        "1": node("UnetLoaderGGUF", unet_name="flux1-kontext-dev-Q5_K_S.gguf"),
        "2": node("DualCLIPLoader", clip_name1="clip_l.safetensors", clip_name2="t5xxl_fp8_e4m3fn_scaled.safetensors", type="flux", device="default"),
        "3": node("VAELoader", vae_name="ae.safetensors"),
        "4": node("LoraLoader", model=["1", 0], clip=["2", 0], lora_name="refcontrol_pose.safetensors", strength_model=1.0, strength_clip=1.0),
        "5": node("LoadImage", image="reference_pose.png"),
        "6": node("FluxKontextImageScale", image=["5", 0]),
        "7": node("VAEEncode", pixels=["6", 0], vae=["3", 0]),
        "8": node("CLIPTextEncode", clip=["4", 1], text=prompt),
        "9": node("ReferenceLatent", conditioning=["8", 0], latent=["7", 0]),
        "10": node("FluxGuidance", conditioning=["9", 0], guidance=2.5),
        "11": node("ConditioningZeroOut", conditioning=["8", 0]),
        "12": node("KSampler", model=["4", 0], positive=["10", 0], negative=["11", 0], latent_image=["7", 0], seed=seed, steps=steps, cfg=1.0, sampler_name="euler", scheduler="normal", denoise=1.0),
        "13": node("VAEDecode", samples=["12", 0], vae=["3", 0]),
        "14": node("SaveImage", images=["13", 0], filename_prefix="pcag_flux_pose"),
    }


def reference_panel(path: Path) -> Image.Image:
    with Image.open(path) as source:
        rgb = source.convert("RGB")
        region = rgb.crop((rgb.width * 3 // 4, 0, rgb.width, rgb.height))
        pixels = list(region.get_flattened_data())
        core = Image.frombytes("L", region.size, bytes(
            255 if (r > 125 and g > 95 and b > 75) or (g > r + 8 and b > r + 8 and g > 50) else 0
            for r, g, b in pixels
        )).filter(ImageFilter.MaxFilter(19)).filter(ImageFilter.MinFilter(19))
        near_core = core.filter(ImageFilter.MaxFilter(13))
        mask = Image.frombytes("L", region.size, bytes(
            255 if c or (n and r > g + 16 and g < 45 and b < 55) else 0
            for (r, g, b), c, n in zip(pixels, core.get_flattened_data(), near_core.get_flattened_data())
        )).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
        bounds = mask.getbbox()
        if bounds is None:
            raise ValueError("No right-facing figure found in the reference sheet")
        figure = region.convert("RGBA")
        figure.putalpha(mask)
        figure = figure.crop(bounds)
        scale = min(880 / figure.height, 620 / figure.width)
        figure = figure.resize((round(figure.width * scale), round(figure.height * scale)), Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", (1024, 1024), "#f0d9c5")
        canvas.alpha_composite(figure, ((1024 - figure.width) // 2, 975 - figure.height))
        return canvas.convert("RGB")


def stitched_input(reference: Path, frame: int) -> bytes:
    left = reference_panel(reference)
    pose_path = POSES / f"controlnet_frame_{frame:02}.png"
    with Image.open(pose_path) as source:
        scale = min(576 / source.width, 960 / source.height)
        pose = source.convert("RGB").resize(
            (round(source.width * scale), round(source.height * scale)),
            Image.Resampling.NEAREST,
        )
        right = Image.new("RGB", (1024, 1024), "black")
        right.paste(pose, ((1024 - pose.width) // 2, (1024 - pose.height) // 2))
    combined = Image.new("RGB", (2048, 1024), "white")
    combined.paste(left, (0, 0))
    combined.paste(right, (1024, 0))
    output = BytesIO()
    combined.save(output, format="PNG")
    return output.getvalue()


def api(url: str, key: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    request = Request(url, data=data, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=90) as response:
            return json.load(response)
    except HTTPError as error:
        raise RuntimeError(f"Runpod HTTP {error.code}: {error.read(1000).decode('utf-8', errors='replace')}") from error


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint-id", default=os.environ.get("RUNPOD_ENDPOINT_ID"))
    parser.add_argument("--job-id", help="Retrieve an already submitted job")
    parser.add_argument("--frame", type=int, choices=range(8), default=0)
    parser.add_argument("--reference", type=Path, default=REFERENCE)
    parser.add_argument("--output", type=Path, default=ROOT / "generated/flux-runpod")
    parser.add_argument("--seed", type=int, default=433890916780646)
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--prompt", default="refcontrolpose change pose of the character in the left image to match the color skeleton in the right image. Keep the exact same blank oval head, teal joint caps, two arms, two legs, proportions, and 16-bit pixel art style. Show one full-body character on the right side.")
    parser.add_argument("--wait-seconds", type=int, default=1200)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if args.steps < 1 or not args.reference.is_file():
        parser.error("--steps must be positive and --reference must exist")

    payload = None
    if not args.job_id:
        combined = stitched_input(args.reference, args.frame)
        payload = {"input": {"workflow": workflow(args.seed, args.prompt, args.steps), "images": [{"name": "reference_pose.png", "image": base64.b64encode(combined).decode("ascii")}]}}
    if args.dry_run:
        if payload is None:
            parser.error("--dry-run requires a new submission")
        args.output.mkdir(parents=True, exist_ok=True)
        preview = args.output / f"input_{args.frame:02}.png"
        preview.write_bytes(combined)
        print(json.dumps({"frame": args.frame, "input_preview": str(preview), "nodes": len(payload["input"]["workflow"]), "payload_bytes": len(json.dumps(payload))}, indent=2))
        return

    env_file = ROOT / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("RUNPOD_API_KEY="):
                os.environ.setdefault("RUNPOD_API_KEY", line.partition("=")[2].strip().strip('"\''))
    key = os.environ.get("RUNPOD_API_KEY")
    if not key or not args.endpoint_id:
        parser.error("RUNPOD_API_KEY and --endpoint-id are required")

    base = f"https://api.runpod.ai/v2/{args.endpoint_id}"
    job_id = args.job_id
    if not job_id:
        job_id = api(f"{base}/run", key, payload)["id"]
        print(f"Submitted frame {args.frame}: {job_id}", flush=True)
    else:
        print(f"Resuming job {job_id}", flush=True)
    deadline = time.monotonic() + args.wait_seconds
    while time.monotonic() < deadline:
        result = api(f"{base}/status/{job_id}", key)
        if result.get("status") in {"COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"}:
            break
        time.sleep(5)
    else:
        raise TimeoutError(f"Job {job_id} remains {result.get('status')}")
    if result.get("status") != "COMPLETED":
        raise RuntimeError(f"Job {job_id}: {result.get('status')}: {result.get('error')}; output: {str(result.get('output'))[:2000]}")
    images = result.get("output", {}).get("images", [])
    if not images:
        raise RuntimeError(f"Job {job_id} returned no images")
    args.output.mkdir(parents=True, exist_ok=True)
    for index, entry in enumerate(images):
        if entry.get("type") != "base64":
            raise RuntimeError(f"Unsupported image type: {entry.get('type')}")
        raw = base64.b64decode(entry["data"], validate=True)
        output = args.output / f"frame_{args.frame:02}_{index}_stitched.png"
        output.write_bytes(raw)
        with Image.open(BytesIO(raw)) as image:
            image.crop((image.width // 2, 0, image.width, image.height)).save(args.output / f"frame_{args.frame:02}_{index}.png")
        print(output, flush=True)


if __name__ == "__main__":
    main()
