import { expect, test, type Page } from '@playwright/test';

function luminance(rgb: string) {
  const [r, g, b] = rgb.match(/\d+/g)!.slice(0, 3).map((v) => {
    const c = Number(v) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

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

  test('the amount field and disabled confirm stay legible in the sheet', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Top up' }).click();
    const dialog = page.getByRole('dialog');
    const sheetBg = await dialog.evaluate((el) => getComputedStyle(el).backgroundColor);
    const border = await dialog
      .getByTestId('amount-input')
      .evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(contrast(border, sheetBg)).toBeGreaterThanOrEqual(3);

    const confirm = dialog.getByRole('button', { name: 'Enter an amount' });
    await expect(confirm).toBeDisabled();
    const [fg, bg, opacity] = await confirm.evaluate((el) => {
      const c = getComputedStyle(el);
      return [c.color, c.backgroundColor, c.opacity];
    });
    expect(opacity).toBe('1');
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  test('has a dark browser theme colour', async ({ page }) => {
    await page.goto('/');
    const content = await page
      .locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')
      .getAttribute('content');
    expect(content?.toLowerCase()).toBe('#1e1712');
  });
});
