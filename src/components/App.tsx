import { useEffect } from 'react';
import { ChallengeScreen } from './ChallengeScreen.tsx';
import { loadProgress } from '../engine/progress.ts';

function App() {
  // Apply persisted theme on mount
  useEffect(() => {
    const prog = loadProgress();
    document.documentElement.setAttribute('data-theme', prog.theme);
  }, []);

  return <ChallengeScreen />;
}

export default App;