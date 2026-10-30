/**
 * Audio engine: Web Speech API TTS (nl-NL) + Web Audio chimes.
 * All stateless — callers manage the AudioContext lifecycle.
 */

let audioCtx: AudioContext | null = null;
let speechSynth: SpeechSynthesis | null = null;

function getAudioContext(): AudioContext | null {
  if (audioCtx) return audioCtx;
  try {
    audioCtx = new AudioContext();
    return audioCtx;
  } catch {
    return null;
  }
}

function getSpeech(): SpeechSynthesis | null {
  if (speechSynth) return speechSynth;
  try {
    speechSynth = window.speechSynthesis;
    return speechSynth;
  } catch {
    return null;
  }
}

/** Play a rising two-tone chime for correct answers. */
export function playCorrectChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, now + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.3);
  });
}

/** Play a low, short thud for incorrect answers. */
export function playIncorrectThud(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

/** Build a Dutch utterance, or null when the API is unavailable. */
function dutchUtterance(text: string, rate = 0.9): SpeechSynthesisUtterance | null {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'nl-NL';
    utterance.rate = rate;
    utterance.pitch = 1.0;
    return utterance;
  } catch {
    return null;
  }
}

/** Speak a Dutch sentence using the Web Speech API. Cancels in-progress speech. */
export function speakDutch(text: string): void {
  const synth = getSpeech();
  if (!synth) return;
  const utterance = dutchUtterance(text);
  if (!utterance) return;
  // Cancel any in-progress speech
  synth.cancel();
  synth.speak(utterance);
}

/**
 * Queue a Dutch word without cancelling speech that is already playing.
 * Used by the word-by-word reveal so every new word is pronounced in full.
 */
export function speakDutchWord(text: string): void {
  const synth = getSpeech();
  if (!synth) return;
  const utterance = dutchUtterance(text);
  if (!utterance) return;
  synth.speak(utterance);
}

/** Stop any in-progress Dutch speech. */
export function cancelSpeech(): void {
  const synth = getSpeech();
  if (!synth) return;
  synth.cancel();
}

/** Check if nl-NL voice is available. */
export function hasDutchVoice(): boolean {
  const synth = getSpeech();
  if (!synth) return false;
  const voices = synth.getVoices();
  return voices.some((v) => v.lang.startsWith('nl'));
}

/** Speak the completed sentence from a challenge. */
export function speakChallengeSentence(
  template: string,
  correctOption: string,
): void {
  const sentence = template.replace('[modifier]', correctOption);
  speakDutch(sentence);
}