import { test, expect } from '@playwright/test';

/** Seed localStorage before the app boots. */
function seedProgress(
  page: import('@playwright/test').Page,
  currentLevel: number,
  audioEnabled = false,
) {
  return page.addInitScript(({ level, audio }) => {
    localStorage.setItem(
      'nl-context-v1',
      JSON.stringify({
        version: 3,
        nouns: {},
        sessionQueue: [],
        currentLevel: level,
        theme: 'light',
        audioEnabled: audio,
        showTranslation: true,
        totalCorrect: 0,
        totalWrong: 0,
        phrases: {},
      }),
    );
  }, { level: currentLevel, audio: audioEnabled });
}

/** Install a fake speech synthesiser that records every utterance. */
function stubSpeechSynthesis(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    const spoken: string[] = [];
    (window as unknown as Record<string, unknown>).__spoken = spoken;

    class FakeUtterance {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      constructor(text: string) {
        this.text = text;
      }
    }

    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: FakeUtterance,
      configurable: true,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak: (u: { text: string }) => { spoken.push(u.text); },
        cancel: () => {},
        getVoices: () => [],
      },
      configurable: true,
    });
  });
}

/** Install a fake SpeechRecognition that we can drive from the test. */
function stubSpeechRecognition(page: import('@playwright/test').Page) {
  return page.addInitScript(() => {
    const instances: Array<Record<string, unknown>> = [];
    (window as unknown as Record<string, unknown>).__recInstances = instances;

    function MockRecognition(this: Record<string, unknown>) {
      this.lang = '';
      this.continuous = false;
      this.interimResults = false;
      this.maxAlternatives = 0;
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      instances.push(this);
    }
    MockRecognition.prototype.start = function () {
      if (this.onstart) (this.onstart as () => void)();
    };
    MockRecognition.prototype.stop = function () {
      const rec = this;
      setTimeout(() => {
        if (rec.onend) (rec.onend as () => void)();
      }, 0);
    };
    MockRecognition.prototype.abort = function () {
      if (this.onend) (this.onend as () => void)();
    };

    (window as unknown as Record<string, unknown>).SpeechRecognition = MockRecognition;
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = MockRecognition;
  });
}

