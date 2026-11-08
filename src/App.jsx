import React, { useState, useEffect, useRef, useCallback } from 'react';
import LoadingScreen from './components/LoadingScreen';
import LandingPage from './components/LandingPage';

export default function App() {
  const [stage, setStage] = useState('loading'); // 'loading' | 'landing'
  const [preloadedBundle, setPreloadedBundle] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isMusicLoaded, setIsMusicLoaded] = useState(false);

  const audioRef = useRef(null);
  const fadeIntervalRef = useRef(null);
  const userInteractedRef = useRef(false);
  const isMusicLoadedRef = useRef(false);
  const musicLoadStartedRef = useRef(false);
  const hasStartedPlaybackRef = useRef(false);

  // Smooth 3-second volume fade-in starting from 0 volume
  const fadeInAudio = (audio, durationMs = 3000) => {
    if (!audio) return;
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    audio.volume = 0;
    const startTime = performance.now();
    fadeIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      audio.volume = progress;
      if (progress >= 1) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    }, 40);
  };

  const startPlaybackWithFade = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !isMusicLoadedRef.current || hasStartedPlaybackRef.current) return;
    if (audio.paused && !audio.muted) {
      audio.volume = 0;
      audio.play().then(() => {
        hasStartedPlaybackRef.current = true;
        fadeInAudio(audio, 3000);
      }).catch(() => {
        // Autoplay policy restriction handled gracefully
      });
    }
  }, []);

  // Load music right after loading.webp finishes loading
  const handleLoadingImageReady = useCallback(() => {
    if (musicLoadStartedRef.current) return;
    musicLoadStartedRef.current = true;

    const audio = new Audio();
    audio.src = '/music.mp3';
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    audioRef.current = audio;

    const onAudioReady = () => {
      if (!isMusicLoadedRef.current) {
        isMusicLoadedRef.current = true;
        setIsMusicLoaded(true);

        // If user already touched/clicked screen before music was loaded, start playback with 3s fade
        if (userInteractedRef.current && !hasStartedPlaybackRef.current) {
          startPlaybackWithFade();
        }
      }
    };

    audio.addEventListener('canplaythrough', onAudioReady, { once: true });
    audio.addEventListener('loadeddata', onAudioReady, { once: true });
    audio.addEventListener('canplay', onAudioReady, { once: true });

    audio.load();
  }, [startPlaybackWithFade]);

  // Safety net: ensure music starts loading if image event was missed
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!musicLoadStartedRef.current) {
        handleLoadingImageReady();
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [handleLoadingImageReady]);

  // Start music on first touch/pointerdown/click anywhere on the screen
  useEffect(() => {
    const handleFirstTouch = () => {
      userInteractedRef.current = true;
      if (isMusicLoadedRef.current && !hasStartedPlaybackRef.current) {
        startPlaybackWithFade();
      }
    };

    window.addEventListener('touchstart', handleFirstTouch, { passive: true });
    window.addEventListener('pointerdown', handleFirstTouch, { passive: true });
    window.addEventListener('click', handleFirstTouch, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleFirstTouch);
      window.removeEventListener('pointerdown', handleFirstTouch);
      window.removeEventListener('click', handleFirstTouch);
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [startPlaybackWithFade]);

  const toggleMute = (e) => {
    if (e) e.stopPropagation();
    userInteractedRef.current = true;
    if (!audioRef.current) return;

    const audio = audioRef.current;
    if (audio.paused) {
      audio.muted = false;
      setIsMuted(false);
      audio.volume = 0;
      audio.play().then(() => {
        hasStartedPlaybackRef.current = true;
        fadeInAudio(audio, 1500);
      }).catch(() => {});
      return;
    }

    const nextMuted = !audio.muted;
    audio.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleStartExperience = (bundle) => {
    userInteractedRef.current = true;
    if (audioRef.current && audioRef.current.paused && !audioRef.current.muted) {
      audioRef.current.volume = 0;
      audioRef.current.play().then(() => {
        hasStartedPlaybackRef.current = true;
        fadeInAudio(audioRef.current, 2000);
      }).catch(() => {});
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
            isMusicLoaded={isMusicLoaded}
            onLoadingImageReady={handleLoadingImageReady}
          />
        ) : (
          <div className="relative w-full animate-fadeIn">
            {/* Seamless 600-frame sequence scroll animation (400 landing + blur fade + 200 venue) */}
            <LandingPage
              preloadedBundle={preloadedBundle}
            />

            {/* Small floating music button at bottom right corner in entire project except loading screen */}
            {isMusicLoaded && (
              <button
                onClick={toggleMute}
                aria-label={isMuted ? 'Unmute background music' : 'Mute background music'}
                className="absolute bottom-6 right-5 sm:right-6 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-black/45 hover:bg-black/60 active:scale-90 backdrop-blur-md border border-white/25 text-white shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-all cursor-pointer animate-fadeIn"
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}