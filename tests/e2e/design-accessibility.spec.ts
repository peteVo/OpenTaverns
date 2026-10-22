import { test, expect } from '@playwright/test';

test('home Rules keep readable controls from the entry panel and game shelf', async ({ page }) => {
  const games = ['hearthlands', 'saigon-grid', 'blackout', 'tidecall', 'werewolf', 'mosaic', 'wildways'];
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.getByPlaceholder('What should friends call you?').fill('Rules reader');
    for (const game of games) {
      await page.getByLabel('Choose a game').selectOption(game);
      for (const trigger of [page.locator('.entry-game-note > button'), page.locator(`.${game === 'hearthlands' ? 'hearth' : game === 'saigon-grid' ? 'grid' : game}-edition > .edition-rules`)]) {
        await trigger.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const contrast = await dialog.locator('nav button, .ot-rules-head button, .ot-rules-top').evaluateAll(buttons => {
          const luminance = (color: string) => {
            const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => {
              const channel = value / 255;
              return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
            });
            return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
          };
          return buttons.map(button => {
            let surface: Element | null = button;
            while (surface && getComputedStyle(surface).backgroundColor === 'rgba(0, 0, 0, 0)') surface = surface.parentElement;
            const foreground = luminance(getComputedStyle(button).color);
            const background = luminance(getComputedStyle(surface!).backgroundColor);
            return { text: button.textContent, ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) };
          });
        });
        for (const control of contrast) expect(control.ratio, `${game} ${width}px: ${control.text}`).toBeGreaterThanOrEqual(4.5);
        const section = dialog.locator('nav button').nth(1);
        await section.click();
        await expect(section).toHaveAttribute('aria-current', 'location');
        if (game === 'blackout' && await trigger.getAttribute('class') !== 'edition-rules') {
          await page.screenshot({ path: `test-results/home-blackout-rules-${width}.png` });
        }
        await dialog.getByRole('button', { name: 'Close rules' }).click();
        await expect(trigger).toBeFocused();
        expect(new URL(page.url()).pathname).toBe('/');
      }
    }
    await expect(page.getByPlaceholder('What should friends call you?')).toHaveValue('Rules reader');
  }
});

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
