import { test, expect } from '@playwright/test';

test('phone touch supports invitation joining and Rules focus return', async ({ browser }) => {
  const host = await browser.newContext();
  const friend = await browser.newContext({ viewport: { width: 360, height: 800 }, hasTouch: true, isMobile: true });
  const hostPage = await host.newPage();
  const phone = await friend.newPage();
  try {
    await hostPage.goto('/');
    await hostPage.getByPlaceholder('What should friends call you?').fill('Nguyễn Huệ');
    await hostPage.getByRole('button', { name: /Create a table/ }).click();
    await expect(hostPage.locator('.lobby')).toBeVisible();
    await phone.goto(hostPage.url());
    await phone.getByPlaceholder('What should friends call you?').fill('Gemeinsamer Spieleabend');
    await phone.getByRole('button', { name: /Join table/ }).tap();
    await expect(phone.locator('.lobby')).toBeVisible();
    await expect(hostPage.getByText('Gemeinsamer Spieleabend', { exact: true })).toBeVisible();
    const rules = phone.getByRole('button', { name: 'How to play' });
    await rules.tap();
    const dialog = phone.getByRole('dialog', { name: 'Hearthlands field notes rules' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => Math.round(el.getBoundingClientRect().width))).toBe(360);
    await phone.getByRole('button', { name: 'Close rules' }).tap();
    await expect(dialog).not.toBeVisible();
    await expect(rules).toBeFocused();
    expect(await phone.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  } finally { await host.close(); await friend.close(); }
});

test('Rules remain usable in phone landscape with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 740, height: 360 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Hearthlands field notes rules' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(360);
  const navigation = page.getByRole('navigation', { name: 'Rules sections' });
  const last = navigation.getByRole('button').last();
  await last.click();
  await expect(last).toHaveAttribute('aria-current','location');
  await expect(page.getByRole('button', { name: 'Close rules' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
