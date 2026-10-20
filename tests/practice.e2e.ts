import { test, expect } from '@playwright/test';

test('practice controls, a saved session, notes, and persistence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Practice room', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Increase tempo by 5' }).click();
  await expect(page.locator('.bpm-number')).toHaveText('85');
  await page.getByRole('checkbox', { name: '1-bar count-in' }).uncheck();
  await page.getByRole('combobox', { name: 'Session duration' }).selectOption('1');
  await page.getByRole('button', { name: 'Start practice' }).click();
  await expect(page.getByRole('button', { name: 'End session' })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Tempo', exact: true })).toBeDisabled();
  await expect(page.locator('.beat-grid .current')).toHaveCount(1);
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('What did you notice?').fill('Felt even at 85.');
  await page.getByRole('button', { name: 'Save notes & view progress' }).click();
  await expect(
    page.locator('.history-row').filter({ hasText: 'Single stroke roll' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Expand Single stroke roll session' }).click();
  await expect(page.getByRole('textbox', { name: /Session notes/ })).toHaveValue(
    'Felt even at 85.',
  );
  expect(errors).toEqual([]);
});

test('library filters, drill instructions, and selection', async ({ page }) => {
  await page.goto('/#library');
  await page.getByRole('button', { name: 'Timing', exact: true }).click();
  await expect(page.locator('.library-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Explore drill' }).click();
  await expect(page.getByRole('dialog')).toContainText('The click disappears every fourth bar.');
  await page.getByRole('button', { name: 'Take it to the practice room' }).click();
  await expect(page.locator('.metronome-heading h2')).toHaveText('The disappearing click');
});

test('planner creates a custom duration and starts the configured drill', async ({ page }) => {
  await page.goto('/#planner');
  await page.getByRole('button', { name: 'Add a drill', exact: true }).first().click();
  await page.getByLabel('Duration (minutes)').fill('7');
  await page.getByLabel('Starting tempo (BPM)').fill('96');
  await page.getByRole('button', { name: 'Add to my week' }).click();
  await expect(page.locator('.day-drill')).toContainText('7 min · 96 BPM');
  await page.getByRole('button', { name: /Practice Single stroke roll on/ }).click();
  await expect(page.locator('.bpm-number')).toHaveText('96');
  await expect(page.getByRole('combobox', { name: 'Session duration' })).toHaveValue('7');
  await page.reload();
  await page.getByRole('button', { name: 'Practice plan', exact: true }).click();
  await expect(page.locator('.day-drill')).toHaveCount(1);
});

test('microphone worklet connects and saves a measured session', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable microphone' }).click();
  await expect(page.getByRole('button', { name: 'Disconnect microphone' })).toBeVisible();
  await page.getByRole('checkbox', { name: '1-bar count-in' }).uncheck();
  await page.getByRole('button', { name: 'Start practice' }).click();
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: 'End session' }).click();
  await expect(page.getByRole('dialog')).toContainText('Timing estimate');
  const sessions = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pocket.practice.v1')!).sessions,
  );
  expect(sessions[0].timing.expected).toBeGreaterThan(0);
  expect(sessions[0].timing).not.toBeNull();
  // A fake audio source validates the input pipeline, not real-world accuracy.
});

test('mobile layout has no horizontal overflow and navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'My progress', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No sessions yet' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('backup validation protects existing data and export produces a JSON file', async ({
  page,
}) => {
  await page.goto('/#progress');
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":1,"sessions":[null]}'),
  });
  await expect(page.getByRole('status')).toContainText('not a valid Pocket backup');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^pocket-backup-.*\.json$/);
});

test('restoring a valid backup and deleting a session both require confirmation', async ({
  page,
}) => {
  await page.goto('/#progress');
  const backup = {
    version: 1,
    weeklyGoal: 90,
    plan: [],
    sessions: [
      {
        id: 'restored',
        drillId: 'single-strokes',
        drillName: 'Single stroke roll',
        startedAt: new Date().toISOString(),
        seconds: 300,
        bpm: 80,
        endBpm: 80,
        completed: true,
        notes: 'Restored note',
        timing: null,
        strokes: null,
      },
    ],
  };
  await page.locator('input[type=file]').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole('dialog')).toContainText('Restore this backup?');
  await expect(page.locator('.history-row').filter({ hasText: 'Single stroke roll' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Replace with backup' }).click();
  await page.getByRole('button', { name: 'Expand Single stroke roll session' }).click();
  await expect(page.getByRole('textbox', { name: /Session notes/ })).toHaveValue('Restored note');
  await page.getByRole('button', { name: 'Delete session', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('.history-row').filter({ hasText: 'Single stroke roll' })).toHaveCount(
    1,
  );
  await page.getByRole('button', { name: 'Delete session', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Delete session', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'No sessions yet' })).toBeVisible();
});

test('permission denial explains the issue and keeps ordinary practice available', async ({
  browser,
}) => {
  const context = await browser.newContext({ permissions: [] });
  const page = await context.newPage();
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('Denied', 'NotAllowedError');
    };
  });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Enable microphone' }).click();
  await expect(page.getByRole('alert').first()).toContainText('Permission was not granted');
  await expect(page.getByRole('button', { name: 'Start practice' })).toBeEnabled();
  await context.close();
});

test('all screens and the sixteenth-note grid fit a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const screen of ['practice', 'library', 'progress', 'planner']) {
    await page.goto(`/#${screen}`);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto('/#library');
  await page.getByRole('button', { name: 'Coordination', exact: true }).click();
  await page.getByRole('button', { name: 'Explore drill' }).click();
  await page.getByRole('button', { name: 'Take it to the practice room' }).click();
  await expect(page.locator('.beat-grid>div')).toHaveCount(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
