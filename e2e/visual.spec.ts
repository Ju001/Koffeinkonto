import { expect, test, type Page } from '@playwright/test';

const color = (page: Page, selector: string, prop: 'color' | 'backgroundColor') =>
  page.locator(selector).first().evaluate((el, p) => getComputedStyle(el)[p], prop);

test.describe('light theme', () => {
  test.use({ colorScheme: 'light' });

  test('uses the porcelain palette and Bricolage Grotesque', async ({ page }) => {
    await page.goto('/');
    expect(await color(page, 'body', 'backgroundColor')).toBe('rgb(243, 237, 226)');
    expect(await color(page, '[data-testid=coffees-left]', 'color')).toBe('rgb(31, 94, 75)');
    const family = await page.locator('body').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toMatch(/^"?Bricolage Grotesque/);
    await expect
      .poll(() => page.evaluate(() => document.fonts.check('800 96px "Bricolage Grotesque Variable"')))
      .toBe(true);
  });

  test('shows the mockup layout: one balance line and the tap hint', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Tap the cup to drink one')).toBeVisible();
    await expect(page.getByTestId('balance-line')).toHaveText(/^coffees left · 0,00\s€$/);
  });
});

test.describe('espresso dark theme', () => {
  test.use({ colorScheme: 'dark' });

  test('uses the espresso palette', async ({ page }) => {
    await page.goto('/');
    expect(await color(page, 'body', 'backgroundColor')).toBe('rgb(30, 23, 18)');
    expect(await color(page, '[data-testid=coffees-left]', 'color')).toBe('rgb(233, 184, 114)');
    await expect(page.getByRole('button', { name: 'Drink a coffee' })).toBeVisible();
  });

  test('has a dark browser theme colour', async ({ page }) => {
    await page.goto('/');
    const content = await page
      .locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')
      .getAttribute('content');
    expect(content?.toLowerCase()).toBe('#1e1712');
  });
});
