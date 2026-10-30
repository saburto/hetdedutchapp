import { test, expect } from '@playwright/test';

const REPO_URL = 'https://github.com/saburto/hetdedutchapp';

test('footer shows git version and build date', async ({ page }) => {
  await page.goto('/');

  const version = page.locator('.footer-version');
  await expect(version).toBeVisible();
  // Either a real short SHA (optionally suffixed) or the 'dev' fallback
  await expect(version).toHaveText(/versie ([0-9a-f]{7,40}|dev)/);

  const build = page.locator('.footer-build');
  await expect(build).toBeVisible();
  // Dutch date format: dd-mm-yyyy
  await expect(build).toHaveText(/^\d{2}-\d{2}-\d{4}$/);
});

test('footer version links to the git commit', async ({ page }) => {
  await page.goto('/');

  const version = page.locator('a.footer-version');
  // In a git checkout the version is a link to the commit; outside one it is plain text
  if ((await version.count()) === 0) {
    test.skip(true, 'no git repository available for this build');
  }

  const href = await version.getAttribute('href');
  expect(href).toMatch(new RegExp(`^${REPO_URL}/commit/[0-9a-f]{7,40}$`));
  await expect(version).toHaveAttribute('target', '_blank');
});

test('footer mentions that the app is AI generated', async ({ page }) => {
  await page.goto('/');

  const aiNote = page.locator('.footer-ai');
  await expect(aiNote).toBeVisible();
  await expect(aiNote).toContainText('AI');
  await expect(aiNote).toContainText('gemaakt');

  // Small print: visually smaller than the regular footer links
  const aiSize = await aiNote.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const linkSize = await page
    .locator('.footer-row a')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(aiSize).toBeLessThan(linkSize);
});
