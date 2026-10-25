import type { ProgressStore } from '../../data/schema.ts';

const STORAGE_KEY = 'nl-context-v1';

const DEFAULT_PROGRESS: ProgressStore = {
  version: 1,
  nouns: {},
  sessionQueue: [],
  currentLevel: 1,
  theme: 'light',
  audioEnabled: true,
  showTranslation: true,
};

export function loadProgress(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_PROGRESS);
    const parsed = JSON.parse(raw);
    // Light validation: check version
    if (parsed?.version !== 1) {
      localStorage.removeItem(STORAGE_KEY);
      return structuredClone(DEFAULT_PROGRESS);
    }
    return parsed as ProgressStore;
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
    if (parsed?.version !== 1) return false;
    saveProgress(parsed as ProgressStore);
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

export { DEFAULT_PROGRESS };