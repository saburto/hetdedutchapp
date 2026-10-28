import type { ProgressStore } from '../../data/schema.ts';

const STORAGE_KEY = 'nl-context-v1';

const DEFAULT_PROGRESS: ProgressStore = {
  version: 3,
  nouns: {},
  sessionQueue: [],
  currentLevel: 1,
  theme: 'light',
  audioEnabled: true,
  showTranslation: true,
  totalCorrect: 0,
  totalWrong: 0,
  phrases: {},
};

/**
 * Migrate older progress payloads to the current schema.
 * v1 → v2: derive lifetime totals from per-noun correct/wrong counters.
 * v2 → v3: add the empty phrase-progress map.
 */
function migrate(raw: Record<string, unknown>): ProgressStore | null {
  const version = raw?.version;
  if (version === 3) return raw as ProgressStore;

  if (version === 2) {
    return {
      ...(raw as unknown as Omit<ProgressStore, 'version' | 'phrases'>),
      version: 3,
      phrases: {},
    };
  }

  if (version === 1) {
    const nouns = (raw.nouns ?? {}) as Record<
      string,
      { correct?: number; wrong?: number }
    >;
    let totalCorrect = 0;
    let totalWrong = 0;
    for (const n of Object.values(nouns)) {
      totalCorrect += n?.correct ?? 0;
      totalWrong += n?.wrong ?? 0;
    }
    return {
      ...(raw as unknown as Omit<ProgressStore, 'version' | 'totalCorrect' | 'totalWrong' | 'phrases'>),
      version: 3,
      totalCorrect,
      totalWrong,
      phrases: {},
    };
  }

  return null;
}

export function loadProgress(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_PROGRESS);
    const parsed = JSON.parse(raw);
    const migrated = migrate(parsed);
    if (!migrated) {
      localStorage.removeItem(STORAGE_KEY);
      return structuredClone(DEFAULT_PROGRESS);
    }
    if (migrated !== parsed) {
      saveProgress(migrated); // persist the migration immediately
    }
    return migrated;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return structuredClone(DEFAULT_PROGRESS);
  }
}

export function saveProgress(data: ProgressStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently fail
    console.warn('Could not save progress to localStorage');
  }
}

export function resetProgress(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportProgress(): string {
  const data = loadProgress();
  return JSON.stringify(data, null, 2);
}

export function importProgress(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    const migrated = migrate(parsed);
    if (!migrated) return false;
    saveProgress(migrated);
    return true;
  } catch {
    return false;
  }
}

export function updateTheme(theme: ProgressStore['theme']): void {
  const progress = loadProgress();
  progress.theme = theme;
  saveProgress(progress);
}

export function updateAudioEnabled(enabled: boolean): void {
  const progress = loadProgress();
  progress.audioEnabled = enabled;
  saveProgress(progress);
}

export function updateShowTranslation(show: boolean): void {
  const progress = loadProgress();
  progress.showTranslation = show;
  saveProgress(progress);
}

/** Record a lifetime answer (used by normal answers and repair attempts). */
export function recordAnswer(correct: boolean): void {
  const progress = loadProgress();
  if (correct) progress.totalCorrect++;
  else progress.totalWrong++;
  saveProgress(progress);
}

export { DEFAULT_PROGRESS };