test.describe('Absurd phrase trainer (Level 7)', () => {

  test('level 7 is listed in leerpad and opens the phrase trainer', async ({ page }) => {
    await seedProgress(page, 1);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.locator('.tab[data-tab="leerpad"]').click();
    await expect(page.locator('.level-row').first()).toBeVisible({ timeout: 2000 });

    const rows = page.locator('.level-row');
    await expect(rows).toHaveCount(7);

    // Open level 7 (last row)
    await rows.nth(6).click();

    await expect(page.locator('.phrase-screen')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.phrase-counter')).toContainText('1 / 15');
    await expect(page.locator('.level-chip')).toContainText('7');
  });

  test('phrase reveals word by word and shows controls', async ({ page }) => {
    await seedProgress(page, 7);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const screen = page.locator('.phrase-screen');
    await expect(screen).toBeVisible({ timeout: 3000 });

    // First word is visible immediately, rest are hidden
    await expect(page.locator('.phrase-word')).toHaveCount(1);

    const fullText = await page.locator('.phrase-canvas').getAttribute('aria-label');
    expect(fullText).toBeTruthy();
    const totalWords = (fullText ?? '').split(' ').length;
    expect(totalWords).toBeGreaterThan(3);

    // Skip the reveal animation
    await page.locator('.phrase-btn.ghost').click();
    await expect(page.locator('.phrase-word')).toHaveCount(totalWords);

    // Ready controls appear
    await expect(page.locator('.phrase-btn').filter({ hasText: 'Opnemen' })).toBeVisible();
    await expect(page.locator('.phrase-btn').filter({ hasText: 'Luister' })).toBeVisible();

    // English translation shows once the phrase is revealed
    await expect(page.locator('.translation-inline')).toBeVisible();
  });

  test('every revealed word is read aloud, then the full phrase', async ({ page }) => {
    test.slow();
    await seedProgress(page, 7, true);
    await stubSpeechSynthesis(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const screen = page.locator('.phrase-screen');
    await expect(screen).toBeVisible({ timeout: 3000 });

    const fullText = (await page.locator('.phrase-canvas').getAttribute('aria-label')) ?? '';
    const words = fullText.split(' ');
    expect(words.length).toBeGreaterThan(3);

    // While the reveal is running, the words are spoken one by one in order.
    const spoken = () =>
      page.evaluate(() =>
        (window as unknown as { __spoken?: string[] }).__spoken ?? [],
      );
    await expect.poll(async () => {
      const list = await spoken();
      return list.length >= 2 && list.every((w, i) => w === words[i]);
    }, { timeout: 5000 }).toBe(true);

    // When the phrase completes, the whole sentence is read after the words.
    await expect(page.locator('.phrase-btn').filter({ hasText: 'Opnemen' }))
      .toBeVisible({ timeout: 12_000 });
    expect(await spoken()).toEqual([...words.slice(0, -1), fullText]);
  });

  test('recording a perfect phrase shows a perfect score', async ({ page }) => {
    await seedProgress(page, 7);
    await stubSpeechRecognition(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.phrase-screen')).toBeVisible({ timeout: 3000 });
    await page.locator('.phrase-btn.ghost').click(); // reveal all
    await expect(page.locator('.phrase-btn').filter({ hasText: 'Opnemen' })).toBeVisible();

    const fullText = (await page.locator('.phrase-canvas').getAttribute('aria-label')) ?? '';
    expect(fullText.length).toBeGreaterThan(0);

    await page.locator('.phrase-btn').filter({ hasText: 'Opnemen' }).click();
    await expect(page.locator('.phrase-transcript')).toBeVisible();

    // Drive the fake recognizer with a perfect transcript
    await page.evaluate((text) => {
      const instances = (window as unknown as { __recInstances: Array<{
        onresult: ((e: unknown) => void) | null;
      }> }).__recInstances;
      const rec = instances[0];
      rec.onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: text } }],
      });
    }, fullText);

    await expect(page.locator('.phrase-result-score')).toContainText('Perfect', { timeout: 3000 });
    await expect(page.locator('.phrase-word.target.correct').first()).toBeVisible();
  });

  test('wrong articles are marked and can be retried', async ({ page }) => {
    await seedProgress(page, 7);
    await stubSpeechRecognition(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('.phrase-screen')).toBeVisible({ timeout: 3000 });
    await page.locator('.phrase-btn.ghost').click();
    await expect(page.locator('.phrase-btn').filter({ hasText: 'Opnemen' })).toBeVisible();

    const fullText = (await page.locator('.phrase-canvas').getAttribute('aria-label')) ?? '';

    // Swap de<->het so every target article is wrong
    const wrongText = fullText
      .replace(/\bhet\b/gi, 'DE_TEMP')
      .replace(/\bde\b/gi, 'het')
      .replace(/DE_TEMP/g, 'de');

    await page.locator('.phrase-btn').filter({ hasText: 'Opnemen' }).click();
    await page.evaluate((text) => {
      const instances = (window as unknown as { __recInstances: Array<{
        onresult: ((e: unknown) => void) | null;
      }> }).__recInstances;
      instances[0].onresult?.({
        resultIndex: 0,
        results: [{ isFinal: true, 0: { transcript: text } }],
      });
    }, wrongText);

    await expect(page.locator('.phrase-result-score')).toContainText('van de', { timeout: 3000 });
    await expect(page.locator('.phrase-word.target.wrong').first()).toBeVisible();

    // Retry the same phrase
    await page.locator('.phrase-btn').filter({ hasText: 'Opnieuw' }).click();
    await expect(page.locator('.phrase-btn').filter({ hasText: 'Opnemen' })).toBeVisible();
    await expect(page.locator('.phrase-word.target.wrong')).toHaveCount(0);
  });

});
