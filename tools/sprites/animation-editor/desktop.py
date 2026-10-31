"""One-shot image operations for the Creator animation module."""

from __future__ import annotations

import base64
import json
import sys

from server import export_animation, frame_path, frame_png


def main() -> None:
    request = json.load(sys.stdin)
    if request.get("operation") == "frame":
        path = frame_path(request["animation"], request["index"])
        data = frame_png(str(path), path.stat().st_mtime_ns, True)
        result = {"data": base64.b64encode(data).decode("ascii")}
    elif request.get("operation") == "export":
        result = export_animation(request["export"])
    else:
        raise ValueError("Unsupported animation operation")
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
