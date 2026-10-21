import { useEffect, useState } from 'react';
import { SETUP_CHANGED_EVENT, SETUP_STORAGE_KEY } from '../data/myPage';
import { loadAnswers } from '../data/myProfile';

// ------------------------------------------------------------
// The setup answers: their page (link, name, bio) and their calls.
// Shared by My offerings (MyPageSetup.jsx) and the 1:1 calls tab
// (CallsPage.jsx), which both change them. Only one of the two is on
// screen at a time, and each reads the answers fresh when it opens.
// Every change is saved in this browser straight away, and the sidebar
// card hears about it (SETUP_CHANGED_EVENT).
// ------------------------------------------------------------
export function useSetupAnswers() {
  const [answers, setAnswers] = useState(loadAnswers);

  useEffect(() => {
    try {
      localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(answers));
      window.dispatchEvent(new Event(SETUP_CHANGED_EVENT));
    } catch {
      // Storage full or blocked: answers still work for this visit
    }
  }, [answers]);

  return [answers, setAnswers];
}