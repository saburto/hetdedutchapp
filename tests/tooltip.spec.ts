import { test, expect } from '@playwright/test';

test('EN translation badge toggles popover on click', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.translation-badge');

  const badge = page.locator('.translation-badge').first();
  const popover = page.locator('.translation-popover').first();

  // Badge and popover should exist in the DOM
  await expect(badge).toBeVisible();
  await expect(popover).toBeAttached();

  // Popover should have non-empty text
  const text = await popover.textContent();
  expect(text?.trim().length).toBeGreaterThan(0);

  // Initially hidden (opacity 0)
  const initialOpacity = await popover.evaluate(el =>
    window.getComputedStyle(el).opacity
  );
  expect(Number(initialOpacity)).toBe(0);

  // Click the EN badge to show the popover
  await badge.click();
  await page.waitForTimeout(300); // wait for CSS transition


  // Now it should be visible (opacity 1)
  const clickOpacity = await popover.evaluate(el =>
    window.getComputedStyle(el).opacity
  );
  expect(Number(clickOpacity)).toBe(1);

  // Click again to hide
  await badge.click();
  await page.waitForTimeout(300);
  const hiddenOpacity = await popover.evaluate(el =>
    window.getComputedStyle(el).opacity
  );
  expect(Number(hiddenOpacity)).toBe(0);

  // Verify popover appears above the badge
  const popoverBox = await popover.boundingBox();
  const badgeBox = await badge.boundingBox();
  expect(popoverBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();
  if (popoverBox && badgeBox) {
    expect(popoverBox.y + popoverBox.height).toBeLessThanOrEqual(badgeBox.y + 2);
  }
});

test('translation popover has correct English text', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('.translation-badge');

  const popover = page.locator('.translation-popover').first();
  const text = await popover.textContent();

  // All translations should be in English (Latin-only, no Dutch accented chars)
  expect(text).toMatch(/^[A-Za-z0-9\s.,!?'"+=()]+$/);

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