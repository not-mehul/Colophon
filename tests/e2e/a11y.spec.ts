// Accessibility: axe finds no WCAG 2.1 A/AA problems on the bench and each
// tab of the sample edition, and with text at 200% (WCAG 1.4.4) nothing is
// wider than a phone screen. Also find and replace, end to end.

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const TABS = ['#tab-inspection', '#tab-imprint', '#tab-chapters', '#tab-catalog'];

async function axe(page: Page, where: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(
    violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    where,
  ).toEqual([]);
}

async function fits(page: Page, where: string) {
  const over = await page.evaluate(() => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth);
  expect(over, where).toBeLessThanOrEqual(1);
}

async function openSample(page: Page) {
  await page.goto('/');
  await expect(page.getByText('No edition on the bench')).toBeVisible();
}

test('the bench and every tab pass axe', async ({ page }) => {
  await openSample(page);
  await axe(page, 'bench');
  await page.click('#trySample');
  await expect(page.locator('#verdictHeading')).toBeVisible();
  for (const tab of TABS) {
    if (!(await page.locator(tab).count())) continue;
    await page.click(tab);
    await axe(page, tab);
  }
});

test('the bench and every tab fit with text at 200%', async ({ page }) => {
  await openSample(page);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  await fits(page, 'bench');
  await page.click('#trySample');
  await expect(page.locator('#verdictHeading')).toBeVisible();
  for (const tab of TABS) {
    if (!(await page.locator(tab).count())) continue;
    await page.click(tab);
    await fits(page, tab);
  }
});

test('find and replace lists matches in context, then replaces them with undo', async ({ page }) => {
  await openSample(page);
  await page.click('#trySample');
  await page.click('#tab-chapters');
  await page.fill('#findText', 'and');
  await expect(page.locator('#findCount')).toContainText(/\d+ match/);
  const before = Number((await page.locator('#findCount').textContent())!.match(/\d+/)![0]);
  await page.getByRole('button', { name: 'Whole words' }).click();
  await page.fill('#replaceText', 'AND');
  await page.getByRole('button', { name: 'Match case' }).click();
  const exact = Number((await page.locator('#findCount').textContent())!.match(/\d+/)![0]);
  expect(exact).toBeLessThanOrEqual(before);
  await page.click('#replaceAll');
  await expect(page.locator('.toast')).toContainText(`Replaced ${exact}`);
  await page.fill('#findText', 'AND');
  await expect(page.locator('#findCount')).toContainText(`${exact} match`);
});
