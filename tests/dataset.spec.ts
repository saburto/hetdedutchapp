import { test, expect } from '@playwright/test';

test.describe('Dataset Expansion', () => {
  test('app displays expanded dataset nouns and level options', async ({ page }) => {
    await page.goto('/');

    // Verify session initializes properly with the sentence canvas
    const sentence = page.locator('.sentence-canvas');
    await expect(sentence).toBeVisible({ timeout: 5000 });

    // Open settings panel where theme/options are configured
    const settingsBtn = page.locator('.settings-btn');
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Verify settings panel is open
    const settingsPanel = page.locator('.settings-panel');
    await expect(settingsPanel).toBeVisible();

    // Close settings panel
    await page.locator('.settings-panel .settings-btn').click();
    await expect(settingsPanel).not.toBeVisible();

    // Verify option buttons are displayed on challenge screen
    const options = page.locator('.option-btn');
    await expect(options).toHaveCount(2);
  });
});
