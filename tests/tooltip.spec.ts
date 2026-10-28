import { test, expect } from '@playwright/test';

test('EN badge toggles inline translation on click', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.translation-badge');

  const badge = page.locator('.translation-badge').first();

  // Badge should exist and be visible
  await expect(badge).toBeVisible();

  // Translation line should not be in the DOM initially
  await expect(page.locator('.translation-inline')).toHaveCount(0);

  // Click the EN badge to show the translation
  await badge.click();
  await page.waitForTimeout(300);

  // Inline translation should now be visible
  const translation = page.locator('.translation-inline');
  await expect(translation).toBeVisible();
  const text = await translation.textContent();
  expect(text?.trim().length).toBeGreaterThan(0);

  // Badge gets the "on" state
  await expect(badge).toHaveClass(/on/);

  // Click again to hide
  await badge.click();
  await page.waitForTimeout(300);
  await expect(page.locator('.translation-inline')).toHaveCount(0);
});

test('translation has correct English text', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.translation-badge');

  await page.locator('.translation-badge').first().click();
  const translation = page.locator('.translation-inline');
  await expect(translation).toBeVisible();
  const text = (await translation.textContent()) ?? '';

  // All translations should be in English (Latin-only, no Dutch accented chars)
  expect(text).toMatch(/^[\u2014\sA-Za-z0-9.,!?'"+=()]+$/);

  // Should not contain Dutch modifiers like "Onze", "Ons", "Deze", "Dit"
  expect(text).not.toMatch(/\b(Onze|Ons|Deze|Dit|Die|Dat)\b/);
});

test('EN badge is hidden when showTranslation is off', async ({ page }) => {
  await page.goto('/');

  // Open settings and toggle translation off
  const settingsBtn = page.locator('button[title="Settings"]');
  await settingsBtn.click();
  await page.waitForTimeout(200);

  // Click the translation toggle button (should say "👁️ On" initially)
  const toggleBtn = page.locator('button').filter({ hasText: '👁️ On' });
  if (await toggleBtn.isVisible()) {
    await toggleBtn.click();
    await page.waitForTimeout(200);
  }

  // Close settings via the ✕ button
  const closeBtn = page.getByText('✕');
  await closeBtn.click();
  await page.waitForTimeout(300);

  // EN badge should not be present
  await expect(page.locator('.translation-badge')).toHaveCount(0);
});
