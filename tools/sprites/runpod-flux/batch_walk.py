"""Queue and retrieve the seven remaining walk-right frames on Runpod."""

import argparse
import base64
from io import BytesIO
import json
import os
from pathlib import Path
import shutil
import time

from PIL import Image
import requests

from submit import REFERENCE, ROOT, stitched_input, workflow


GUIDES = ROOT / "generated/flux-runpod/dwpose-guides"
OUTPUT = ROOT / "generated/flux-runpod/walk_right"
SOURCE_FRAME = ROOT / "generated/flux-runpod/dwpose-test/frame_00_0.png"
PROMPT = "refcontrolpose change pose to photo with reference from left side"


def key() -> str:
    env_file = ROOT / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("RUNPOD_API_KEY="):
                os.environ.setdefault("RUNPOD_API_KEY", line.partition("=")[2].strip().strip('"\''))
    result = os.environ.get("RUNPOD_API_KEY")
    if not result:
        raise RuntimeError("RUNPOD_API_KEY is required")
    return result


def save_output(output: Path, frame: int, result: dict) -> None:
    images = result.get("output", {}).get("images", [])
    if len(images) != 1 or images[0].get("type") != "base64":
        raise RuntimeError(f"Frame {frame} returned an unexpected image payload")
    raw = base64.b64decode(images[0]["data"], validate=True)
    (output / f"frame_{frame:02}_stitched.png").write_bytes(raw)
    with Image.open(BytesIO(raw)) as image:
        image.crop((image.width // 2, 0, image.width, image.height)).save(output / f"frame_{frame:02}.png")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint-id", required=True)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--wait-seconds", type=int, default=2400)
    parser.add_argument("--seed", type=int, default=433890916780646)
    parser.add_argument("--steps", type=int, default=20)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    manifest_path = args.output / "jobs.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    if "0" not in manifest and SOURCE_FRAME.is_file():
        shutil.copyfile(SOURCE_FRAME, args.output / "frame_00.png")
        manifest["0"] = {"status": "COMPLETED", "source": str(SOURCE_FRAME)}
    token = key()
    headers = {"Authorization": f"Bearer {token}"}
    base = f"https://api.runpod.ai/v2/{args.endpoint_id}"

    for frame in range(1, 8):
        entry = manifest.get(str(frame), {})
        if entry.get("job_id") or (args.output / f"frame_{frame:02}.png").exists():
            continue
        combined = stitched_input(REFERENCE, GUIDES / f"dwpose_{frame:02}.png")
        body = {"input": {"workflow": workflow(args.seed, PROMPT, args.steps), "images": [{"name": "reference_pose.png", "image": base64.b64encode(combined).decode("ascii")}]}}
        response = requests.post(f"{base}/run", headers=headers, json=body, timeout=60)
        response.raise_for_status()
        job_id = response.json()["id"]
        manifest[str(frame)] = {"job_id": job_id, "status": "IN_QUEUE"}
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"frame {frame}: {job_id}", flush=True)

    deadline = time.monotonic() + args.wait_seconds
    pending = {frame for frame in range(1, 8) if not (args.output / f"frame_{frame:02}.png").exists()}
    while pending and time.monotonic() < deadline:
        for frame in list(pending):
            job_id = manifest[str(frame)]["job_id"]
            try:
                response = requests.get(f"{base}/status/{job_id}", headers=headers, timeout=20)
                response.raise_for_status()
            except requests.RequestException as error:
                print(f"frame {frame}: status temporarily unavailable ({type(error).__name__})", flush=True)
                continue
            result = response.json()
            status = result.get("status")
            if status != manifest[str(frame)]["status"]:
                manifest[str(frame)]["status"] = status
                manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
                print(f"frame {frame}: {status}", flush=True)
            if status == "COMPLETED":
                save_output(args.output, frame, result)
                pending.remove(frame)
            elif status in {"FAILED", "CANCELLED", "TIMED_OUT"}:
                manifest[str(frame)]["error"] = str(result.get("error"))[:1500]
                manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
                raise RuntimeError(f"frame {frame}: {status}: {result.get('error')}")
        if pending:
            time.sleep(10)
    if pending:
        raise TimeoutError(f"Frames still pending: {sorted(pending)}; resume with the same command")
    print(args.output)


if __name__ == "__main__":
    main()
