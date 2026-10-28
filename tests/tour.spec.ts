import { test, expect } from '@playwright/test';

test.describe('Tour', () => {

  test('tour button opens the tour', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // The "?" tour button should be visible
    const tourBtn = page.locator('.tour-btn');
    await expect(tourBtn).toBeVisible({ timeout: 5000 });

    // Open the tour
    await tourBtn.click();

    // Tour tooltip should appear
    const tooltip = page.locator('.tour-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 3000 });

    // Backdrop should be present
    const backdrop = page.locator('.tour-backdrop');
    await expect(backdrop).toBeVisible();
  });

  test('tour navigates through steps', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open tour
    await page.locator('.tour-btn').click();
    await expect(page.locator('.tour-tooltip')).toBeVisible({ timeout: 3000 });

    // Check step counter shows "1 / 10"
    const counter = page.locator('.tour-step-counter');
    await expect(counter).toContainText('1 / 10');

    // First step should have "Welcome" title
    const title = page.locator('.tour-tooltip-title');
    await expect(title).toContainText('Welcome');

    // Click "Next" several times
    for (let i = 0; i < 9; i++) {
      await page.locator('.tour-nav-btn.tour-next').click();
      await page.waitForTimeout(400);
    }

    // Last step counter should be "10 / 10"
    await expect(counter).toContainText('10 / 10');

    // "Done" button should close the tour
    await page.locator('.tour-nav-btn.tour-next').click();
    await expect(page.locator('.tour-tooltip')).not.toBeVisible({ timeout: 2000 });
  });

  test('tour can be closed with X button', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('.tour-btn').click();
    await expect(page.locator('.tour-tooltip')).toBeVisible({ timeout: 3000 });

    // Click the close (X) button
    await page.locator('.tour-close-btn').click();
    await expect(page.locator('.tour-tooltip')).not.toBeVisible({ timeout: 2000 });
  });

  test('tour can be closed with backdrop click', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('.tour-btn').click();
    await expect(page.locator('.tour-tooltip')).toBeVisible({ timeout: 3000 });

    // Click backdrop
    await page.locator('.tour-backdrop').click({ position: { x: 10, y: 10 } });
    await expect(page.locator('.tour-tooltip')).not.toBeVisible({ timeout: 2000 });
  });

  test('tour can be closed with Escape key', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('.tour-btn').click();
    await expect(page.locator('.tour-tooltip')).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');
    await expect(page.locator('.tour-tooltip')).not.toBeVisible({ timeout: 2000 });
  });

  test('tour highlights target elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('.tour-btn').click();
    await expect(page.locator('.tour-tooltip')).toBeVisible({ timeout: 3000 });

    // Highlight should be visible
    const highlight = page.locator('.tour-highlight');
    await expect(highlight).toBeVisible({ timeout: 2000 });

    // Navigate to step 3 (settings btn target)
    await page.locator('.tour-nav-btn.tour-next').click(); // step 2
    await page.waitForTimeout(400);
    await page.locator('.tour-nav-btn.tour-next').click(); // step 3
    await page.waitForTimeout(400);

    // Step 3 targets settings-btn, so highlight should still be visible
    await expect(highlight).toBeVisible({ timeout: 2000 });
  });

});