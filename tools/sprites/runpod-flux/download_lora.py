"""Fetch the workflow's authenticated pose LoRA before ComfyUI starts."""

import os
from pathlib import Path

import requests


URL = "https://civitai.com/api/download/models/2144028?fileId=2037775"
DESTINATION = Path("/comfyui/models/loras/refcontrol_pose.safetensors")
MIN_BYTES = 300_000_000


def main() -> None:
    if DESTINATION.is_file() and DESTINATION.stat().st_size >= MIN_BYTES:
        return
    key = os.environ.get("CIVITAI_API_KEY")
    if not key:
        raise RuntimeError("CIVITAI_API_KEY is required for the RefControl pose LoRA")
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    temporary = DESTINATION.with_suffix(".download")
    try:
        with requests.get(URL, headers={"Authorization": f"Bearer {key}"}, stream=True, timeout=120) as response:
            response.raise_for_status()
            with temporary.open("wb") as output:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        output.write(chunk)
        if temporary.stat().st_size < MIN_BYTES:
            raise RuntimeError("RefControl pose LoRA download was incomplete")
        temporary.replace(DESTINATION)
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
