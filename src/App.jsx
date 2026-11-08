import React, { useState, useEffect, useRef } from 'react';
import LoadingScreen from './components/LoadingScreen';
import LandingPage from './components/LandingPage';

export default function App() {
  const [stage, setStage] = useState('loading'); // 'loading' | 'landing'
  const [preloadedBundle, setPreloadedBundle] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Initialize background audio instance with public/music.mp3
    const audio = new Audio('/music.mp3');
    audio.loop = true;
    audio.preload = 'auto';
    audioRef.current = audio;

    // Start music when the user touches/clicks anywhere on the screen
    const handleFirstTouch = () => {
      if (audio.paused) {
        audio.play().catch(() => {
          // Handled gracefully if browser still restricts
        });
      }
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('pointerdown', handleFirstTouch);
      window.removeEventListener('click', handleFirstTouch);
    };

    window.addEventListener('touchstart', handleFirstTouch, { passive: true });
    window.addEventListener('pointerdown', handleFirstTouch, { passive: true });
    window.addEventListener('click', handleFirstTouch, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('pointerdown', handleFirstTouch);
      window.removeEventListener('click', handleFirstTouch);
      audio.pause();
    };
  }, []);

  const toggleMute = (e) => {
    if (e) e.stopPropagation();
    if (!audioRef.current) return;

    // If audio is paused, play and unmute
    if (audioRef.current.paused) {
      audioRef.current.muted = false;
      audioRef.current.play().then(() => {
        setIsMuted(false);
      }).catch(() => {});
      return;
    }

    const nextMuted = !audioRef.current.muted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleStartExperience = (bundle) => {
    // Ensure music is playing upon entering invitation if unmuted
    if (audioRef.current && audioRef.current.paused && !isMuted) {
      audioRef.current.play().catch(() => {});
    }
    setPreloadedBundle(bundle);
    setStage('landing');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#0a0c0e] flex justify-center items-start text-stone-100">
      {/* Mobile viewport container (max-w-[480px] centered on desktop, 100% on mobile) */}
      <div className="w-full max-w-[480px] min-h-[100dvh] relative bg-black shadow-[0_0_80px_rgba(0,0,0,0.85)]">
        {stage === 'loading' ? (
          <LoadingScreen
            onStartExperience={handleStartExperience}
            isMuted={isMuted}
            onToggleMusic={toggleMute}
          />
        ) : (
          <div className="relative w-full animate-fadeIn">
            {/* Seamless 600-frame sequence scroll animation (400 landing + blur fade + 200 venue) */}
            <LandingPage
              preloadedBundle={preloadedBundle}
            />

            {/* Small floating music button at bottom right corner in entire project except loading screen */}
            <button
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute background music' : 'Mute background music'}
              className="absolute bottom-6 right-5 sm:right-6 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-black/45 hover:bg-black/60 active:scale-90 backdrop-blur-md border border-white/25 text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-all cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                /* Muted speaker icon with slash */
                <svg className="w-5 h-5 text-white/75" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                /* Playing speaker icon with sound waves */
                <svg className="w-5 h-5 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
