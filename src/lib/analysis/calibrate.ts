import { ClickSound } from '../audio/click-sound';
import { Microphone } from './microphone';
import { estimateLatency, MAX_DELAY_SECONDS, PROBE_OFFSETS } from './latency';
import type { SavedCalibration } from './latency';

export interface CalibrationProgress {
  phase: 'connecting' | 'quiet' | 'clicks';
  played: number;
  detected: number;
  level: number;
}

/** Approximately ten seconds of acoustic loopback, independent of session history.
 * Scheduling and detection use the practice AudioContext's clock. Cleanup also runs
 * when permission arrives after cancellation or the browser suspends the context.
 */
export async function measureLatency(
  context: AudioContext,
  options: {
    volume: number;
    threshold: number;
    signal: AbortSignal;
    onProgress: (progress: CalibrationProgress) => void;
  },
): Promise<SavedCalibration> {
  const microphone = new Microphone();
  const clicks = new ClickSound(context);
  const hits: number[] = [];
  let interval: ReturnType<typeof setInterval> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let rejectPending: ((reason: Error) => void) | undefined;
  let level = 0;
  let started = false;
  const abortError = () => new DOMException('Calibration cancelled.', 'AbortError');
  const cleanup = () => {
    clearInterval(interval);
    clearTimeout(watchdog);
    clicks.stop();
    microphone.disconnect();
  };
  const cancel = () => {
    cleanup();
    rejectPending?.(abortError());
  };
  options.signal.addEventListener('abort', cancel, { once: true });
  try {
    options.signal.throwIfAborted();
    options.onProgress({ phase: 'connecting', played: 0, detected: 0, level: 0 });
    await context.resume();
    options.signal.throwIfAborted();
    await microphone.connect(
      context,
      (time) => {
        if (started) hits.push(time);
      },
      (value) => (level = value),
    );
    options.signal.throwIfAborted();
    microphone.setThreshold(options.threshold);
    const route = await microphone.getRoute(context);
    options.signal.throwIfAborted();
    const quietStart = context.currentTime + 0.3;
    const firstProbe = context.currentTime + 1.2;
    const probes = PROBE_OFFSETS.map((offset) => firstProbe + offset);
    const end = probes[probes.length - 1] + MAX_DELAY_SECONDS + 0.06;
    started = true;
    await new Promise<void>((resolve, reject) => {
      rejectPending = reject;
      let nextProbe = 0;
      interval = setInterval(() => {
        if (context.state !== 'running') {
          reject(new Error('Audio was interrupted. Keep this tab active and try again.'));
          return;
        }
        const now = context.currentTime;
        // Ignore device startup noise, then require a quiet baseline before playing.
        if (hits.some((hit) => hit >= quietStart && hit < firstProbe - 0.15)) {
          reject(
            new Error(
              'Sound was detected before the test clicks. Stop playing or talking, reduce background noise, or raise the detection threshold, then retry.',
            ),
          );
          return;
        }
        while (nextProbe < probes.length && probes[nextProbe] < now + 0.12) {
          if (probes[nextProbe] < now - 0.03) {
            reject(
              new Error('Click scheduling was interrupted. Keep this tab active and try again.'),
            );
            return;
          }
          clicks.play(probes[nextProbe], options.volume);
          nextProbe++;
        }
        options.onProgress({
          phase: now < firstProbe ? 'quiet' : 'clicks',
          played: probes.filter((time) => time <= now).length,
          detected: estimateLatency(
            probes.filter((time) => time <= now),
            hits,
          ).matched,
          level,
        });
        if (now >= end) resolve();
      }, 25);
      // Wall-clock guard covers contexts that stop advancing or a suspended tab.
      watchdog = setTimeout(
        () => reject(new Error('The test timed out. Keep this tab active and try again.')),
        15_000,
      );
    });
    options.signal.throwIfAborted();
    return {
      ...estimateLatency(probes, hits),
      measuredAt: new Date().toISOString(),
      threshold: options.threshold,
      route,
    };
  } finally {
    started = false;
    options.signal.removeEventListener('abort', cancel);
    cleanup();
  }
}
