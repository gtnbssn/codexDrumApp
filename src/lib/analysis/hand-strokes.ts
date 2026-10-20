import type { HandSide, TrackedHand } from './hand-tracking';

interface Motion {
  x: number;
  y: number;
  time: number;
  anchor: number;
  extreme: number;
  phase: 'lift' | 'down' | 'rebound';
  lastStroke: number;
}

/** A conservative movement estimate, not a drum-impact detector.
 * Each cycle needs a lift, a downstroke and a small rebound. Distances are in
 * palm lengths, so moving the camera closer does not change sensitivity much.
 */
export class HandStrokeEstimator {
  private motion = new Map<HandSide, Motion>();

  reset() {
    this.motion.clear();
  }

  update(hands: TrackedHand[], timestamp: number): HandSide[] {
    const strokes: HandSide[] = [];
    const visible = new Set<HandSide>();
    for (const hand of hands) {
      if (hand.confidence < 0.7 || hand.points.length !== 21 || visible.has(hand.side)) continue;
      const palm = [0, 5, 9, 13, 17].map((i) => hand.points[i]);
      const x = palm.reduce((sum, p) => sum + p.x, 0) / palm.length;
      const y = palm.reduce((sum, p) => sum + p.y, 0) / palm.length;
      const scale = Math.hypot(
        hand.points[0].x - hand.points[9].x,
        hand.points[0].y - hand.points[9].y,
      );
      if (![x, y, scale].every(Number.isFinite) || scale < 0.025) continue;
      visible.add(hand.side);
      const previous = this.motion.get(hand.side);
      // Acquisition, dropped tracking and large jumps start a fresh cycle.
      if (
        !previous ||
        timestamp - previous.time > 220 ||
        timestamp <= previous.time ||
        Math.hypot(x - previous.x, y - previous.y) > scale * 2
      ) {
        this.motion.set(hand.side, {
          x,
          y,
          time: timestamp,
          anchor: y,
          extreme: y,
          phase: 'lift',
          lastStroke: previous?.lastStroke ?? -Infinity,
        });
        continue;
      }
      const travel = scale * 0.4;
      const rebound = scale * 0.15;
      if (previous.phase === 'lift') {
        previous.anchor = Math.max(previous.anchor, y);
        if (previous.anchor - y >= travel) {
          previous.phase = 'down';
          previous.extreme = y;
        }
      } else if (previous.phase === 'down') {
        previous.extreme = Math.min(previous.extreme, y);
        if (y - previous.extreme >= travel) {
          previous.phase = 'rebound';
          previous.extreme = y;
        }
      } else {
        previous.extreme = Math.max(previous.extreme, y);
        if (previous.extreme - y >= rebound) {
          if (timestamp - previous.lastStroke >= 120) {
            strokes.push(hand.side);
            previous.lastStroke = timestamp;
          }
          previous.phase = 'lift';
          previous.anchor = previous.extreme;
        }
      }
      previous.x = x;
      previous.y = y;
      previous.time = timestamp;
    }
    for (const side of this.motion.keys()) {
      if (!visible.has(side)) this.motion.delete(side);
    }
    return strokes;
  }
}
