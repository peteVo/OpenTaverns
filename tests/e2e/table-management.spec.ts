import { test, expect } from '@playwright/test';

const key='e2e-only-key-abcdefghijklmnopqrstuvwxyz0123456789';
test('host register lists saved tables, confirms deletion and closes a live table',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/manage');await expect(page.getByRole('heading',{name:'Host access'})).toBeVisible();
  await page.getByLabel('Management key').fill('incorrect');await page.getByRole('button',{name:'Open the register →'}).click();await expect(page.getByRole('alert')).toContainText('incorrect');
  let code='';
  for(const gameId of ['hearthlands','saigon-grid','blackout','tidecall']){const response=await page.request.post('/api/tables',{data:{gameId,name:'A host with a long name'}});expect(response.ok()).toBe(true);code=(await response.json()).code;}
  await page.goto(`/manage#key=${key}`);await expect(page.locator('.management-register')).toBeVisible();expect(page.url()).not.toContain(key);const count=(await(await page.request.get('/api/admin/tables')).json()).tables.length;await expect(page.getByRole('heading',{name:`${count} saved tables`})).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:'test-results/management-desktop-final.png',fullPage:false});
  for(const width of [320,375,414,768]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`test-results/management-${width}-final.png`,fullPage:false});}
  const live=await context.newPage();await live.goto(`/t/${code}`);await expect(live.locator('.tc-lobby')).toBeVisible();
  await page.setViewportSize({width:375,height:844});const row=page.locator('.management-table').filter({hasText:code});await row.getByRole('button',{name:'Delete table'}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.screenshot({path:'test-results/management-delete-mobile-final.png',fullPage:false});await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(row).toBeVisible();
  await row.getByRole('button',{name:'Delete table'}).click();await page.getByRole('button',{name:`Delete ${code}`,exact:true}).click();await expect(page.getByRole('status')).toContainText(`${code} was deleted`);await expect(row).toHaveCount(0);await expect(live.getByRole('heading',{name:'This table has closed.'})).toBeVisible();await live.getByRole('button',{name:'Back to games →'}).click();await expect(live.locator('.home')).toBeVisible();
  await page.getByRole('button',{name:'Lock register'}).click();await expect(page.getByRole('heading',{name:'Host access'})).toBeVisible();expect((await page.request.get('/api/admin/tables')).status()).toBe(403);await page.getByLabel('Management key').focus();await page.screenshot({path:'test-results/management-login-mobile-final.png',fullPage:false});expect(errors).toEqual([]);
});
