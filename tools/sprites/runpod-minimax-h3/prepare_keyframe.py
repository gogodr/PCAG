"""Composite any transparent character pose onto a flat video background."""

import argparse
from pathlib import Path

from PIL import Image


DEFAULT_SOURCE = Path("generated/minimax-h3/walk_pose_source.png")
DEFAULT_OUTPUT = Path("generated/minimax-h3/walk_loop_keyframe.png")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pose", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--background", default="#644d4f",
                        help="Solid RGB background color, e.g. #644d4f")
    args = parser.parse_args()
    source = Image.open(args.pose).convert("RGBA")
    color = args.background.lstrip("#")
    if len(color) != 6:
        parser.error("--background must be a six-digit RGB hex color")
    try:
        rgb = tuple(bytes.fromhex(color))
    except ValueError:
        parser.error("--background must be a six-digit RGB hex color")
    background = Image.new("RGBA", source.size, (*rgb, 255))
    background.alpha_composite(source)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    background.convert("RGB").save(args.output)
    print(args.output.resolve())


if __name__ == "__main__":
    main()
