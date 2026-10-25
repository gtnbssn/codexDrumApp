import type { SavedCalibration } from '../analysis/latency';

const KEY = 'pocket.audio.v1';
interface AudioSettings {
  latencyMs: number;
  threshold: number;
  calibration: SavedCalibration | null;
}
const defaults = (): AudioSettings => ({ latencyMs: 0, threshold: 0.035, calibration: null });

function load(): AudioSettings {
  try {
    const saved = localStorage.getItem(KEY);
    if (!saved) return defaults();
    const value = JSON.parse(saved);
    if (
      !Number.isFinite(value.latencyMs) ||
      value.latencyMs < -200 ||
      value.latencyMs > 1000 ||
      !Number.isFinite(value.threshold) ||
      value.threshold < 0.005 ||
      value.threshold > 0.15
    )
      return defaults();
    const c = value.calibration;
    const validCalibration =
      c &&
      c.reliable === true &&
      Number.isFinite(c.latencyMs) &&
      c.latencyMs >= 0 &&
      c.latencyMs <= 850 &&
      Number.isFinite(c.jitterMs) &&
      c.jitterMs >= 0 &&
      c.jitterMs <= 15 &&
      Number.isFinite(c.consistent) &&
      c.consistent >= 6 &&
      c.consistent <= 8 &&
      c.total === 8 &&
      Number.isFinite(c.threshold) &&
      c.threshold >= 0.005 &&
      c.threshold <= 0.15 &&
      typeof c.measuredAt === 'string' &&
      Number.isFinite(Date.parse(c.measuredAt)) &&
      c.route &&
      typeof c.route.inputId === 'string' &&
      typeof c.route.inputLabel === 'string' &&
      typeof c.route.outputLabel === 'string' &&
      Number.isFinite(c.route.sampleRate) &&
      c.route.sampleRate > 0;
    return {
      latencyMs: value.latencyMs,
      threshold: value.threshold,
      calibration: validCalibration ? c : null,
    };
  } catch {
    return defaults();
  }
}

// Audio calibration is specific to this browser/device setup, so it is deliberately
// separate from portable session/plan backups.
export const audioSettings = $state({ ...load(), warning: '' });
function save() {
  try {
    const { latencyMs, threshold, calibration } = audioSettings;
    localStorage.setItem(KEY, JSON.stringify({ latencyMs, threshold, calibration }));
    audioSettings.warning = '';
  } catch {
    audioSettings.warning =
      'Compensation is active on this page, but browser storage could not save it.';
  }
}
/** A manual offset or a changed threshold cannot substitute for calibration. */
export function hasCalibration() {
  const calibration = audioSettings.calibration;
  return Boolean(
    calibration?.reliable &&
    calibration.latencyMs === audioSettings.latencyMs &&
    calibration.threshold === audioSettings.threshold,
  );
}
export function applyCalibration(result: SavedCalibration) {
  if (!result.reliable) return;
  audioSettings.latencyMs = result.latencyMs;
  audioSettings.threshold = result.threshold;
  audioSettings.calibration = result;
  save();
}

export function resetCalibration() {
  audioSettings.latencyMs = 0;
  audioSettings.calibration = null;
  save();
}
