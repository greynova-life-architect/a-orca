/**
 * Text-to-speech using the Web Speech API (speechSynthesis).
 * Cancels any ongoing utterance before speaking so only one reply is heard at a time.
 */

const hasSpeechSynthesis =
  typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Speak the given text. Cancels any current speech first.
 * @param {string} text - Text to speak.
 * @param {{ onEnd?: () => void }} options - Optional onEnd callback when speaking finishes.
 */
export function speakText(text, { onEnd } = {}) {
  if (!hasSpeechSynthesis || !text || typeof text !== 'string') {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  if (onEnd) {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }
  synth.speak(utterance);
}

/**
 * Cancel any ongoing speech.
 */
export function cancelSpeech() {
  if (hasSpeechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Whether the browser supports speechSynthesis.
 */
export function isSpeechSynthesisSupported() {
  return !!hasSpeechSynthesis;
}
