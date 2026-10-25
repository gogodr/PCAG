"""Run the workspace-local runpodctl with RUNPOD_API_KEY from .env."""

import os
from pathlib import Path
import subprocess
import sys

from comfy_walk import LOCAL, env_keys


def main() -> int:
    executable = LOCAL / "runpodctl.exe"
    if not executable.exists():
        raise SystemExit(f"Runpod CLI not found at {executable}")
    key = env_keys().get("RUNPOD_API_KEY")
    if not key:
        raise SystemExit("Set RUNPOD_API_KEY in the repository .env")
    environment = dict(os.environ)
    environment["RUNPOD_API_KEY"] = key
    return subprocess.run([str(executable), *sys.argv[1:]], env=environment, cwd=Path.cwd()).returncode


if __name__ == "__main__":
    raise SystemExit(main())
