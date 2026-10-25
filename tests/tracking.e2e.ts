import { test, expect } from '@playwright/test';
import { seedCalibration } from './helpers/calibration';

test('tracking switch sits above practice controls, announces headphones and switches capture off', async ({
  page,
}) => {
  await seedCalibration(page);
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    (window as unknown as { streams: MediaStream[] }).streams = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as unknown as { streams: MediaStream[] }).streams.push(stream);
      return stream;
    };
  });
  await page.goto('/');
  const tracking = page.getByRole('switch', { name: 'Microphone tracking' });
  const toggleBox = await tracking.boundingBox();
  const controlsBox = await page.getByRole('region', { name: 'Practice controls' }).boundingBox();
  expect(toggleBox!.y + toggleBox!.height).toBeLessThan(controlsBox!.y);
  await tracking.focus();
  await page.keyboard.press('Space');
  await expect(tracking).toBeChecked();
  await expect(page.getByRole('status', { name: 'Headphone reminder' })).toContainText(
    'Use headphones',
  );
  await page.setViewportSize({ width: 360, height: 780 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByText('Use headphones', { exact: true })).toBeVisible();
  await tracking.click();
  await expect(tracking).not.toBeChecked();
  await expect(page.getByText('Use headphones', { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      (window as unknown as { streams: MediaStream[] }).streams.every((s) =>
        s.getTracks().every((t) => t.readyState === 'ended'),
      ),
    ),
  ).toBe(true);
});

test('tracking is locked during practice and calibration remains required on a new browser', async ({
  page,
}) => {
  await page.goto('/');
  const tracking = page.getByRole('switch', { name: 'Microphone tracking' });
  await page.getByRole('checkbox', { name: '1-bar count-in' }).uncheck();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(tracking).toBeDisabled();
  await expect(tracking).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Calibrate latency', exact: true })).toBeDisabled();
});

test('a changed input while tracking is idle blocks tracked practice and releases capture', async ({
  page,
}) => {
  await seedCalibration(page, 'first-input');
  await page.addInitScript(() => {
    const state = { inputId: 'first-input', streams: [] as MediaStream[] };
    (window as unknown as { trackingTest: typeof state }).trackingTest = state;
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      for (const track of stream.getAudioTracks()) {
        const settings = track.getSettings.bind(track);
        track.getSettings = () => ({ ...settings(), deviceId: state.inputId });
      }
      state.streams.push(stream);
      return stream;
    };
  });
  await page.goto('/');
  const tracking = page.getByRole('switch', { name: 'Microphone tracking' });
  await tracking.click();
  await expect(tracking).toBeChecked();
  await page.evaluate(() => {
    (window as unknown as { trackingTest: { inputId: string } }).trackingTest.inputId =
      'changed-input';
  });
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(tracking).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Start practice' })).toBeEnabled();
  await expect(page.getByRole('status', { name: 'Tracking notice' })).toContainText(
    'Your audio setup changed',
  );
  expect(
    await page.evaluate(() =>
      (
        window as unknown as { trackingTest: { streams: MediaStream[] } }
      ).trackingTest.streams.every((s) => s.getTracks().every((t) => t.readyState === 'ended')),
    ),
  ).toBe(true);
});

test('leaving while tracking permission is pending stops a late microphone stream', async ({
  page,
}) => {
  await seedCalibration(page);
  await page.addInitScript(() => {
    const streams: MediaStream[] = [];
    (window as unknown as { pendingStreams: MediaStream[] }).pendingStreams = streams;
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const stream = await capture(constraints);
      streams.push(stream);
      return stream;
    };
  });
  await page.goto('/');
  await page.getByRole('switch', { name: 'Microphone tracking' }).click();
  await page.getByRole('button', { name: 'Practice plan', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { pendingStreams: MediaStream[] }).pendingStreams.length,
      ),
    )
    .toBe(1);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { pendingStreams: MediaStream[] }).pendingStreams[0]
          .getTracks()
          .every((t) => t.readyState === 'ended'),
      ),
    )
    .toBe(true);
});
