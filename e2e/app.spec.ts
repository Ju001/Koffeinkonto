import { expect, test, type Page } from '@playwright/test';

const cup = (page: Page) => page.getByRole('button', { name: 'Drink a coffee' });
const left = (page: Page) => page.getByTestId('coffees-left');
const balance = (page: Page) => page.getByTestId('balance');

async function topUpPreset(page: Page, euros: number) {
  await page.getByRole('button', { name: 'Top up' }).click();
  await page.getByRole('button', { name: new RegExp(`^${euros}\\s?€$`) }).click();
  await page.getByRole('button', { name: /^Add / }).click();
}

async function topUpCustom(page: Page, text: string) {
  await page.getByRole('button', { name: 'Top up' }).click();
  await page.getByRole('dialog').getByTestId('amount-input').fill(text);
  await page.getByRole('button', { name: /^Add / }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(left(page)).toBeVisible();
});

test('tops up with a preset and shows coffees left', async ({ page }) => {
  await topUpPreset(page, 5);
  await expect(left(page)).toHaveText('25');
  await expect(balance(page)).toContainText('5,00');
  await expect(page.getByTestId('toast')).toContainText('Added');
});

test('tops up with a custom amount', async ({ page }) => {
  await topUpCustom(page, '7,50');
  await expect(balance(page)).toContainText('7,50');
  await expect(left(page)).toHaveText('37');
});

test('drinking decrements and persists across reload', async ({ page }) => {
  await topUpPreset(page, 5);
  await cup(page).click();
  await expect(left(page)).toHaveText('24');
  await page.reload();
  await expect(left(page)).toHaveText('24');
});

test('undo from the toast restores the count', async ({ page }) => {
  await topUpPreset(page, 5);
  await cup(page).click();
  await expect(left(page)).toHaveText('24');
  await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click();
  await expect(left(page)).toHaveText('25');
  await expect(page.getByTestId('toast')).toHaveCount(0);
});

test('two fast taps record two coffees', async ({ page }) => {
  await topUpPreset(page, 5);
  await Promise.all([cup(page).click(), cup(page).click()]);
  await expect(left(page)).toHaveText('23');
});

test('an empty balance goes negative and shows what is owed', async ({ page }) => {
  await cup(page).click();
  await expect(balance(page)).toHaveText(/Owed 0,20\s€/);
  await expect(left(page)).toHaveText('0');
});

test('invalid amounts keep the confirm button disabled', async ({ page }) => {
  await page.getByRole('button', { name: 'Top up' }).click();
  for (const bad of ['-5', '1,505', 'abc', '0']) {
    await page.getByRole('dialog').getByTestId('amount-input').fill(bad);
    await expect(page.getByRole('button', { name: 'Enter an amount' })).toBeDisabled();
  }
  await page.getByRole('dialog').getByTestId('amount-input').fill('2');
  await expect(page.getByRole('button', { name: /^Add / })).toBeEnabled();
});

test('a new price applies to future coffees only', async ({ page }) => {
  await topUpPreset(page, 5);
  await cup(page).click();
  await expect(balance(page)).toContainText('4,80');

  await page.getByTestId('price').click();
  await page.getByRole('dialog').getByTestId('amount-input').fill('0,25');
  await page.getByRole('button', { name: /^Set price to/ }).click();
  await expect(page.getByTestId('price')).toContainText('0,25');
  await expect(balance(page)).toContainText('4,80');

  await cup(page).click();
  await expect(balance(page)).toContainText('4,55');
});

test('last backup is never until exported', async ({ page }) => {
  await expect(page.getByTestId('last-backup')).toContainText('never');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  await download;
  await expect(page.getByTestId('last-backup')).toHaveText(/Last backup: (?!never)/);
});

test('Esc closes the sheet and returns focus to Top up', async ({ page }) => {
  const topUp = page.getByRole('button', { name: 'Top up' });
  await topUp.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(topUp).toBeFocused();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the steam stands still', async ({ page }) => {
    const name = await page
      .locator('.steam path')
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('none');
  });
});
