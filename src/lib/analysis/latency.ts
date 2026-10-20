// Clicks are deliberately aperiodic and farther apart than the search window.
// This avoids matching a delayed click to the following beat/subdivision.
export const PROBE_OFFSETS = [0, 1.13, 2.39, 3.47, 4.78, 5.94, 7.19, 8.31];
export const MAX_DELAY_SECONDS = 0.85;
export const MIN_CONSISTENT_PROBES = 6;

export interface AudioRoute {
  inputId: string;
  inputLabel: string;
  outputLabel: string;
  sampleRate: number;
}

export interface LatencyEstimate {
  latencyMs: number;
  jitterMs: number;
  matched: number;
  consistent: number;
  total: number;
  reliable: boolean;
  reason: string;
}

export interface SavedCalibration extends LatencyEstimate {
  measuredAt: string;
  threshold: number;
  route: AudioRoute;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** First causal transient per isolated click; reject missing or inconsistent results. */
export function estimateLatency(probes: number[], hits: number[]): LatencyEstimate {
  const sortedHits = [...hits].filter(Number.isFinite).sort((a, b) => a - b);
  const used = new Set<number>();
  const delays: number[] = [];
  for (const probe of probes) {
    const index = sortedHits.findIndex(
      (hit, i) => !used.has(i) && hit >= probe && hit <= probe + MAX_DELAY_SECONDS,
    );
    if (index >= 0) {
      used.add(index);
      delays.push((sortedHits[index] - probe) * 1000);
    }
  }
  const middle = delays.length ? median(delays) : 0;
  // A few accidental noises/echoes can be rejected without shifting the estimate.
  const inliers = delays.filter((delay) => Math.abs(delay - middle) <= 20);
  const latencyMs = inliers.length ? median(inliers) : middle;
  const jitterMs = inliers.length
    ? Math.max(...inliers.map((delay) => Math.abs(delay - latencyMs)))
    : 0;
  const reliable = inliers.length >= MIN_CONSISTENT_PROBES && jitterMs <= 15;
  const reason = reliable
    ? ''
    : delays.length < MIN_CONSISTENT_PROBES
      ? `Only ${delays.length}/${probes.length} clicks were detected. Move the headphone cup closer to the microphone, raise the test volume, or lower the detection threshold.`
      : 'The delays were not repeatable. Keep the room quiet, avoid playing or talking, and try again. Wireless audio or device processing may be adding variable delay.';
  return {
    latencyMs: Math.round(latencyMs),
    jitterMs: Math.round(jitterMs),
    matched: delays.length,
    consistent: inliers.length,
    total: probes.length,
    reliable,
    reason,
  };
}

export function routeChanged(saved: AudioRoute, current: AudioRoute) {
  return (
    Boolean(saved.inputId && current.inputId && saved.inputId !== current.inputId) ||
    saved.sampleRate !== current.sampleRate ||
    Boolean(saved.outputLabel && current.outputLabel && saved.outputLabel !== current.outputLabel)
  );
}
