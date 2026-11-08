import React, { useState, useEffect } from 'react';
import { preloadAllImages, preloadLoadingScreenImage } from '../utils/preloadFrames';

export default function LoadingScreen({ onStartExperience }) {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [loadedBundle, setLoadedBundle] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    // 1. Prioritize loading.webp first
    preloadLoadingScreenImage().then((img) => {
      if (!isCancelled && img) {
        setImgLoaded(true);
      }
      // 2. Once loading screen image is ready, begin frame stream
      preloadAllImages((pct) => {
        if (!isCancelled) {
          setProgress(pct);
          if (pct >= 100) {
            setIsComplete(true);
          }
        }
      }).then((bundle) => {
        if (!isCancelled) {
          setProgress(100);
          setIsComplete(true);
          setLoadedBundle(bundle);
        }
      });
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="relative w-full h-[100dvh] max-w-[480px] mx-auto overflow-hidden bg-gradient-to-b from-[#f9f7f2] via-[#f3ede2] to-[#e8e0d0] select-none">
      {/* Background Image: loading.webp with high priority, instant load, and smooth fade-in */}
      <img
        src="/loading.webp"
        alt="Alen & Ammu Wedding"
        fetchpriority="high"
        decoding="async"
        onLoad={() => setImgLoaded(true)}
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${
          imgLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Minimal 2D Text directly on the sky (approx. 14% to 35% from top) */}
      <div className="absolute top-[15%] inset-x-4 flex flex-col items-center justify-center text-center z-10">
        {/* Subtle 2D Subtitle */}
        <p className="font-cinzel tracking-[0.3em] text-[10px] sm:text-[11px] uppercase text-stone-700 font-semibold mb-1">
          Wedding Invitation
        </p>

        {/* Minimal Couple Names in Great Vibes font */}
        <h1 className="font-script text-5xl sm:text-6xl text-stone-900 leading-tight">
          Alen &amp; Ammu
        </h1>

        {/* Minimal 2D Loading / Open Action */}
        <div className="mt-3 flex flex-col items-center justify-center min-h-[70px]">
          {!isComplete ? (
            <div className="flex flex-col items-center">
              {/* 2D Real-time Percentage in Great Vibes */}
              <span className="font-script text-4xl text-stone-800 leading-none">
                {progress}%
              </span>

              {/* Minimal Flat Hairline Progress Bar */}
              <div className="w-32 h-[1.5px] bg-stone-400/40 mt-2 overflow-hidden">
                <div
                  className="h-full bg-stone-800 transition-all duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Simple 2D loading text */}
              <p className="font-script text-xl text-stone-700 mt-1">
                Loading our love story...
              </p>
            </div>
          ) : (
            /* Simple 2D Open Invitation in Great Vibes Font */
            <button
              onClick={() => onStartExperience(loadedBundle)}
              className="py-1 px-4 text-stone-900 hover:text-stone-700 font-script text-3xl sm:text-4xl transition-opacity active:opacity-60 cursor-pointer flex flex-col items-center group"
            >
              <span>Open Invitation</span>
              <span className="w-16 h-[1px] bg-stone-800 mt-0.5 group-hover:w-24 transition-all duration-300" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
