import { useEffect, useRef, useState } from 'react';

// The browser's built-in speech recognition (Chrome, Edge, Android).
// Missing in Firefox and patchy on iPhone Safari: `supported` is false there.
const Recognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Turns speech into text, live.
//   finalText:   words the browser is sure about (grows as they talk)
//   interimText: words it's still guessing (changes as they talk)
//   seconds:     how long they've been talking, for the timer
//   error:       'blocked' (mic refused) | 'failed' (anything else) | null
// start() begins a fresh recording. stop() ends it and keeps the last words;
// stop({ discard: true }) ends it straight away and drops anything pending.
export function useSpeechToText({ lang = 'en-IN' } = {}) {
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);

  const recRef = useRef(null);
  const wantRef = useRef(false); // true while they want to keep recording

  // The browser stops by itself after a pause; restart it until they tap stop
  const begin = () => {
    const rec = new Recognition();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let done = '';
      let guess = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) done += text;
        else guess += text;
      }
      if (done) setFinalText((prev) => joinWords(prev, done));
      setInterimText(guess);
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // a pause, or we stopped it
      wantRef.current = false;
      setError(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'blocked' : 'failed');
    };

    rec.onend = () => {
      if (wantRef.current) {
        begin();
        return;
      }
      setInterimText('');
      setListening(false);
    };

    recRef.current = rec;
    rec.start();
  };

  const start = () => {
    if (!Recognition || wantRef.current) return;
    setFinalText('');
    setInterimText('');
    setSeconds(0);
    setError(null);
    wantRef.current = true;
    setListening(true);
    try {
      begin();
    } catch {
      wantRef.current = false;
      setListening(false);
      setError('failed');
    }
  };

  const stop = ({ discard = false } = {}) => {
    wantRef.current = false;
    const rec = recRef.current;
    if (!rec) return;
    if (discard) {
      rec.onresult = null;
      rec.abort();
      setInterimText('');
      setListening(false);
    } else {
      rec.stop(); // the last words arrive as final results, then onend
    }
  };

  // Timer while recording
  useEffect(() => {
    if (!listening) return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);

  // Leaving the screen ends the recording
  useEffect(
    () => () => {
      wantRef.current = false;
      recRef.current?.abort();
    },
    []
  );

  return { supported: Boolean(Recognition), listening, finalText, interimText, seconds, error, start, stop };
}

// Adds new words after old ones with exactly one space between
export function joinWords(before, after) {
  const a = String(before ?? '').trimEnd();
  const b = String(after ?? '').trim();
  if (!a) return b;
  if (!b) return a;
  return `${a} ${b}`;
}