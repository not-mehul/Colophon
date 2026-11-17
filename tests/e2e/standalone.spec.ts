// The release is one HTML file that opens straight from disk. Load the built
// dist/index.html over file://, with every network request refused, and check
// it draws, keeps its fonts and works.

import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const built = fileURLToPath(new URL('../../dist/index.html', import.meta.url));

test('the build is one file with nothing left to fetch', () => {
  const html = readFileSync(built, 'utf8');
  // The document's own tags; the sample EPUB carries its own markup as strings in the script.
  const tags = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  expect(tags).not.toMatch(/<script[^>]+src=/);
  expect(tags).not.toMatch(/<link[^>]+rel="stylesheet"/);
  expect(html).toContain('data:font/woff2');
});

test('opened from disk, it works with the network off', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const fetched: string[] = [];
  await context.route(/^https?:/, (route) => {
    fetched.push(route.request().url());
    return route.abort();
  });

  await page.goto(pathToFileURL(built).href);
  await expect(page.getByText('No edition on the bench')).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check('1rem Fraunces'))).toBe(true);
  await page.click('#trySample');
  await expect(page.locator('#verdictHeading')).toBeVisible();
  await page.keyboard.press('Escape');

  expect(fetched).toEqual([]);
  expect(errors).toEqual([]);
});
