import { test, expect } from '@playwright/test';
import nounsRaw from '../data/nouns.json' with { type: 'json' };
import challengesRaw from '../data/challenges.json' with { type: 'json' };

test.describe('Dataset Expansion', () => {
  test('dataset contains expanded nouns and level challenges', async ({ page }) => {
    // Assert data counts
    expect(nounsRaw.nouns.length).toBe(100);
    expect(challengesRaw.challenges.length).toBe(334);

    // Verify level breakdown has expanded counts across all levels
    const byLevel: Record<number, number> = {};
    for (const c of challengesRaw.challenges) {
      byLevel[c.levelNumber] = (byLevel[c.levelNumber] || 0) + 1;
    }
    expect(byLevel[1]).toBe(108);
    expect(byLevel[2]).toBe(40);
    expect(byLevel[3]).toBe(50);
    expect(byLevel[4]).toBe(56);
    expect(byLevel[5]).toBe(40);
    expect(byLevel[6]).toBe(40);

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
