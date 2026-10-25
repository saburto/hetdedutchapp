import { useState } from 'react';
import {
  loadProgress,
  updateTheme,
  updateAudioEnabled,
  updateShowTranslation,
  exportProgress,
  importProgress,
  resetProgress,
} from '../engine/progress.ts';
import { hasDutchVoice } from '../audio/audio.ts';

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const prog = loadProgress();
  const [theme, setTheme] = useState(prog.theme);
  const [audio, setAudio] = useState(prog.audioEnabled);
  const [showTranslation, setShowTranslation] = useState(prog.showTranslation);
  const [importMsg, setImportMsg] = useState('');
  const hasVoice = hasDutchVoice();

  function handleThemeChange(newTheme: typeof theme) {
    setTheme(newTheme);
    updateTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }

  function handleAudioToggle(enabled: boolean) {
    setAudio(enabled);
    updateAudioEnabled(enabled);
  }

  function handleTranslationToggle(show: boolean) {
    setShowTranslation(show);
    updateShowTranslation(show);
  }

  function handleExport() {
    const json = exportProgress();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dehet-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const success = importProgress(reader.result as string);
        setImportMsg(success ? '✅ Imported!' : '❌ Invalid file');
        if (success) {
          const newProg = loadProgress();
          setTheme(newProg.theme);
          setAudio(newProg.audioEnabled);
          setShowTranslation(newProg.showTranslation);
          document.documentElement.setAttribute('data-theme', newProg.theme);
        }
        setTimeout(() => setImportMsg(''), 2000);
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleReset() {
    if (confirm('Delete all progress? This cannot be undone.')) {
      resetProgress();
      window.location.reload();
    }
  }

  return (
    <div className="settings-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Settings</h3>
        <button className="settings-btn" onClick={onClose}>✕</button>
      </div>

      <div className="settings-row">
        <label>Theme</label>
        <select
          value={theme}
          onChange={(e) => handleThemeChange(e.target.value as typeof theme)}
        >
          <option value="light">☀️ Light</option>
          <option value="dark">🌙 Dark</option>
          <option value="system">💻 System</option>
        </select>
      </div>

      <div className="settings-row">
        <label>
          Audio (Dutch speech)
          {!hasVoice && ' — not available'}
        </label>
        <button
          onClick={() => handleAudioToggle(!audio)}
          disabled={!hasVoice}
          style={{ opacity: hasVoice ? 1 : 0.4 }}
        >
          {audio ? '🔊 On' : '🔇 Off'}
        </button>
      </div>

      <div className="settings-row">
        <label>English translation</label>
        <button onClick={() => handleTranslationToggle(!showTranslation)}>
          {showTranslation ? '👁️ On' : '🚫 Off'}
        </button>
      </div>

      <div className="settings-row">
        <label>Progress</label>
        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button onClick={handleExport}>📤 Export</button>
          <button onClick={handleImport}>📥 Import</button>
        </div>
      </div>
      {importMsg && (
        <p style={{ fontSize: '.8rem', textAlign: 'center' }}>{importMsg}</p>
      )}

      <div className="settings-row">
        <label>Warning</label>
        <button className="danger" onClick={handleReset}>
          Clear all progress
        </button>
      </div>
    </div>
  );
}