import type { PracticeData } from '../types';

function isTiming(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    ['score', 'matched', 'expected', 'extra', 'meanOffsetMs', 'meanErrorMs', 'consistencyMs'].every(
      (key) => typeof item[key] === 'number' && Number.isFinite(item[key]),
    ) &&
    Array.isArray(item.offsets) &&
    item.offsets.every((x) => typeof x === 'number' && Number.isFinite(x))
  );
}

// Imported backups are untrusted input. Validate before replacing existing data.
export function validateData(value: unknown): value is PracticeData {
  if (!value || typeof value !== 'object') return false;
  const data = value as PracticeData;
  return (
    data.version === 1 &&
    Number.isFinite(data.weeklyGoal) &&
    data.weeklyGoal >= 10 &&
    data.weeklyGoal <= 1000 &&
    Array.isArray(data.sessions) &&
    data.sessions.every(
      (s) =>
        s &&
        (s.latencyMs === undefined ||
          (Number.isFinite(s.latencyMs) && s.latencyMs >= -200 && s.latencyMs <= 1000)) &&
        typeof s.id === 'string' &&
        typeof s.drillId === 'string' &&
        typeof s.drillName === 'string' &&
        typeof s.startedAt === 'string' &&
        Number.isFinite(Date.parse(s.startedAt)) &&
        Number.isFinite(s.seconds) &&
        s.seconds >= 0 &&
        Number.isFinite(s.bpm) &&
        s.bpm >= 30 &&
        s.bpm <= 240 &&
        Number.isFinite(s.endBpm) &&
        s.endBpm >= 30 &&
        s.endBpm <= 240 &&
        typeof s.completed === 'boolean' &&
        typeof s.notes === 'string' &&
        isTiming(s.timing) &&
        (s.strokes === null ||
          (s.strokes &&
            Number.isFinite(s.strokes.left) &&
            s.strokes.left >= 0 &&
            Number.isFinite(s.strokes.right) &&
            s.strokes.right >= 0)),
    ) &&
    Array.isArray(data.plan) &&
    data.plan.every(
      (p) =>
        p &&
        typeof p.id === 'string' &&
        typeof p.drillId === 'string' &&
        Number.isInteger(p.day) &&
        p.day >= 0 &&
        p.day <= 6 &&
        Number.isFinite(p.minutes) &&
        p.minutes >= 1 &&
        p.minutes <= 60 &&
        Number.isFinite(p.bpm) &&
        p.bpm >= 30 &&
        p.bpm <= 240,
    )
  );
}
