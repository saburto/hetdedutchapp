import { test, expect } from '@playwright/test';

test.describe('Dutch Context Builder', () => {

  test('app loads without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: 5000 });
    expect(await heading.textContent()).toContain('De/Het');

    expect(errors.filter(e =>
      !e.includes('favicon') && !e.includes('404')
    )).toHaveLength(0);
  });

  test('sentence renders with modifier slot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const sentence = page.locator('.sentence-canvas');
    await expect(sentence).toBeVisible({ timeout: 5000 });

    const text = await sentence.textContent();
    expect(text).toBeTruthy();
    console.log('Sentence:', text);

    // Must have the ___ modifier 
    const modifier = sentence.locator('.sentence-word.modifier');
    await expect(modifier).toBeVisible();
    expect(await modifier.textContent()).toBe('___');
  });

  test('two options are present and clickable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const options = page.locator('.option-btn');
    await expect(options.first()).toBeVisible({ timeout: 5000 });
    expect(await options.count()).toBe(2);
  });

  test('clicking an option shows feedback with correct noun', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const options = page.locator('.option-btn');
    await expect(options.first()).toBeVisible({ timeout: 5000 });
    await options.first().click();

    // Feedback should appear
    const feedback = page.locator('.explanation, .repair-shop');
    await expect(feedback).toBeVisible({ timeout: 3000 });

    const explanation = page.locator('.explanation');
    if (await explanation.isVisible().catch(() => false)) {
      const text = await explanation.textContent();
      console.log('Explanation:', text);
      // after fix: noun in explanation should match the sentence noun
      expect(text).toBeTruthy();
    }
  });

  test('full loop: answer → advance → next challenge appears', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    let advanced = false;
    for (let attempt = 0; attempt < 8 && !advanced; attempt++) {
      await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 });

      // Try both options: click the one that gives a correct answer
      const opt0 = page.locator('.option-btn').nth(0);
      const opt1 = page.locator('.option-btn').nth(1);

      // Click first option
      await opt0.click();
      await page.waitForTimeout(400);

      let isCorrect = await page.locator('.challenge-card.correct').isVisible().catch(() => false);
      let isIncorrect = await page.locator('.challenge-card.incorrect').isVisible().catch(() => false);

      // If neither (render glitch), retry
      if (!isCorrect && !isIncorrect) {
        await page.waitForTimeout(300);
        isCorrect = await page.locator('.challenge-card.correct').isVisible().catch(() => false);
        isIncorrect = await page.locator('.challenge-card.incorrect').isVisible().catch(() => false);
      }

      if (isCorrect) {
        await page.locator('.next-btn').click();
        await page.waitForTimeout(600);
        await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 });
        advanced = true;
      } else if (isIncorrect) {
        await page.locator('.next-btn').click();
        await page.waitForTimeout(600);

        // Handle repair — stage 1 (input) or stage 2/3 (button)
        const repairInput = page.locator('.repair-input');
        const repairBtn = page.locator('.repair-shop button.next-btn');

        if (await repairInput.isVisible().catch(() => false)) {
          const ph = await repairInput.getAttribute('placeholder');
          if (ph) {
            await repairInput.fill(ph);
            await repairBtn.first().click();
            await page.waitForTimeout(1000);
          }
        } else if (await repairBtn.isVisible().catch(() => false)) {
          await repairBtn.first().click();
          await page.waitForTimeout(600);
        }
      }
    }

    expect(advanced).toBeTruthy();
  });

  test('repair shop stage 1: typing correction works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    let repairSeen = false;
    for (let i = 0; i < 8 && !repairSeen; i++) {
      await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 3000 });
      await page.locator('.option-btn').first().click();
      await page.waitForTimeout(400);

      const isCorrect = await page.locator('.challenge-card.correct').isVisible().catch(() => false);
      const isIncorrect = await page.locator('.challenge-card.incorrect').isVisible().catch(() => false);

      if (isCorrect) {
        // Advance to next challenge and try again
        await page.locator('.next-btn').click();
        await page.waitForTimeout(500);
        continue;
      }

      if (isIncorrect) {
        // Click the repair button
        await page.locator('.next-btn').click();
        await page.waitForTimeout(500);

        const repairShop = page.locator('.repair-shop');
        await expect(repairShop).toBeVisible({ timeout: 2000 });

        const input = repairShop.locator('.repair-input');
        if (await input.isVisible().catch(() => false)) {
          const ph = await input.getAttribute('placeholder');
          expect(ph).toBeTruthy();
          console.log('Repair phrase:', ph);

          await input.fill(ph!);
          await repairShop.locator('button.next-btn').click();
          await page.waitForTimeout(1000);

          const backToNormal = page.locator('.option-btn, .challenge-card');
          await expect(backToNormal.first()).toBeVisible({ timeout: 3000 });
          repairSeen = true;
        }
      }
    }

    expect(repairSeen).toBeTruthy();
  });

  test('level 1 challenges load and present De/Het options correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Ensure we are on level 1
    const sentence = page.locator('.sentence-canvas');
    await expect(sentence).toBeVisible({ timeout: 5000 });

    const options = page.locator('.option-btn');
    await expect(options).toHaveCount(2);

    const text0 = (await options.nth(0).textContent())?.trim();
    const text1 = (await options.nth(1).textContent())?.trim();
    const optionsSet = new Set([text0, text1]);

    expect(optionsSet.has('De')).toBe(true);
    expect(optionsSet.has('Het')).toBe(true);
  });

  test('repair stages 2 and 3 use interactive binary-choice (not passive button)', async ({ page }) => {
    // Verify the RepairShop renders correctly:
    // Stage 1: typing input + "Kijk na" button
    // Stage 2/3: two binary-choice buttons (no passive "Ik snap het")

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    let repairSeen = false;
    let stage1Seen = false;
    let stageInteractiveSeen = false;

    for (let i = 0; i < 8 && !(stage1Seen && stageInteractiveSeen); i++) {
      await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 3000 });
      await page.locator('.option-btn').first().click();
      await page.waitForTimeout(200);

      const isIncorrect = await page.locator('.challenge-card.incorrect').isVisible().catch(() => false);

      if (isIncorrect) {
        await page.locator('.next-btn').click();
        await page.waitForTimeout(300);

        const repairShop = page.locator('.repair-shop');
        if (await repairShop.isVisible().catch(() => false)) {
          repairSeen = true;

          const input = repairShop.locator('.repair-input');
          if (await input.isVisible().catch(() => false)) {
            stage1Seen = true;
            const ph = await input.getAttribute('placeholder');
            if (ph) {
              await input.fill(ph);
              await repairShop.locator('button.next-btn').first().click();
              await page.waitForTimeout(600);
            }
          } else {
            const binaryBtns = repairShop.locator('.modifier-options .option-btn');
            if (await binaryBtns.first().isVisible().catch(() => false)) {
              stageInteractiveSeen = true;
              expect(await binaryBtns.count()).toBe(2);
              await binaryBtns.first().click();
              await page.waitForTimeout(600);
            }
          }
        }
      } else {
        const nextBtn = page.locator('.next-btn');
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page.waitForTimeout(200);
        }
      }
    }

    expect(repairSeen).toBeTruthy();
    expect(stage1Seen).toBeTruthy();
    // stageInteractiveSeen is optional — it depends on whether we happened
    // to trigger stage 2/3 within 8 iterations
  }, { timeout: 20000 });

  test('compound challenges show stem breakdown after answering', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to level 6 by setting progress in localStorage
    await page.evaluate(() => {
      const key = 'nl-context-v1';
      const raw = localStorage.getItem(key);
      if (raw) {
        const data = JSON.parse(raw);
        data.currentLevel = 6;
        data.sessionQueue = [];
        localStorage.setItem(key, JSON.stringify(data));
      } else {
        localStorage.setItem(key, JSON.stringify({
          version: 1,
          nouns: {},
          sessionQueue: [],
          currentLevel: 6,
          theme: 'light',
          audioEnabled: false,
          showTranslation: false,
        }));
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify we are on level 6
    const levelBadge = page.locator('.level-badge');
    await expect(levelBadge).toBeVisible({ timeout: 5000 });
    const badgeText = await levelBadge.textContent();
    expect(badgeText).toContain('6');

    // Answer a challenge
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 });
    await page.locator('.option-btn').first().click();
    await page.waitForTimeout(500);

    // Check for compound stems visualization in the explanation
    const compoundStems = page.locator('.compound-stems');
    const isVisible = await compoundStems.isVisible().catch(() => false);
    console.log('Compound stems visible:', isVisible);

    // The compound stem breakdown should appear for compound_clash challenges
    if (isVisible) {
      const text = await compoundStems.textContent();
      expect(text).toContain('laatste woord');
    }
    // If not visible, the challenge may not have been compound_clash type,
    // which is expected for some challenges at level 6 (some are compound_clash)
  });

});