import { describe, it, expect } from 'vitest';
import { validateData } from './backup';
import type { PracticeData } from '../types';

const valid = (): PracticeData => ({
  version: 1,
  weeklyGoal: 60,
  plan: [{ id: 'p1', day: 1, drillId: 'single-strokes', minutes: 5, bpm: 80 }],
  sessions: [
    {
      id: 's1',
      drillId: 'single-strokes',
      drillName: 'Single stroke roll',
      startedAt: '2026-10-19T01:00:00Z',
      seconds: 300,
      bpm: 80,
      endBpm: 80,
      completed: true,
      notes: 'Relaxed hands',
      timing: null,
      strokes: null,
    },
  ],
});

describe('backup validation', () => {
  it('accepts a complete backup and an empty initial state', () => {
    expect(validateData(valid())).toBe(true);
    expect(validateData({ version: 1, weeklyGoal: 60, plan: [], sessions: [] })).toBe(true);
  });
  it('accepts old sessions and a recorded compensation, while rejecting corrupt compensation', () => {
    const data = valid();
    expect(validateData(data)).toBe(true);
    data.sessions[0].latencyMs = 187;
    expect(validateData(data)).toBe(true);
    data.sessions[0].latencyMs = -201;
    expect(validateData(data)).toBe(false);
    data.sessions[0].latencyMs = Number.NaN;
    expect(validateData(data)).toBe(false);
  });
  it('preserves legacy motion counts and new MediaPipe stroke estimates', () => {
    const data = valid();
    data.sessions[0].strokes = { left: 12, right: 13 };
    expect(validateData(data)).toBe(true);
    data.sessions[0].strokeMethod = 'mediapipe';
    expect(validateData(data)).toBe(true);
    data.sessions[0].strokeMethod = 'unrecognized' as never;
    expect(validateData(data)).toBe(false);
  });
  it('rejects malformed sessions, dates, sensors, and invalid settings', () => {
    for (const data of [
      null,
      {},
      { ...valid(), version: 2 },
      { ...valid(), weeklyGoal: -1 },
      { ...valid(), sessions: [null] },
      { ...valid(), plan: [{ ...valid().plan[0], day: 7 }] },
    ])
      expect(validateData(data)).toBe(false);
    const badDate = valid();
    badDate.sessions[0].startedAt = 'yesterday';
    expect(validateData(badDate)).toBe(false);
    const badTiming = valid();
    badTiming.sessions[0].timing = {} as never;
    expect(validateData(badTiming)).toBe(false);
    const badCamera = valid();
    badCamera.sessions[0].strokes = { left: -2, right: 10 };
    expect(validateData(badCamera)).toBe(false);
  });
});
