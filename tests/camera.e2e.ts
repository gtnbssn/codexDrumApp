import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const image = readFileSync(new URL('./fixtures/thumb_up.jpg', import.meta.url)).toString('base64');
declare global {
  interface Window {
    __camera: {
      streams: MediaStream[];
      workers: { terminated: boolean }[];
      requests: number;
      allowPermission: boolean;
      animate: boolean;
    };
  }
}

/** A real image through a real canvas MediaStream and real MediaPipe worker.
 * Translation verifies movement counting, not accuracy on actual drum strokes.
 */
async function installCamera(page: Page, delayedPermission = false, twoHands = false) {
  await page.addInitScript(
    ({ image, delayedPermission, twoHands }) => {
      const state = (window.__camera = {
        streams: [] as MediaStream[],
        workers: [] as { terminated: boolean }[],
        requests: 0,
        allowPermission: !delayedPermission,
        animate: false,
      });
      const NativeWorker = window.Worker;
      window.Worker = class extends NativeWorker {
        record = { terminated: false };
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          state.workers.push(this.record);
        }
        terminate() {
          this.record.terminated = true;
          super.terminate();
        }
      };
      navigator.mediaDevices.getUserMedia = async () => {
        state.requests++;
        const fixture = new Image();
        fixture.src = `data:image/jpeg;base64,${image}`;
        await fixture.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 640;
        const context = canvas.getContext('2d')!;
        const stream = canvas.captureStream(20);
        state.streams.push(stream);
        const draw = (time: number) => {
          context.fillStyle = '#fff';
          context.fillRect(0, 0, 640, 640);
          const offset = state.animate ? Math.sin(time / 180) * 55 : 0;
          if (twoHands) {
            context.drawImage(fixture, 15, 160, 270, 287);
            context.save();
            context.translate(640, 0);
            context.scale(-1, 1);
            context.drawImage(fixture, 15, 160, 270, 287);
            context.restore();
          } else context.drawImage(fixture, 130, 110 + offset, 382, 406);
          if (stream.getTracks().some((t) => t.readyState === 'live')) requestAnimationFrame(draw);
        };
        requestAnimationFrame(draw);
        while (!state.allowPermission) await new Promise((resolve) => setTimeout(resolve, 10));
        return stream;
      };
    },
    { image, delayedPermission, twoHands },
  );
}
async function openCamera(page: Page) {
  await page.goto('/');
  await page.getByRole('tab', { name: /Camera tracking/ }).click();
  await page.getByRole('button', { name: 'Enable camera' }).click();
}
async function expectReleased(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__camera.streams.every((s) =>
            s.getTracks().every((t) => t.readyState === 'ended'),
          ) && window.__camera.workers.every((w) => w.terminated),
      ),
    )
    .toBe(true);
}

