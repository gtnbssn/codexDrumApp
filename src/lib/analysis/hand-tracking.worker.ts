import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { TrackedHand, TrackingRequest, TrackingReply } from './hand-tracking';

let landmarker: HandLandmarker | undefined;
const canvas = new OffscreenCanvas(480, 360);
const context = canvas.getContext('2d');
const reply = (message: TrackingReply) => self.postMessage(message);

// MediaPipe VIDEO inference is synchronous. Keep it off the UI/audio scheduler.
self.onmessage = async (event: MessageEvent<TrackingRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'load') {
      const files = await FilesetResolver.forVisionTasks(`${request.assetBase}/wasm`, true);
      landmarker = await HandLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: `${request.assetBase}/hand_landmarker.task`,
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.6,
        minHandPresenceConfidence: 0.6,
        minTrackingConfidence: 0.6,
        canvas: new OffscreenCanvas(1, 1),
      });
      reply({ type: 'ready' });
      return;
    }
    try {
      if (!landmarker || !context) throw new Error('Hand tracking is not ready.');
      canvas.width = request.image.width;
      canvas.height = request.image.height;
      // Handedness assumes selfie input. Mirror the pixels, not just the UI,
      // so Left/Right refer to the player's hands and overlay x needs no flip.
      context.setTransform(-1, 0, 0, 1, canvas.width, 0);
      context.drawImage(request.image, 0, 0);
      const result = landmarker.detectForVideo(canvas, request.timestamp);
      const hands: TrackedHand[] = [];
      result.landmarks.forEach((points, index) => {
        const category = result.handedness[index]?.[0];
        if (!category || category.score < 0.7) return;
        const side = category.categoryName.toLowerCase();
        if (side !== 'left' && side !== 'right') return;
        const hand = { side, confidence: category.score, points } as TrackedHand;
        const duplicate = hands.findIndex((other) => other.side === side);
        if (duplicate < 0) hands.push(hand);
        else if (hand.confidence > hands[duplicate].confidence) hands[duplicate] = hand;
      });
      reply({ type: 'result', hands, timestamp: request.timestamp });
    } finally {
      request.image.close();
    }
  } catch (error) {
    landmarker?.close();
    landmarker = undefined;
    reply({ type: 'error', message: error instanceof Error ? error.message : 'Inference failed.' });
  }
};
