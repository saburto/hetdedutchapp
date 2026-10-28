import { test, expect } from '@playwright/test';

test.describe('Flow Tabs layout', () => {

  test('tab bar switches between the three views', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Start on Oefenen
    await expect(page.locator('.view.active .gauge-row')).toBeVisible({ timeout: 5000 });

    // Go to Leerpad
    await page.locator('.tab[data-tab="leerpad"]').click();
    await expect(page.locator('.level-row').first()).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.view.active .gauge-row')).toHaveCount(0);

    // Go to Voortgang
    await page.locator('.tab[data-tab="voortgang"]').click();
    await expect(page.locator('.stats-grid')).toBeVisible({ timeout: 2000 });
    await expect(page.locator('.mastery-list')).toBeVisible();

    // Back to Oefenen
    await page.locator('.tab[data-tab="oefenen"]').click();
    await expect(page.locator('.view.active .gauge-row')).toBeVisible({ timeout: 2000 });

    // Active tab state follows
    await expect(page.locator('.tab.active')).toHaveAttribute('data-tab', 'oefenen');
  });

  test('three circular gauges render with labels and values', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const gauges = page.locator('.gauge');
    await expect(gauges).toHaveCount(3);

    const names = await page.locator('.gauge-name').allTextContents();
    expect(names).toContain('Pogingen');
    expect(names).toContain('Naamwoorden');
    expect(names).toContain('Juist');

    // Each gauge has an SVG ring and an inner value
    for (let i = 0; i < 3; i++) {
      await expect(gauges.nth(i).locator('svg circle.gauge-fill')).toBeVisible();
      const inner = await gauges.nth(i).locator('.gauge-inner').textContent();
      expect(inner?.trim().length).toBeGreaterThan(0);
    }
  });

  test('shimmer level bar shows current level and progress', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const strip = page.locator('.level-strip');
    await expect(strip).toBeVisible();
    await expect(strip.locator('.level-strip-head')).toContainText('Niveau 1');
    // Progress bar track is present (fill may be 0% on a fresh session)
    await expect(strip.locator('.level-bar')).toBeVisible();
  });

  test('keyboard: pressing 1 answers, Enter advances to next card', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 });

    const firstCardKey = await page.evaluate(
      () => (window as any).__currentChallenge?.challengeId as string | undefined,
    );

    // Answer with keyboard
    await page.keyboard.press('1');
    await page.waitForTimeout(400);

    // Feedback appears (answered state)
    const answered = await page
      .locator('.challenge-card.correct, .challenge-card.incorrect')
      .isVisible()
      .catch(() => false);
    expect(answered).toBeTruthy();

    // If wrong answer → repair; handle by answering through the flow,
    // otherwise Enter advances to a new challenge.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(900);

    const repairVisible = await page.locator('.repair-shop').isVisible().catch(() => false);
    if (repairVisible) {
      // Repair flow is covered elsewhere; just verify we got there.
      await expect(page.locator('.repair-shop')).toBeVisible();
      return;
    }

    // New challenge should have loaded with a different id
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 });
    const secondCardKey = await page.evaluate(
      () => (window as any).__currentChallenge?.challengeId as string | undefined,
    );
    expect(secondCardKey).not.toBe(firstCardKey);
  });

  test('card animates: entering on load, leaving before next challenge', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const card = page.locator('.challenge-card');
    await expect(card).toBeVisible({ timeout: 5000 });

    // Entering class present on first mount
    await expect(card).toHaveClass(/entering/);

    // Answer and advance
    await page.locator('.option-btn').first().click();
    await page.waitForTimeout(400);

    const isCorrect = await page.locator('.challenge-card.correct').isVisible().catch(() => false);
    await page.locator('.next-btn').click();

    if (isCorrect) {
      // Leaving animation class applied briefly
      await expect(page.locator('.challenge-card.leaving')).toHaveCount(1);
      await page.waitForTimeout(600);
      // New card entered with entering class
      await expect(page.locator('.challenge-card.entering')).toHaveCount(1);
    }
  });

  test('theme button cycles light → dark → system → light', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const themeBtn = page.locator('button[title^="Thema:"]');
    await expect(themeBtn).toBeVisible();

    // Start light (fresh profile default)
    await expect(themeBtn).toHaveAttribute('title', 'Thema: Licht');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await themeBtn.click();
    await expect(themeBtn).toHaveAttribute('title', 'Thema: Donker');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await themeBtn.click();
    await expect(themeBtn).toHaveAttribute('title', 'Thema: Systeem');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');

    await themeBtn.click();
    await expect(themeBtn).toHaveAttribute('title', 'Thema: Licht');
  });

  test('voortgang shows lifetime stats and they persist after answering', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Voortgang view shows lifetime totals (0 by default)
    await page.locator('.tab[data-tab="voortgang"]').click();
    await expect(page.locator('.stats-grid')).toBeVisible();
    const beforeGood = parseInt(
      (await page.locator('.stat-card.g .num').textContent())?.trim() ?? '-1',
      10,
    );
    const beforeBad = parseInt(
      (await page.locator('.stat-card.f .num').textContent())?.trim() ?? '-1',
      10,
    );
    expect(beforeGood).toBeGreaterThanOrEqual(0);

    // Answer one challenge
    await page.locator('.tab[data-tab="oefenen"]').click();
    await page.locator('.option-btn').first().click();
    await page.waitForTimeout(400);

    const isCorrect = await page.locator('.challenge-card.correct').isVisible().catch(() => false);

    // Storage now written in v3 format
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('nl-context-v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(stored?.version).toBe(3);
    expect(stored.totalCorrect).toBe(beforeGood + (isCorrect ? 1 : 0));
    expect(stored.totalWrong).toBe(beforeBad + (isCorrect ? 0 : 1));

    // Voortgang reflects the new totals
    await page.locator('.tab[data-tab="voortgang"]').click();
    const goodAfter = parseInt(
      (await page.locator('.stat-card.g .num').textContent())?.trim() ?? '-1',
      10,
    );
    expect(goodAfter).toBe(stored.totalCorrect);
  });

  test('v1 progress store migrates to v3 with lifetime totals', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('nl-context-v1', JSON.stringify({
        version: 1,
        nouns: {
          noun_0001: {
            mastery: 0.5, correct: 7, wrong: 2,
            lastSeen: new Date().toISOString(), mistakeStage: 0,
          },
          noun_0002: {
            mastery: 0.9, correct: 3, wrong: 1,
            lastSeen: new Date().toISOString(), mistakeStage: 0,
          },
        },
        sessionQueue: [],
        currentLevel: 1,
        theme: 'light',
        audioEnabled: false,
        showTranslation: true,
      }));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    const data = await page.evaluate(() => {
      const raw = localStorage.getItem('nl-context-v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(data.version).toBe(3);
    expect(data.totalCorrect).toBe(10);
    expect(data.totalWrong).toBe(3);
    expect(data.phrases).toEqual({});

    // Voortgang shows migrated totals
    await page.locator('.tab[data-tab="voortgang"]').click();
    await expect(page.locator('.stat-card.g .num')).toContainText('10');
    await expect(page.locator('.stat-card.f .num')).toContainText('3');
  });

});
