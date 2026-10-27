import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __loopback: {
      context: AudioContext;
      starts: number[];
      streams: MediaStream[];
      inputId: string;
    };
  }
}

/** Test-only acoustic loopback substitute: route the real output through a known
 * Web Audio delay into getUserMedia. The actual click synth and AudioWorklet run.
 * This proves the pipeline, not the accuracy of arbitrary physical hardware.
 */
async function installLoopback(page: Page, silent = false, permissionDelay = 0) {
  await page.addInitScript(
    ({ silent, permissionDelay }) => {
      const NativeAudioContext = window.AudioContext;
      const taps = new WeakMap<BaseAudioContext, DelayNode>();
      let input: MediaStreamAudioDestinationNode;
      const state = {
        context: null as unknown as AudioContext,
        starts: [] as number[],
        streams: [] as MediaStream[],
        inputId: 'test-loopback',
      };
      window.__loopback = state;
      window.AudioContext = class extends NativeAudioContext {
        constructor(options?: AudioContextOptions) {
          super(options);
          state.context = this;
          input = this.createMediaStreamDestination();
          const delay = this.createDelay(1);
          delay.delayTime.value = 0.18;
          delay.connect(input);
          taps.set(this, delay);
        }
      };
      const connect = AudioNode.prototype.connect;
      AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
        const result = Reflect.apply(connect, this, args);
        const tap = taps.get(this.context);
        if (!silent && args[0] === this.context.destination && tap)
          Reflect.apply(connect, this, [tap]);
        return result;
      } as typeof connect;
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (when = 0) {
        state.starts.push(when);
        return start.call(this, when);
      };
      navigator.mediaDevices.getUserMedia = async () => {
        if (permissionDelay) await new Promise((resolve) => setTimeout(resolve, permissionDelay));
        const stream = input.stream.clone();
        // A physical device has a stable per-origin deviceId across capture requests.
        // MediaStreamDestination creates a new synthetic ID per context instead.
        for (const track of stream.getAudioTracks()) {
          const getSettings = track.getSettings.bind(track);
          track.getSettings = () => ({ ...getSettings(), deviceId: state.inputId });
        }
        state.streams.push(stream);
        return stream;
      };
    },
    { silent, permissionDelay },
  );
}

test('loopback calibration measures, persists, and compensates a practice session', async ({
  page,
}) => {
  test.setTimeout(35_000);
  await installLoopback(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Calibrate latency', exact: true }).click();
  await page.getByRole('button', { name: 'Start calibration', exact: true }).click();
  const apply = page.getByRole('button', { name: /^Use \d+ ms$/ });
  await expect(apply).toBeVisible({ timeout: 15_000 });
  const measured = Number((await apply.innerText()).match(/\d+/)![0]);
  expect(measured).toBeGreaterThanOrEqual(165);
  expect(measured).toBeLessThanOrEqual(215); // Stream bridge adds a few processing quanta.
  expect(
    await page.evaluate(() =>
      window.__loopback.streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')),
    ),
  ).toBe(true);
  await apply.click();
  await expect(page.getByLabel('Latency compensation in milliseconds')).toHaveValue(
    String(measured),
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('pocket.practice.v1') || '{"sessions":[]}').sessions.length,
    ),
  ).toBe(0);
  await page.reload();
  await expect(page.getByLabel('Latency compensation in milliseconds')).toHaveValue(
    String(measured),
  );
  await page.getByRole('button', { name: 'Enable microphone' }).click();
  await expect(page.getByRole('button', { name: 'Disconnect microphone' })).toBeVisible();
  await page.getByRole('checkbox', { name: '1-bar count-in' }).uncheck();
  await page.evaluate(() => (window.__loopback.starts = []));
  await page.getByRole('button', { name: 'Start practice', exact: true }).click();
  // End just after a click, while that hit is still traveling through the input delay.
  await page.waitForFunction(() => {
    const { starts, context } = window.__loopback;
    const played = starts.filter((time) => time <= context.currentTime);
    const last = played.at(-1);
    return played.length >= 5 && last !== undefined && context.currentTime - last < 0.04;
  });
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByRole('dialog')).toContainText('Compensation:');
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pocket.practice.v1')!).sessions[0],
  );
  expect(saved.latencyMs).toBe(measured);
  expect(saved.timing.score).toBeGreaterThan(90);
  expect(saved.timing.matched).toBe(saved.timing.expected);
  expect(
    await page.evaluate(() =>
      window.__loopback.streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Back to the practice room' }).click();
  await page.evaluate(() => (window.__loopback.inputId = 'different-microphone'));
  await page.getByRole('button', { name: 'Enable microphone' }).click();
  await expect(page.getByRole('status')).toContainText('Compensation was reset to 0 ms');
  await expect(page.getByLabel('Latency compensation in milliseconds')).toHaveValue('0');
});

test('silence fails calibration and leaves the existing value untouched', async ({ page }) => {
  await installLoopback(page, true);
  await page.goto('/');
  await page.getByLabel('Latency compensation in milliseconds').fill('77');
  await page.getByRole('button', { name: 'Calibrate latency', exact: true }).click();
  await page.getByRole('button', { name: 'Start calibration', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Only 0/8 clicks', { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /^Use \d+ ms$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close calibration', exact: true }).click();
  await expect(page.getByLabel('Latency compensation in milliseconds')).toHaveValue('77');
  expect(
    await page.evaluate(() =>
      window.__loopback.streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')),
    ),
  ).toBe(true);
});

test('cancellation stops capture and prevents further scheduled test clicks', async ({ page }) => {
  await installLoopback(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Calibrate latency', exact: true }).click();
  await page.getByRole('button', { name: 'Start calibration', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('2/8 clicks played', { timeout: 5000 });
  await page.getByRole('button', { name: 'Cancel test', exact: true }).click();
  const count = await page.evaluate(() => window.__loopback.starts.length);
  await page.waitForTimeout(1400);
  expect(await page.evaluate(() => window.__loopback.starts.length)).toBe(count);
  expect(
    await page.evaluate(() =>
      window.__loopback.streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')),
    ),
  ).toBe(true);
  await expect(page.getByLabel('Latency compensation in milliseconds')).toHaveValue('0');
});

test('closing while microphone permission is pending cleans up a late stream', async ({ page }) => {
  await installLoopback(page, false, 650);
  await page.goto('/');
  await page.getByRole('button', { name: 'Calibrate latency', exact: true }).click();
  await page.getByRole('button', { name: 'Start calibration', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Connecting');
  await page.getByRole('button', { name: 'Close calibration', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__loopback.streams.length)).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__loopback.streams[0].getTracks().every((t) => t.readyState === 'ended'),
      ),
    )
    .toBe(true);
  expect(await page.evaluate(() => window.__loopback.starts.length)).toBe(0);
});

test('calibration permission errors allow retry without changing compensation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Calibrate latency', exact: true }).click();
  await page.getByRole('button', { name: 'Start calibration', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone permission was not granted');
  await expect(page.getByRole('button', { name: 'Retry calibration' })).toBeEnabled();
});
