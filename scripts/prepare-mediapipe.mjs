// Keep the WASM loader and binary paired with our exact npm version. Runtime
// assets are served by our app; no camera data or requests go to a model CDN.
import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const model = await readFile(new URL('../public/mediapipe/hand_landmarker.task', import.meta.url));
const checksum = createHash('sha256').update(model).digest('hex');
if (checksum !== 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1') {
  throw new Error(
    'The vendored MediaPipe model checksum does not match. Restore it or review the model update.',
  );
}
const target = new URL('../public/mediapipe/wasm/', import.meta.url);
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
// The module worker uses the ES module loader; the classic loaders are unused.
for (const file of ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']) {
  await cp(
    new URL(`../node_modules/@mediapipe/tasks-vision/wasm/${file}`, import.meta.url),
    new URL(file, target),
  );
}
