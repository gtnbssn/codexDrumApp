import type { TimingResult } from '../types';

/** Match each hit to one unused grid note, within 150 ms by default.
 * Offsets are signed: negative = early, positive = late.
 * Accuracy counts missing notes and extra hits, not just the good matches.
 */
export function analyzeTiming(
  expected: number[],
  observed: number[],
  tolerance = 0.15,
): TimingResult {
  const used = new Set<number>();
  const offsets: number[] = [];
  for (const hit of [...observed].sort((a, b) => a - b)) {
    let best = -1;
    let distance = tolerance + Number.EPSILON;
    expected.forEach((beat, index) => {
      const delta = Math.abs(hit - beat);
      if (!used.has(index) && delta < distance) {
        best = index;
        distance = delta;
      }
    });
    if (best !== -1) {
      used.add(best);
      offsets.push((hit - expected[best]) * 1000);
    }
  }
  const matched = offsets.length;
  const extra = observed.length - matched;
  const meanOffsetMs = matched ? offsets.reduce((sum, x) => sum + x, 0) / matched : 0;
  const meanErrorMs = matched ? offsets.reduce((sum, x) => sum + Math.abs(x), 0) / matched : 0;
  const consistencyMs = matched
    ? Math.sqrt(offsets.reduce((sum, x) => sum + (x - meanOffsetMs) ** 2, 0) / matched)
    : 0;
  const quality = offsets.reduce(
    (sum, x) => sum + Math.max(0, 1 - Math.abs(x) / (tolerance * 1000)),
    0,
  );
  return {
    score: Math.round((100 * quality) / Math.max(1, expected.length + extra)),
    matched,
    expected: expected.length,
    extra,
    meanOffsetMs,
    meanErrorMs,
    consistencyMs,
    offsets,
  };
}

export function formatTime(seconds: number) {
  return `${Math.floor(Math.max(0, seconds) / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60)
    .toString()
    .padStart(2, '0')}`;
}

export const localDay = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function weekDays(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setDate(day.getDate() + index);
    return day;
  });
}
