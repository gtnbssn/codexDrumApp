import type { Page } from '@playwright/test';

/** Already-calibrated fixture for UI/permission tests. The loopback integration
 * test separately performs real measurement through the click synth/worklet.
 */
export async function seedCalibration(page: Page, inputId = '') {
  await page.addInitScript((inputId) => {
    const context = new AudioContext();
    const sampleRate = context.sampleRate;
    void context.close();
    localStorage.setItem(
      'pocket.audio.v1',
      JSON.stringify({
        latencyMs: 0,
        threshold: 0.035,
        calibration: {
          latencyMs: 0,
          jitterMs: 0,
          matched: 8,
          consistent: 8,
          total: 8,
          reliable: true,
          reason: '',
          measuredAt: new Date().toISOString(),
          threshold: 0.035,
          route: { inputId, inputLabel: '', outputLabel: '', sampleRate },
        },
      }),
    );
  }, inputId);
}
