"""Submit one dummy walk pose to a Runpod ComfyUI queue endpoint.

The graph follows the Civitai Qwen Image Edit + ControlNet example, with its
nonessential Easy Use / rgthree nodes removed for headless execution.
"""

import argparse
import base64
from io import BytesIO
import json
import os
from pathlib import Path
import time
from urllib.request import Request, urlopen

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
POSES = ROOT / "generated/character-animations-openpose/walk_right"
REFERENCE = ROOT / "tools/sprites/references/animation-dummy-turnaround.png"


def graph(seed: int, prompt: str) -> dict:
    def node(kind, **inputs):
        return {"class_type": kind, "inputs": inputs}

    return {
        "38": node("CLIPLoader", clip_name="qwen_2.5_vl_7b_fp8_scaled.safetensors", type="qwen_image", device="default"),
        "39": node("VAELoader", vae_name="qwen_image_vae.safetensors"),
        "101": node("NunchakuQwenImageDiTLoader", model_name="svdq-fp4_r32-qwen-image-edit-lightningv1.0-8steps.safetensors", cpu_offload="enable", num_blocks_on_gpu=1, use_pin_memory="disable"),
        "66": node("ModelSamplingAuraFlow", model=["101", 0], shift=3.1),
        "75": node("CFGNorm", model=["66", 0], strength=1),
        "78": node("LoadImage", image="reference.png"),
        "102": node("FluxKontextImageScale", image=["78", 0]),
        "107": node("LoadImage", image="pose.png"),
        "116": node("FluxKontextImageScale", image=["107", 0]),
        "76": node("TextEncodeQwenImageEdit", clip=["38", 0], vae=["39", 0], image=["102", 0], prompt=prompt),
        "77": node("TextEncodeQwenImageEdit", clip=["38", 0], vae=["39", 0], image=["102", 0], prompt=""),
        "106": node("ControlNetLoader", control_net_name="Qwen-Image-InstantX-ControlNet-Union.safetensors"),
        "111": node("SetUnionControlNetType", control_net=["106", 0], type="openpose"),
        "104": node("ControlNetApplyAdvanced", positive=["76", 0], negative=["77", 0], control_net=["111", 0], image=["116", 0], vae=["39", 0], strength=1.2, start_percent=0, end_percent=1),
        "88": node("VAEEncode", pixels=["102", 0], vae=["39", 0]),
        "3": node("KSampler", model=["75", 0], positive=["104", 0], negative=["104", 1], latent_image=["88", 0], seed=seed, steps=8, cfg=1, sampler_name="euler", scheduler="beta", denoise=1),
        "8": node("VAEDecode", samples=["3", 0], vae=["39", 0]),
        "60": node("SaveImage", images=["8", 0], filename_prefix="pcag_dummy_walk"),
    }


def image(path: Path, name: str, crop_right_profile: bool = False) -> dict:
    if not path.is_file():
        raise FileNotFoundError(path)
    content = path.read_bytes()
    if crop_right_profile:
        with Image.open(BytesIO(content)) as source:
            rgba = source.convert("RGBA")
            region = rgba.crop((rgba.width * 3 // 4, 0, rgba.width, rgba.height))
            visible = region.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
            bounds = visible.getbbox()
            if bounds is None:
                raise ValueError("No right-facing figure found in the reference sheet")
            figure = region.crop(bounds)
            scale = min(842 / figure.height, 480 / figure.width)
            figure = figure.resize((round(figure.width * scale), round(figure.height * scale)), Image.Resampling.NEAREST)
            canvas = Image.new("RGBA", (512, 896), "#f0d9c5")
            canvas.alpha_composite(figure, ((512 - figure.width) // 2, 870 - figure.height))
            output = BytesIO()
            canvas.convert("RGB").save(output, format="PNG")
            content = output.getvalue()
    return {"name": name, "image": base64.b64encode(content).decode("ascii")}


def api(url: str, key: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = Request(url, data=data, headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urlopen(req, timeout=60) as response:
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint-id", default=os.environ.get("RUNPOD_ENDPOINT_ID"))
    parser.add_argument("--frame", type=int, default=0, choices=range(8))
    parser.add_argument("--reference", type=Path, default=REFERENCE)
    parser.add_argument("--output", type=Path, default=Path("generated/qwen-runpod"))
    parser.add_argument("--seed", type=int, default=433890916780646)
    parser.add_argument("--prompt", default="16-bit pixel art animation dummy, side view walking right, same appearance as reference image, exact limb placement shown by the pose image, plain transparent background")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pose = POSES / f"controlnet_frame_{args.frame:02}.png"
    payload = {"input": {"workflow": graph(args.seed, args.prompt), "images": [image(args.reference, "reference.png", args.reference == REFERENCE), image(pose, "pose.png")]}}
    if args.dry_run:
        print(json.dumps({"frame": args.frame, "pose": str(pose), "nodes": len(payload["input"]["workflow"]), "payload_bytes": len(json.dumps(payload))}, indent=2))
        return

    # Load .env without echoing secrets. Environment variables take precedence.
    env_file = ROOT / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("RUNPOD_API_KEY="):
                os.environ.setdefault("RUNPOD_API_KEY", line.partition("=")[2].strip().strip('"\''))
    key = os.environ.get("RUNPOD_API_KEY")
    if not key or not args.endpoint_id:
        parser.error("RUNPOD_API_KEY and --endpoint-id (or RUNPOD_ENDPOINT_ID) are required")

    base = f"https://api.runpod.ai/v2/{args.endpoint_id}"
    job = api(f"{base}/run", key, payload)
    job_id = job["id"]
    print(f"Submitted frame {args.frame}: job {job_id}")
    deadline = time.monotonic() + 900
    while time.monotonic() < deadline:
        result = api(f"{base}/status/{job_id}", key)
        if result.get("status") in {"COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT"}:
            break
        time.sleep(5)
    else:
        raise TimeoutError(f"Runpod job {job_id} is still running")
    if result.get("status") != "COMPLETED":
        raise RuntimeError(f"Runpod job {job_id}: {result.get('status')}: {result.get('error')}")
    images = result.get("output", {}).get("images", [])
    if not images:
        raise RuntimeError(f"Runpod job {job_id} returned no images")
    args.output.mkdir(parents=True, exist_ok=True)
    for index, entry in enumerate(images):
        if entry.get("type") != "base64":
            raise RuntimeError(f"Unsupported Runpod image type: {entry.get('type')}")
        target = args.output / f"frame_{args.frame:02}_{index}.png"
        target.write_bytes(base64.b64decode(entry["data"], validate=True))
        print(target)


if __name__ == "__main__":
    main()
