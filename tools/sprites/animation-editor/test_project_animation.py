"""Exercise project-local loop selection and export with a small video."""

import json
import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from project_animation import confirm, export_bundle, import_frames, inspect, regenerate_gif
from server import (export_animation, manually_edited_frame, remove_connected_color,
                    style_frame, suggest_palette, validate_style)


class ProjectAnimationTest(unittest.TestCase):
    def test_import_frames_opens_confirmed_editor_sequence(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sources = [root / f'frame_{index}.png' for index in range(3)]
            for index, source in enumerate(sources):
                Image.new('RGBA', (8, 8), (index * 50, 20, 30, 255)).save(source)
            video, helper = root / 'walk.gif', root / '_walk'
            result = import_frames(video, helper, [str(source) for source in sources], 6)
            self.assertEqual(result['frames'], [0, 1, 2])
            self.assertEqual(inspect(video, helper)['status'], 'confirmed')
            with Image.open(helper / 'animation_loop' / 'loop_frames' / 'frame_002.png') as frame:
                self.assertEqual(frame.getpixel((0, 0)), (100, 20, 30, 255))

    def test_palette_suggestion_groups_by_rgb_distance(self):
        image = Image.new("RGBA", (4, 1), (0, 0, 0, 0))
        image.putpixel((0, 0), (0, 100, 100, 255))
        image.putpixel((1, 0), (10, 130, 100, 255))
        image.putpixel((2, 0), (200, 0, 0, 255))
        self.assertEqual(suggest_palette(image, 1), ["#057364", "#c80000"])

    def test_targeted_removal_keeps_enclosed_matching_color(self):
        image = Image.new("RGBA", (9, 9), (180, 30, 30, 255))
        for coordinate in range(2, 7):
            for x, y in ((coordinate, 2), (coordinate, 6), (2, coordinate), (6, coordinate)):
                image.putpixel((x, y), (20, 20, 200, 255))
        removed, color, count = remove_connected_color(image, 0, 0)
        self.assertEqual(color, [180, 30, 30])
        self.assertGreater(count, 0)
        self.assertEqual(removed.getpixel((0, 0))[3], 0)
        self.assertEqual(removed.getpixel((4, 4))[3], 255)
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "frame.png"
            image.save(source)
            manual = manually_edited_frame(source, {"baseAuto": False, "seeds": [{"x": 0, "y": 0, "color": color}]})
            self.assertEqual(manual.getpixel((4, 4))[3], 255)

    def test_pixel_blocks_and_palette_preserve_alpha(self):
        image = Image.new("RGBA", (4, 2), (240, 10, 10, 255))
        image.putpixel((2, 0), (10, 10, 240, 255))
        image.putpixel((3, 1), (10, 10, 240, 0))
        styled = style_frame(image, 2, ["#ff0000", "#0000ff"])
        self.assertEqual(styled.size, (4, 2))
        self.assertEqual(styled.getpixel((0, 0)), styled.getpixel((1, 1)))
        self.assertEqual(styled.getpixel((0, 0))[:3], (255, 0, 0))
        self.assertEqual(styled.getpixel((2, 0))[:3], (0, 0, 255))
        self.assertEqual(styled.getpixel((3, 1))[3], 0)
        self.assertEqual(validate_style(2, ["#ff0000"]), (2, ["#ff0000"]))
        with self.assertRaises(ValueError):
            validate_style(0, [])

    def test_inspect_confirm_and_export(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            video = root / "walk_dummy.mp4"
            writer = cv2.VideoWriter(str(video), cv2.VideoWriter_fourcc(*"mp4v"), 12, (64, 64))
            self.assertTrue(writer.isOpened())
            for index in range(20):
                image = np.full((64, 64, 3), 40, dtype=np.uint8)
                cv2.circle(image, (15 + index % 10 * 3, 32), 8, (160, 180, 210), -1)
                writer.write(image)
            writer.release()
            helper = root / "_walk_dummy"
            proposal = inspect(video, helper)
            self.assertEqual(proposal["status"], "select")
            self.assertEqual(proposal["frameCount"], 20)
            self.assertEqual(len(proposal["thumbnails"]), 20)
            self.assertFalse((helper / "animation_loop").exists())
            result = confirm(video, helper, 2, 10)
            self.assertEqual(result["status"], "confirmed")
            self.assertEqual(result["frames"], list(range(8)))
            self.assertEqual(inspect(video, helper)["status"], "confirmed")
            analysis = json.loads((helper / "animation_loop" / "loop_analysis.json").read_text())
            self.assertEqual((analysis["firstLoopStartFrame"], analysis["firstLoopReturnFrame"]), (2, 10))
            exported = export_animation({"animation": "project", "kind": "atlas", "frames": [0, 2, 4, 6], "fps": 6, "width": 16, "height": 24, "removeBg": False}, {"project": helper}, "animation_loop")
            self.assertTrue((helper / exported["file"]).is_file())
            images = root / "images"
            images.mkdir()
            settings = {"frames": [0, 2, 4, 6], "fps": 6, "width": 16, "height": 24,
                        "removeBg": False, "pixelSize": 2, "palette": ["#ff0000"]}
            bundle = export_bundle(video, helper, images, settings)
            self.assertTrue(Path(bundle["gif"]).is_file())
            self.assertTrue(Path(bundle["atlas"]).is_file())
            metadata = json.loads(Path(bundle["metadata"]).read_text())
            self.assertEqual(metadata["format"], "pcag-animation-atlas")
            self.assertEqual(metadata["image"], Path(bundle["atlas"]).name)
            original_gif = Path(bundle["gif"]).read_bytes()
            Path(bundle["gif"]).unlink()
            regenerate_gif(Path(bundle["metadata"]), Path(bundle["atlas"]), Path(bundle["gif"]))
            self.assertEqual(Path(bundle["gif"]).read_bytes(), original_gif)
            self.assertNotEqual(export_bundle(video, helper, images, settings)["gif"], bundle["gif"])


if __name__ == "__main__":
    unittest.main()
