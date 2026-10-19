import { describe, expect, it } from 'vitest';
import { analyzeTiming, formatTime, localDay, weekDays } from './timing';
import { drills, tempoAtBar } from '../data/drills';

describe('timing analysis', () => {
  it('scores exact hits and preserves early / late offsets', () => {
    expect(analyzeTiming([0, 0.5, 1], [0, 0.5, 1]).score).toBe(100);
    const result = analyzeTiming([1, 2], [0.98, 2.04]);
    expect(result.meanOffsetMs).toBeCloseTo(10);
    expect(result.meanErrorMs).toBeCloseTo(30);
    expect(result.consistencyMs).toBeCloseTo(30);
  });
  it('never matches the same grid note twice and penalizes extras', () => {
    const result = analyzeTiming([1], [1, 1.01]);
    expect(result.matched).toBe(1);
    expect(result.extra).toBe(1);
    expect(result.score).toBe(50);
  });
  it('penalizes missed notes even when the played notes are perfect', () => {
    const result = analyzeTiming([1, 2, 3, 4], [1, 3]);
    expect(result.score).toBe(50);
    expect(result.matched).toBe(2);
  });
  it('rejects hits outside the matching window and handles no input', () => {
    expect(analyzeTiming([1, 2], [0.5, 2.5]).matched).toBe(0);
    expect(analyzeTiming([], []).score).toBe(0);
    expect(analyzeTiming([1], []).meanErrorMs).toBe(0);
  });
  it('handles input timestamps arriving out of order', () => {
    expect(analyzeTiming([1, 2, 3], [3, 1, 2]).score).toBe(100);
  });
});

describe('drill rules and display helpers', () => {
  it('raises the ladder only after four complete practice bars, with a cap', () => {
    const ladder = drills.find((drill) => drill.tempoLadder)!;
    expect(tempoAtBar(ladder, 60, 3)).toBe(60);
    expect(tempoAtBar(ladder, 60, 4)).toBe(64);
    expect(tempoAtBar(ladder, 238, 4)).toBe(240);
    expect(tempoAtBar(drills[0], 80, 50)).toBe(80);
  });
  it('keeps each pattern a complete four-beat bar', () => {
    for (const drill of drills) {
      expect(drill.sticking.length / drill.subdivision).toBe(4);
      expect(drill.accents.every((index) => index >= 0 && index < drill.sticking.length)).toBe(
        true,
      );
    }
  });
  it('builds Monday-to-Sunday weeks using local calendar dates', () => {
    const days = weekDays(new Date(2026, 9, 18, 12)); // Sunday
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0);
    expect(localDay(days[6])).toBe('2026-9-18');
  });
  it('formats elapsed time without negative displays', () => {
    expect(formatTime(125.8)).toBe('02:05');
    expect(formatTime(-1)).toBe('00:00');
  });
});
