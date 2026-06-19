'use client';

import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';

/**
 * Lightweight launch / splash screen.
 *
 * Design constraints (Iteration 0, section G):
 *  - shows once per tab session (sessionStorage), never on every navigation;
 *  - dark backdrop regardless of theme — same calm first impression;
 *  - short by default, then a smooth fade-out;
 *  - purely cosmetic: it never blocks auth or data loading, and it removes
 *    itself from the DOM after the fade so it can't trap clicks.
 */

const SESSION_KEY = 'mi-splash-shown';
const VISIBLE_MS = 1100;
const FADE_MS = 450;

const PHRASES = [
  'Собираем контекст встреч…',
  'Готовим управленческую память…',
  'Поднимаем контекст руководителей…',
];

type Phase = 'hidden' | 'visible' | 'leaving';

export function LaunchScreen() {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [phrase, setPhrase] = useState(PHRASES[0]);

  useEffect(() => {
    // Respect users who prefer no motion / repeat visits within a session.
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem(SESSION_KEY) === '1';
      sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // sessionStorage can be unavailable (private mode) — just show once.
    }
    if (alreadyShown) return;

    setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    setPhase('visible');

    const toLeaving = setTimeout(() => setPhase('leaving'), VISIBLE_MS);
    const toHidden = setTimeout(() => setPhase('hidden'), VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(toLeaving);
      clearTimeout(toHidden);
    };
  }, []);

  if (phase === 'hidden') return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-gray-950 transition-opacity ease-out ${
        phase === 'leaving' ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* Soft radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(37,99,235,0.18),_transparent_60%)]" />

      <div className="relative flex flex-col items-center gap-5 px-6 text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="relative">
          <span className="absolute inset-0 rounded-2xl bg-blue-600/40 blur-xl animate-pulse" />
          <div className="relative w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <Brain className="w-8 h-8 text-white" />
          </div>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight text-white">Meeting Intelligence</h1>
          <p className="text-sm text-gray-400">{phrase}</p>
        </div>

        <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 rounded-full bg-blue-500 animate-[mi-splash-bar_1.1s_ease-in-out_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes mi-splash-bar {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(220%); }
        }
      `}</style>
    </div>
  );
}
