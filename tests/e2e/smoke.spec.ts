// Smoke test on a phone-sized viewport: open the sample, fix things from the
// ledger, edit the imprint, bind, and find the edition back on the bench.

import { expect, test } from '@playwright/test';

test('inspect, mend and bind the sample edition', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.getByText('No edition on the bench')).toBeVisible();
  await page.click('#trySample');
  await expect(page.locator('#verdictHeading')).toBeVisible();
  const before = Number((await page.locator('#barTitle + p').textContent())!.match(/\d+/)![0]);

  // One-tap fixes from the ledger, each with Undo.
  await page.getByRole('button', { name: 'Remove orphans' }).click();
  await expect(page.locator('.toast')).toContainText('orphan');
  await page.getByRole('button', { name: 'Declare language' }).click();

  // The imprint, with the publisher typed and the date picked.
  await page.click('#tab-imprint');
  await page.fill('#metaPublisher', 'Hairline Press');
  await page.fill('#metaDescription', 'A practical guide to the craft of building clean, accessible and well-ordered digital editions.');
  await page.click('#metaDate');
  await page.getByRole('radio', { name: 'Year' }).click();
  await page.getByRole('button', { name: '2025', exact: true }).click();
  await page.getByRole('button', { name: 'Choose', exact: true }).click();
  await expect(page.locator('#metaDate')).toHaveText('2025');

  // Number the chapter files so they sort in reading order.
  await page.click('#tab-chapters');
  await page.getByRole('button', { name: 'Number files' }).click();
  await page.click('#applyNumbering');
  await expect(page.locator('.sig-file').first()).toContainText('chapter_001');

  await page.click('#tab-inspection');
  const after = Number((await page.locator('#barTitle + p').textContent())!.match(/\d+/)![0]);
  expect(after).toBeGreaterThan(before);

  const download = page.waitForEvent('download');
  await page.click('#bindEpub');
  expect((await download).suggestedFilename()).toMatch(/Clara Vance - The Art of Digital Bookmaking \(2025\)\.epub$/);
  await expect(page.locator('#barTitle + p')).not.toContainText('to bind');

  // Back on the bench, the edition keeps its new score.
  await page.click('#backToBench');
  await expect(page.locator('.edition-card')).toHaveCount(1);
  await expect(page.locator('.edition-card')).toContainText(String(after));
  expect(errors).toEqual([]);
});
