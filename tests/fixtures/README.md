# Camera fixture

`thumb_up.jpg` is the MediaPipe Hand Landmarker test image from
https://storage.googleapis.com/mediapipe-assets/thumb_up.jpg.
SHA-256: `5d673c081ab13b8a1812269ff57047066f9c33c07db5f4178089e8cb3fdc0291`.

It is referenced by Google's Apache-2.0 MediaPipe hand landmarker tests:
https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/python/test/vision/hand_landmarker_test.py.
See ../../public/mediapipe/LICENSE. The original image's expected handedness is Right;
our worker mirrors input to match a selfie camera, so this fixture should return Left.
It establishes that the real model detects a hand, not that drumming counts are accurate.
