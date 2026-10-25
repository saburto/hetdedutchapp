import { test, expect } from '@playwright/test';

test('page has no horizontal scrollbar', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1280, height: 800 });

  const hasHorizontalScroll = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return html.scrollWidth > html.clientWidth ||
           body.scrollWidth > body.clientWidth;
  });

  expect(hasHorizontalScroll).toBe(false);
});

test('body does not have unwanted vertical scroll', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1280, height: 800 });

  const bodyOverflows = await page.evaluate(() => {
    return document.body.scrollHeight > document.body.clientHeight + 1;
  });

  expect(bodyOverflows).toBe(false);
});

test('footer is visible in the viewport', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1280, height: 800 });

  const footer = page.locator('.app-footer');
  await expect(footer).toBeVisible();

  const box = await footer.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(801);
});

test('footer links have correct hrefs', async ({ page }) => {
  await page.goto('/');

  const links = page.locator('.app-footer a');
  await expect(links).toHaveCount(2);

  await expect(links.nth(0)).toHaveAttribute('href', 'https://saburto.com');
  await expect(links.nth(1)).toHaveAttribute('href', 'https://github.com/saburto/hetdedutchapp');
});