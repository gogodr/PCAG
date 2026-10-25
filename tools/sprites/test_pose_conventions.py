"""Checks for COCO-18 anatomy and the OpenPose editor's color convention."""

import unittest

from generate_character_animations import animation_pose
from generate_side_walk_openpose import (
    COLORS, CONNECTIONS, CONTROLNET_CONNECTIONS, FRAME_COUNT, FRAME_WIDTH,
    KEYPOINT_NAMES, SIDE_SWAP, pose_document, render_controlnet_frame,
)


class PoseConventionTests(unittest.TestCase):
    def test_editor_palette_and_connections(self):
        # OpenposeBody in huchenlei/sd-webui-openpose-editor/src/Openpose.ts.
        self.assertEqual(CONNECTIONS, (
            (0, 1), (1, 2), (2, 3), (3, 4), (1, 5), (5, 6), (6, 7),
            (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13),
            (0, 14), (14, 16), (0, 15), (15, 17),
        ))
        self.assertEqual(COLORS, (
            (255, 0, 0), (255, 85, 0), (255, 170, 0), (255, 255, 0),
            (170, 255, 0), (85, 255, 0), (0, 255, 0), (0, 255, 85),
            (0, 255, 170), (0, 255, 255), (0, 170, 255), (0, 85, 255),
            (0, 0, 255), (85, 0, 255), (170, 0, 255), (255, 0, 255),
            (255, 0, 170), (255, 0, 85),
        ))
        self.assertEqual(len(KEYPOINT_NAMES), 18)
        self.assertEqual(tuple(range(18)), tuple(SIDE_SWAP[index] for index in SIDE_SWAP))

    def test_original_controlnet_annotator_order(self):
        # draw_bodypose limbSeq in lllyasviel/ControlNet/annotator/openpose/util.py.
        self.assertEqual(CONTROLNET_CONNECTIONS, (
            (1, 2), (1, 5), (2, 3), (3, 4), (5, 6), (6, 7),
            (1, 8), (8, 9), (9, 10), (1, 11), (11, 12), (12, 13),
            (1, 0), (0, 14), (14, 16), (0, 15), (15, 17),
        ))
        self.assertNotEqual(CONTROLNET_CONNECTIONS, CONNECTIONS)
        points, visible = animation_pose("walk_back", 0)
        image = render_controlnet_frame(points, visible)
        self.assertEqual(image.size, (90, 160))
        self.assertEqual(image.mode, "RGB")
        # No visible face landmarks means no invented gray head in model input.
        self.assertEqual(image.getpixel((45, 28)), (0, 0, 0))

    def test_turning_preserves_anatomical_labels(self):
        for frame in range(FRAME_COUNT):
            right, _ = animation_pose("walk_right", frame)
            left, _ = animation_pose("walk_left", frame)
            front, _ = animation_pose("walk_front", frame)
            back, visible = animation_pose("walk_back", frame)
            for index in range(18):
                self.assertAlmostEqual(left[index][0], FRAME_WIDTH - right[SIDE_SWAP[index]][0])
                self.assertAlmostEqual(left[index][1], right[SIDE_SWAP[index]][1])
                self.assertAlmostEqual(back[index][0], FRAME_WIDTH - front[index][0])
                self.assertAlmostEqual(back[index][1], front[index][1])
            # Anatomical right is screen left from the front, screen right
            # from the back; the near side switches across profile views.
            self.assertLess(front[2][0], front[5][0])
            self.assertGreater(back[2][0], back[5][0])
            self.assertGreater(right[2][0], right[5][0])
            self.assertLess(left[5][0], left[2][0])
            self.assertFalse(any(visible[index] for index in (0, 14, 15, 16, 17)))

    def test_hidden_face_serializes_as_zero_triplets(self):
        points, visible = animation_pose("walk_back", 0)
        data = pose_document(points, visible)["people"][0]["pose_keypoints_2d"]
        for index in (0, 14, 15, 16, 17):
            self.assertEqual(data[index * 3:index * 3 + 3], [0.0, 0.0, 0.0])


if __name__ == "__main__":
    unittest.main()
