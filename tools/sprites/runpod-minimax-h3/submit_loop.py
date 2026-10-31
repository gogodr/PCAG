"""Submit one MiniMax H3 Turbo first/last-frame animation loop to Runpod."""

from __future__ import annotations

import argparse
import base64
import json
import os
import time
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[3]
DEFAULT_KEYFRAME = ROOT / "generated/minimax-h3/walk_loop_keyframe.png"
DEFAULT_OUTPUT = ROOT / "generated/minimax-h3"


def api_key() -> str:
    key = os.environ.get("RUNPOD_API_KEY")
    if key:
        return key
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("RUNPOD_API_KEY="):
            return line.partition("=")[2].strip().strip("\"'")
    raise RuntimeError("RUNPOD_API_KEY is required")


def payload(keyframe: Path, prompt: str, seconds: int, job_name: str) -> dict:
    image = base64.b64encode(keyframe.read_bytes()).decode("ascii")
    return {"input": {
        "workflow": "MiniMaxH3-Turbo-FL2VA.json",
        "images": [image, image],
        "prompt": prompt,
        "seconds": seconds,
        "config": "native_turbo",
        "video_size": "auto",
        "enhance": False,
        "upscale": False,
        "rife": False,
        "job_name": job_name,
    }}


def save_output(result: dict, output_dir: Path) -> None:
    output = result.get("output") or {}
    if not isinstance(output, dict):
        raise RuntimeError(f"Unexpected output type: {type(output).__name__}")
    files = output.get("outputs") or []
    for item in files:
        name = Path(item["filename"]).name
        if "b64" in item:
            data = base64.b64decode(item["b64"])
        elif "url" in item:
            response = requests.get(item["url"], timeout=300)
            response.raise_for_status()
            data = response.content
        else:
            continue
        path = output_dir / name
        path.write_bytes(data)
        print(f"saved {path} ({len(data)} bytes)", flush=True)
    (output_dir / "result.json").write_text(json.dumps({
        "jobId": result.get("id"), "status": result.get("status"),
        "files": [item.get("filename") for item in files],
        "texts": output.get("texts"),
    }, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--endpoint-id", help="Runpod Serverless endpoint ID")
    parser.add_argument("--job-id", help="Resume an already submitted job")
    parser.add_argument("--keyframe", type=Path, default=DEFAULT_KEYFRAME)
    parser.add_argument("--prompt", help="Motion and identity prompt")
    parser.add_argument("--prompt-file", type=Path, help="UTF-8 file containing the motion and identity prompt")
    parser.add_argument("--seconds", type=int, default=5)
    parser.add_argument("--job-name", default="pcag-animation-loop")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--submit-only", action="store_true",
                        help="Queue a new job and record its ID without polling")
    parser.add_argument("--wait-seconds", type=int, default=5400)
    args = parser.parse_args()
    if args.prompt and args.prompt_file:
        parser.error("Use --prompt or --prompt-file, not both")
    if args.submit_only and args.job_id:
        parser.error("--submit-only cannot be combined with --job-id")
    prompt = args.prompt or (args.prompt_file.read_text(encoding="utf-8") if args.prompt_file else None)
    if not args.job_id and not prompt:
        parser.error("A new job requires --prompt or --prompt-file")
    if args.seconds < 1:
        parser.error("--seconds must be positive")
    if args.dry_run:
        print(json.dumps({
            "keyframe": str(args.keyframe), "keyframeBytes": args.keyframe.stat().st_size,
            "workflow": "MiniMaxH3-Turbo-FL2VA.json", "images": 2,
            "sameFirstAndLastImage": True, "seconds": args.seconds,
            "config": "native_turbo", "prompt": prompt,
            "outputDir": str(args.output_dir), "jobName": args.job_name,
        }, indent=2))
        return
    if not args.endpoint_id:
        parser.error("--endpoint-id is required unless --dry-run is used")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    base = f"https://api.runpod.ai/v2/{args.endpoint_id}"
    headers = {"Authorization": f"Bearer {api_key()}"}
    if args.job_id:
        job_id = args.job_id
    else:
        response = requests.post(
            f"{base}/run", headers=headers,
            json=payload(args.keyframe, prompt, args.seconds, args.job_name), timeout=120,
        )
        if not response.ok:
            raise RuntimeError(f"Runpod submission failed ({response.status_code}): {response.text[:1000]}")
        job_id = response.json()["id"]
        (args.output_dir / "job.json").write_text(json.dumps({
            "endpointId": args.endpoint_id, "jobId": job_id,
        }, indent=2) + "\n", encoding="utf-8")
        print(f"submitted {job_id}", flush=True)
        if args.submit_only:
            return
    deadline = time.monotonic() + args.wait_seconds
    last_status = None
    while time.monotonic() < deadline:
        response = requests.get(f"{base}/status/{job_id}", headers=headers, timeout=60)
        response.raise_for_status()
        result = response.json()
        status = result.get("status")
        if status != last_status:
            print(f"{job_id}: {status}", flush=True)
            last_status = status
        if status == "COMPLETED":
            save_output(result, args.output_dir)
            return
        if status in ("FAILED", "CANCELLED", "TIMED_OUT"):
            raise RuntimeError(f"Job {job_id}: {status}: {result.get('error') or result.get('output')}")
        time.sleep(10)
    raise TimeoutError(f"Job {job_id} still {last_status}; resume with --job-id {job_id}")


if __name__ == "__main__":
    main()
