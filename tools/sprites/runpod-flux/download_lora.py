"""Fetch the workflow's authenticated pose LoRA before ComfyUI starts."""

import os
from pathlib import Path
from urllib.request import Request, urlopen


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
    request = Request(URL, headers={"Authorization": f"Bearer {key}"})
    try:
        with urlopen(request, timeout=120) as response, temporary.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        if temporary.stat().st_size < MIN_BYTES:
            raise RuntimeError("RefControl pose LoRA download was incomplete")
        temporary.replace(DESTINATION)
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
