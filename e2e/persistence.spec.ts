import { expect, test, type Page } from '@playwright/test';

const backup = {
  v: 1,
  priceCents: 25,
  updatedAt: 1,
  events: [{ id: 'a', ts: 1, type: 'topup', cents: 500 }],
};

async function importBackup(page: Page, content: string) {
  await page.getByTestId('import-input').setInputFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(content),
  });
}

test('restores the account from the mirror when localStorage is wiped', async ({ page }) => {
  await page.goto('/');
  await importBackup(page, JSON.stringify(backup));
  await expect(page.getByTestId('account-summary')).toContainText('0,25');
  await expect(page.getByTestId('account-summary')).toContainText('1 entries');

  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await expect(page.getByTestId('restore-notice')).toBeVisible();
  await expect(page.getByTestId('account-summary')).toContainText('0,25');
  const healed = await page.evaluate(() => localStorage.getItem('koffeinkonto.account'));
  expect(healed).not.toBeNull();
});

test('rejects an invalid backup without touching the stored account', async ({ page }) => {
  await page.goto('/');
  await importBackup(page, JSON.stringify(backup));
  await expect(page.getByTestId('account-summary')).toContainText('0,25');

  await importBackup(page, '{"v":2,"priceCents":-1}');
  await expect(page.getByTestId('import-error')).toBeVisible();
  await expect(page.getByTestId('account-summary')).toContainText('0,25');

  await page.reload();
  await expect(page.getByTestId('account-summary')).toContainText('0,25');
});

test('corrupt storage hides the empty summary and disables export', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('koffeinkonto.account', '{bad'));
  await page.goto('/');
  await expect(page.getByTestId('corrupt-notice')).toBeVisible();
  await expect(page.getByTestId('account-summary')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export backup' })).toBeDisabled();
});

test('reports storage protection status', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('storage-status')).toBeVisible();
});
