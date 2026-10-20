import { describe, expect, it } from 'vitest';
import { HandStrokeEstimator } from './hand-strokes';
import type { HandSide, TrackedHand } from './hand-tracking';

function hand(side: HandSide, y: number, x = 0.4, size = 0.1): TrackedHand {
  const points = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  points[0].y += size / 2;
  points[9].y -= size / 2;
  return { side, confidence: 0.95, points };
}
const cycle = [0.5, 0.44, 0.42, 0.47, 0.51, 0.48, 0.45, 0.42, 0.47, 0.51, 0.48];

describe('landmark stroke estimates', () => {
  it('counts one stroke per lift, downstroke and rebound for each anatomical hand', () => {
    const estimator = new HandStrokeEstimator();
    const strokes = cycle.flatMap((y, i) =>
      estimator.update([hand('left', y, 0.8), hand('right', y, 0.2)], i * 60),
    );
    expect(strokes).toEqual(['left', 'right', 'left', 'right']);
  });
  it('ignores stillness, small jitter, sideways travel and a downstroke without a lift', () => {
    for (const sequence of [
      [0.5, 0.501, 0.499, 0.503, 0.499, 0.501],
      [0.4, 0.45, 0.5, 0.55, 0.53],
    ]) {
      const estimator = new HandStrokeEstimator();
      expect(sequence.flatMap((y, i) => estimator.update([hand('left', y)], i * 60))).toEqual([]);
    }
    const estimator = new HandStrokeEstimator();
    expect(
      cycle.flatMap((_, i) => estimator.update([hand('left', 0.5, 0.2 + i * 0.01)], i * 60)),
    ).toEqual([]);
  });
  it('resets after loss, long gaps, identity jumps, low confidence, and session reset', () => {
    for (const interruption of ['lost', 'gap', 'jump', 'confidence', 'reset']) {
      const estimator = new HandStrokeEstimator();
      estimator.update([hand('left', 0.5)], 0);
      estimator.update([hand('left', 0.44)], 60);
      estimator.update([hand('left', 0.51)], 120);
      let time = 180;
      if (interruption === 'lost') estimator.update([], time);
      if (interruption === 'gap') time = 500;
      if (interruption === 'jump') estimator.update([hand('left', 0.51, 0.9)], time);
      if (interruption === 'confidence')
        estimator.update([{ ...hand('left', 0.51), confidence: 0.2 }], time);
      if (interruption === 'reset') estimator.reset();
      expect(estimator.update([hand('left', 0.48)], time + 60)).toEqual([]);
    }
  });
  it('scales travel by palm size and rejects duplicate/invalid detections', () => {
    const estimator = new HandStrokeEstimator();
    const strokes = cycle.flatMap((y, i) => {
      const small = hand('right', 0.5 + (y - 0.5) / 2, 0.4, 0.05);
      return estimator.update([small, small], i * 60);
    });
    expect(strokes).toEqual(['right', 'right']);
    expect(estimator.update([{ ...hand('left', 0.5), points: [] }], 800)).toEqual([]);
    expect(estimator.update([hand('left', Number.NaN)], 900)).toEqual([]);
  });
  it('limits rapid oscillation with a 120 ms per-hand refractory period', () => {
    const estimator = new HandStrokeEstimator();
    const rapid = Array.from({ length: 10 }, () => [0.5, 0.43, 0.51, 0.48]).flat();
    const strokes = rapid.flatMap((y, i) => estimator.update([hand('left', y)], i * 10));
    expect(strokes.length).toBeLessThanOrEqual(4);
    expect(strokes.length).toBeGreaterThan(0);
  });
});
