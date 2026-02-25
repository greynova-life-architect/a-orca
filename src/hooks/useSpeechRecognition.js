import { useState, useCallback, useRef, useEffect } from 'react';

const SpeechRecognitionAPI =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Hook for browser SpeechRecognition (speech-to-text).
 * @param {{ onResult: (text: string) => void, onEnd?: () => void }} options
 * @returns {{ isListening: boolean, start: () => void, stop: () => void, supported: boolean, error: string | null }}
 */
export function useSpeechRecognition({ onResult, onEnd }) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);

  const stop = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (_) {}
    recognitionRef.current = null;
    setIsListening(false);
    setError(null);
    onEnd?.();
  }, [onEnd]);

  const start = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError('Speech recognition not supported');
      return;
    }
    setError(null);
    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const last = event.results.length - 1;
        const transcript = event.results[last][0].transcript?.trim();
        if (transcript && event.results[last].isFinal) {
          onResult?.(transcript);
        }
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
        onEnd?.();
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setError('Microphone access denied');
        } else if (event.error === 'no-speech') {
          setError(null);
        } else {
          setError(event.error || 'Recognition error');
        }
        recognitionRef.current = null;
        setIsListening(false);
        onEnd?.();
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (e) {
      setError(e.message || 'Failed to start');
      setIsListening(false);
      onEnd?.();
    }
  }, [onResult, onEnd]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (_) {}
        recognitionRef.current = null;
      }
      setIsListening(false);
    };
  }, []);

  return {
    isListening,
    start,
    stop,
    supported: !!SpeechRecognitionAPI,
    error: error || null,
  };
}
