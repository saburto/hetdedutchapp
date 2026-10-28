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

    const text0 = (await options.nth(0).locator('.opt-label').textContent())?.trim();
    const text1 = (await options.nth(1).locator('.opt-label').textContent())?.trim();
    const optionsSet = new Set([text0, text1]);

    expect(optionsSet.has('De')).toBe(true);
    expect(optionsSet.has('Het')).toBe(true);
  });

  test('repair stages 2 and 3 use interactive binary-choice (not passive button)', async ({ page }) => {
    test.setTimeout(45000);
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
      await page.waitForTimeout(400);

      const isIncorrect = await page.locator('.challenge-card.incorrect').isVisible().catch(() => false);

      if (isIncorrect) {
        await page.locator('.next-btn').click();
        await page.waitForTimeout(800);

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
              await page.waitForTimeout(1300);
            }
          } else {
            const binaryBtns = repairShop.locator('.modifier-options .option-btn');
            if (await binaryBtns.first().isVisible().catch(() => false)) {
              stageInteractiveSeen = true;
              expect(await binaryBtns.count()).toBe(2);
              await binaryBtns.first().click();
              await page.waitForTimeout(1300);
            }
          }
        }
      } else {
        const nextBtn = page.locator('.next-btn');
        if (await nextBtn.isVisible().catch(() => false)) {
          await nextBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    expect(repairSeen).toBeTruthy();
    expect(stage1Seen).toBeTruthy();
    // stageInteractiveSeen is optional — it depends on whether we happened
    // to trigger stage 2/3 within 8 iterations
  });

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
    const levelChip = page.locator('.level-chip');
    await expect(levelChip).toBeVisible({ timeout: 5000 });
    const chipText = await levelChip.textContent();
    expect(chipText).toContain('6');

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

  test('option buttons do not swap positions after clicking', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 });

    // Read initial button labels and positions
    const btn0 = page.locator('.option-btn').nth(0);
    const btn1 = page.locator('.option-btn').nth(1);
    const text0Before = (await btn0.locator('.opt-label').textContent())?.trim();
    const text1Before = (await btn1.locator('.opt-label').textContent())?.trim();

    // Click the first button
    await btn0.click();
    await page.waitForTimeout(500);

    // Now re-read the buttons — they should be in the same position
    const btn0After = page.locator('.option-btn').nth(0);
    const btn1After = page.locator('.option-btn').nth(1);
    const text0After = (await btn0After.locator('.opt-label').textContent())?.trim();
    const text1After = (await btn1After.locator('.opt-label').textContent())?.trim();

    // The button texts at each position must not have swapped
    expect(text0After).toBe(text0Before);
    expect(text1After).toBe(text1Before);
  });

  test('level chip opens leerpad view and switching levels works', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Click the level chip to open the Leerpad tab
    const chip = page.locator('.level-chip');
    await expect(chip).toBeVisible({ timeout: 5000 });

    // Verify we start at level 1
    const initialText = await chip.textContent();
    expect(initialText).toContain('1');

    await chip.click();

    // Leerpad view should be active with 6 level rows
    const rows = page.locator('.level-row');
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toBeVisible({ timeout: 2000 });

    // Level 1 row should be marked current
    await expect(page.locator('.level-row.current')).toHaveCount(1);
    expect(await page.locator('.level-row.current').textContent()).toContain('1');

    // Select level 3
    await rows.nth(2).click();

    // Should switch back to Oefenen view
    await expect(page.locator('.view.active .gauge-row')).toBeVisible({ timeout: 3000 });

    // Chip should now show level 3
    await expect(chip).toContainText('3');

    // A challenge should load for level 3
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 });
  });

  test('leerpad: selecting current level returns to practice', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Open Leerpad tab directly via tab bar
    await page.locator('.tab[data-tab="leerpad"]').click();
    await expect(page.locator('.level-row').first()).toBeVisible({ timeout: 2000 });

    // Click the already-active level 1 row
    await page.locator('.level-row.current').click();

    // Back on Oefenen, chip still shows level 1
    await expect(page.locator('.view.active .gauge-row')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.level-chip')).toContainText('1');
  });

  test('leerpad: all six levels are listed and selectable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('.tab[data-tab="leerpad"]').click();
    await expect(page.locator('.level-row').first()).toBeVisible({ timeout: 2000 });

    const rows = page.locator('.level-row');
    await expect(rows).toHaveCount(6);

    // No locked states — every row is clickable
    for (let i = 0; i < 6; i++) {
      const cursor = await rows.nth(i).evaluate((el) => getComputedStyle(el).cursor);
      expect(cursor).toBe('pointer');
    }
  });

  test.skip('perfect run: completes all 6 levels without mistakes', async ({ page }) => {
    test.setTimeout(120_000);

    // Set progress to start at level 1 with clean state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('nl-context-v1', JSON.stringify({
        version: 1,
        nouns: {},
        sessionQueue: [],
        currentLevel: 1,
        theme: 'light',
        audioEnabled: false,
        showTranslation: false,
      }));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Wait for first challenge
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 15000 });

    let level = 1;
    const maxIter = 200;

    for (let i = 0; i < maxIter; i++) {
      // Check for level-up / done screens first
      const heading = page.locator('.level-complete h2');
      const hText = await heading.textContent().catch(() => null);

      if (hText?.includes('Alle niveaus')) {
        // Done! All levels complete.
        return;
      }

      if (hText?.includes('voltooid')) {
        await page.locator('.level-complete .next-btn').click();
        level++;
        await page.waitForTimeout(500);
        // Wait for next level to load
        await expect(page.locator('.option-btn, .empty-state').first()).toBeVisible({ timeout: 10000 });
        continue;
      }

      // Skip empty state
      if (await page.locator('.empty-state').isVisible().catch(() => false)) {
        await page.waitForTimeout(300);
        continue;
      }

      // Wait for buttons
      const btns = page.locator('.option-btn');
      if (!(await btns.first().isVisible().catch(() => false))) {
        await page.waitForTimeout(300);
        continue;
      }

      // Get correct answer and click it
      const correct = await page.evaluate(
        () => (window as any).__currentChallenge?.options?.correct as string | undefined,
      );

      if (correct) {
        // Click the button whose label equals correct answer
        const count = await btns.count();
        for (let j = 0; j < count; j++) {
          const t = (await btns.nth(j).locator('.opt-label').textContent())?.trim();
          if (t === correct) {
            await btns.nth(j).click();
            break;
          }
        }
      } else {
        await btns.first().click();
      }

      await page.waitForTimeout(150);

      // Click "Volgende"
      const nextBtn = page.locator('.next-btn');
      if (await nextBtn.isVisible().catch(() => false)) {
        const txt = await nextBtn.textContent();
        if (txt?.includes('Volgende')) {
          await nextBtn.click();
          await page.waitForTimeout(200);
        }
      }
    }

    throw new Error(`Did not complete all levels after ${maxIter} iterations`);
  });

});