test('real model detects a hand, counts movement, saves the method, and releases resources', async ({
  page,
}) => {
  test.setTimeout(30_000);
  const pageErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:5173') && !r.url().startsWith('data:'))
      externalRequests.push(r.url());
  });
  await installCamera(page);
  await openCamera(page);
  await expect(page.getByRole('button', { name: 'Disconnect camera' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator('.hand-overlay circle')).toHaveCount(21, { timeout: 10000 });
  await expect(page.getByRole('status')).toContainText('Tracking left');
  await expect(page.locator('.hand-counts')).toHaveText('Left hand 0 Right hand 0');
  await page.getByRole('checkbox', { name: '1-bar count-in' }).uncheck();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await page.evaluate(() => {
    window.__camera.animate = true;
  });
  await expect
    .poll(() => page.locator('.hand-counts strong').first().innerText(), { timeout: 12000 })
    .not.toBe('0');
  await expect(page.locator('.session-time strong')).not.toContainText('00:00');
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByRole('dialog')).toContainText('Estimated hand strokes');
  const session = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pocket.practice.v1')!).sessions[0],
  );
  expect(session.strokeMethod).toBe('mediapipe');
  expect(session.strokes.left).toBeGreaterThan(0);
  expect(session.strokes.right).toBe(0);
  await expectReleased(page);
  expect(await page.locator('video').evaluate((v: HTMLVideoElement) => v.srcObject)).toBeNull();
  expect(externalRequests).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('blank fake camera produces no hands and can disconnect and reconnect', async ({ page }) => {
  await installCamera(page);
  // Use Chromium's synthetic pattern for this test instead of the hand image.
  await page.addInitScript(() => {
    // A blank canvas proves that inference does not invent hands from no input.
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      canvas.getContext('2d')!.fillRect(0, 0, 640, 480);
      const stream = canvas.captureStream(20);
      window.__camera.streams.push(stream);
      return stream;
    };
  });
  await openCamera(page);
  await expect(page.getByRole('button', { name: 'Disconnect camera' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole('status')).toContainText('No hands detected', { timeout: 10000 });
  await expect(page.locator('.hand-overlay circle')).toHaveCount(0);
  await page.getByRole('button', { name: 'Disconnect camera' }).click();
  await expectReleased(page);
  await page.getByRole('button', { name: 'Enable camera' }).click();
  await expect(page.getByRole('button', { name: 'Disconnect camera' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: 'Practice plan', exact: true }).click();
  await expectReleased(page);
});

test('failed model loading releases the worker and offers a working retry', async ({ page }) => {
  await installCamera(page);
  await page.route('**/hand_landmarker.task', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  await openCamera(page);
  await expect(page.getByRole('alert').last()).toContainText('Hand tracking failed', {
    timeout: 10000,
  });
  await expectReleased(page);
  expect(await page.evaluate(() => window.__camera.requests)).toBe(0);
  await page.unroute('**/hand_landmarker.task');
  await page.getByRole('button', { name: 'Enable camera' }).click();
  await expect(page.locator('.hand-overlay circle')).toHaveCount(21, { timeout: 15000 });
});

test('cancelling model loading terminates the worker before camera permission', async ({
  page,
}) => {
  await installCamera(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/hand_landmarker.task', async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  await openCamera(page);
  await page.getByRole('button', { name: 'Cancel camera connection' }).click();
  await expectReleased(page);
  expect(await page.evaluate(() => window.__camera.requests)).toBe(0);
  await expect(page.getByRole('button', { name: 'Start practice' })).toBeEnabled();
  release();
});

test('late camera permission after cancellation stops every returned track', async ({ page }) => {
  await installCamera(page, true);
  await openCamera(page);
  await expect
    .poll(() => page.evaluate(() => window.__camera.requests), { timeout: 15000 })
    .toBe(1);
  await page.getByRole('button', { name: 'Cancel camera connection' }).click();
  await page.evaluate(() => {
    window.__camera.allowPermission = true;
  });
  await expectReleased(page);
  await expect(page.getByRole('button', { name: 'Enable camera' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('real model tracks both anatomical hands with separate landmark overlays', async ({
  page,
}) => {
  await installCamera(page, false, true);
  await openCamera(page);
  await expect(page.locator('.hand-overlay .left circle')).toHaveCount(21, { timeout: 15000 });
  await expect(page.locator('.hand-overlay .right circle')).toHaveCount(21);
});

test('camera interruption preserves partial counts and records an interruption note', async ({
  page,
}) => {
  await installCamera(page);
  await openCamera(page);
  await expect(page.getByRole('button', { name: 'Disconnect camera' })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('checkbox', { name: '1-bar count-in' }).uncheck();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.locator('.session-time strong')).not.toContainText('00:00');
  await page.evaluate(() => {
    const track = window.__camera.streams[0].getVideoTracks()[0];
    track.stop();
    track.dispatchEvent(new Event('ended'));
  });
  await expect(page.getByRole('alert').last()).toContainText('camera was disconnected');
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByRole('dialog')).toContainText('Estimated hand strokes');
  await expect(page.getByLabel('What did you notice?')).toHaveValue(
    /Camera tracking was interrupted/,
  );
  await expectReleased(page);
});

test('camera permission denial releases the loaded model and leaves practice available', async ({
  page,
}) => {
  await installCamera(page);
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
  });
  await openCamera(page);
  await expect(page.getByRole('alert').last()).toContainText('Permission was not granted', {
    timeout: 15000,
  });
  await expectReleased(page);
  await expect(page.getByRole('button', { name: 'Start practice' })).toBeEnabled();
});
