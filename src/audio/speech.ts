/**
 * Chrome speech recognition (Web Speech API — SpeechRecognition).
 * Kept separate from TTS so unsupported browsers degrade gracefully.
 * Only Chromium browsers expose this API; Firefox/Safari do not.
 */

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

export interface SpeechRecognitionErrorEvent {
  error: string;
}

export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

/** Whether the browser exposes speech recognition (Chrome/Edge). */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof w.SpeechRecognition === 'function' ||
    typeof w.webkitSpeechRecognition === 'function';
}

/** Create a Dutch speech-recognition instance, or null when unsupported. */
export function createSpeechRecognition(): SpeechRecognitionLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as
    | RecognitionCtor
    | undefined;
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = 'nl-NL';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}
