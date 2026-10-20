/** Data crossing the worker boundary. Coordinates match the mirrored preview. */
export type HandSide = 'left' | 'right';
export interface HandPoint {
  x: number;
  y: number;
  z: number;
}
export interface TrackedHand {
  side: HandSide;
  confidence: number;
  points: HandPoint[];
}
export interface HandFrame {
  hands: TrackedHand[];
  timestamp: number;
  processedFrames: number;
}
export type TrackingRequest =
  { type: 'load'; assetBase: string } | { type: 'frame'; image: ImageBitmap; timestamp: number };
export type TrackingReply =
  | { type: 'ready' }
  | { type: 'result'; hands: TrackedHand[]; timestamp: number }
  | { type: 'error'; message: string };

// MediaPipe's 21 landmark topology: wrist, then four joints per finger.
export const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
] as const;
