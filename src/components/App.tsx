import { useEffect } from 'react';
import { ChallengeScreen } from './ChallengeScreen.tsx';
import { BackgroundFX } from './BackgroundFX.tsx';
import Footer from './Footer.tsx';
import { loadProgress } from '../engine/progress.ts';

function App() {
  // Apply persisted theme on mount
  useEffect(() => {
    const prog = loadProgress();
    document.documentElement.setAttribute('data-theme', prog.theme);
  }, []);

  return (
    <>
      <BackgroundFX />
      <ChallengeScreen />
      <Footer />
    </>
  );
}

export default App;
