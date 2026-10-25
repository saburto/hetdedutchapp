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

/** Speak a Dutch sentence using the Web Speech API. */
export function speakDutch(text: string): void {
  const synth = getSpeech();
  if (!synth) return;
  // Cancel any in-progress speech
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'nl-NL';
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  synth.speak(utterance);
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