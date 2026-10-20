# MediaPipe assets

The Hand Landmarker model is vendored so camera use only requests this app's own origin.

- Source: https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task
- Model: MediaPipe Hand Landmarker, float16, version 1 (7,819,105 bytes)
- SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`
- License: Apache-2.0; see [LICENSE](LICENSE).
- Model documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker

`npm ci`, `npm run dev`, and `npm run build` copy WASM files from the exactly pinned
`@mediapipe/tasks-vision` dependency into the ignored `wasm/` directory. Do not mix
loaders and binaries from different package versions. No model download is needed
at install time. To update the model, download the official versioned asset, review
its license, update this provenance and the checksum in `scripts/prepare-mediapipe.mjs`,
and rerun the camera browser tests.
