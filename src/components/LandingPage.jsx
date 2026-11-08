import React, { useRef, useEffect, useState } from 'react';
import {
  TOTAL_LANDING_FRAMES,
  TOTAL_VENUE_FRAMES,
  TOTAL_FRAMES,
  getLandingFrameUrl,
  getVenueFrameUrl,
  landingImages,
  venueImages,
  preloadAllImages
} from '../utils/preloadFrames';

export default function LandingPage({ preloadedBundle }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [frameIndex, setFrameIndex] = useState(1);

  const bundleRef = useRef(preloadedBundle || null);
  const targetFrameRef = useRef(1);
  const currentFrameRef = useRef(1);

  useEffect(() => {
    // If images weren't passed through props, ensure preloading is triggered
    if (!bundleRef.current) {
      preloadAllImages().then((bundle) => {
        bundleRef.current = bundle;
        render(Math.round(currentFrameRef.current));
      });
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    let animFrameId = null;
    let lastDrawn = -1;

    // Cover canvas while preserving 9:16 aspect ratio
    const drawCover = (img, blurPx = 0) => {
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;

      const imgRatio = iw / ih;
      const canvasRatio = cw / ch;

      let rw, rh, ox, oy;
      if (canvasRatio > imgRatio) {
        rw = cw;
        rh = cw / imgRatio;
        ox = 0;
        oy = (ch - rh) / 2;
      } else {
        rh = ch;
        rw = ch * imgRatio;
        ox = (cw - rw) / 2;
        oy = 0;
      }

      // Smooth lens blur transition
      if (blurPx > 0.5) {
        // Expand drawing area slightly during heavy blur to eliminate edge-feathering vignetting
        const margin = Math.ceil(blurPx * 1);
        ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
        ctx.drawImage(img, ox - margin, oy - margin, rw + margin * 2, rh + margin * 2);
      } else {
        ctx.filter = 'none';
        ctx.drawImage(img, ox, oy, rw, rh);
      }
      ctx.filter = 'none';
    };

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);

      lastDrawn = -1;
      render(Math.round(currentFrameRef.current));
    };

    const render = (globalNum) => {
      const clamped = Math.max(1, Math.min(TOTAL_FRAMES, globalNum));
      const bundle = bundleRef.current;

      let img = null;
      let blurPx = 0;

      if (clamped <= TOTAL_LANDING_FRAMES) {
        // Part 1: Landing folder (Frames 1 to 400)
        img = bundle?.landingImages?.[clamped] || landingImages[clamped];
        blurPx = 0;

        if (!img || !img.complete || img.naturalWidth === 0) {
          const fallback = new Image();
          fallback.onload = () => {
            landingImages[clamped] = fallback;
            if (Math.round(currentFrameRef.current) === clamped) {
              drawCover(fallback, 0);
              lastDrawn = clamped;
            }
          };
          fallback.src = getLandingFrameUrl(clamped);
          return;
        }
      } else {
        // Part 2: Venue folder (Frames 401 to 600 -> venue frame 1 to 200)
        const venueIdx = clamped - TOTAL_LANDING_FRAMES; // 1 to 200
        img = bundle?.venueImages?.[venueIdx] || venueImages[venueIdx];

        // Blur effect starts at frame 1 of venue and fades out smoothly over 35 frames (refined duration & intensity)
        const VENUE_BLUR_FRAMES = 35;
        const MAX_BLUR_PX = 42;
        if (venueIdx <= VENUE_BLUR_FRAMES) {
          const progress = (venueIdx - 1) / VENUE_BLUR_FRAMES; // 0 at frame 1, 1 at frame 36
          // Non-linear ease-out curve for natural camera focus pull
          blurPx = Math.pow(1 - progress, 1.35) * MAX_BLUR_PX;
        } else {
          blurPx = 0;
        }

        if (!img || !img.complete || img.naturalWidth === 0) {
          const fallback = new Image();
          fallback.onload = () => {
            venueImages[venueIdx] = fallback;
            if (Math.round(currentFrameRef.current) === clamped) {
              drawCover(fallback, blurPx);
              lastDrawn = clamped;
            }
          };
          fallback.src = getVenueFrameUrl(venueIdx);
          return;
        }
      }

      drawCover(img, blurPx);
      lastDrawn = clamped;
    };

    // 60fps/120fps smooth interpolation loop
    const loop = () => {
      const target = targetFrameRef.current;
      const current = currentFrameRef.current;
      const diff = target - current;

      if (Math.abs(diff) > 0.05) {
        currentFrameRef.current += diff * 0.75;
        const toDraw = Math.round(currentFrameRef.current);
        if (toDraw !== lastDrawn) {
          render(toDraw);
          setFrameIndex(toDraw);
        }
      } else if (current !== target) {
        currentFrameRef.current = target;
        const toDraw = Math.round(target);
        if (toDraw !== lastDrawn) {
          render(toDraw);
          setFrameIndex(toDraw);
        }
      }
      animFrameId = requestAnimationFrame(loop);
    };

    // Desktop mouse wheel / trackpad scroll
    const handleWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY * 0.35;
      targetFrameRef.current = Math.max(1, Math.min(TOTAL_FRAMES, targetFrameRef.current + delta));
    };

    // Mobile touch drag
    let lastTouchY = 0;
    const handleTouchStart = (e) => {
      lastTouchY = e.touches[0].clientY;
    };
    const handleTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
      const currentY = e.touches[0].clientY;
      const deltaY = (lastTouchY - currentY) * 0.45;
      lastTouchY = currentY;

      targetFrameRef.current = Math.max(1, Math.min(TOTAL_FRAMES, targetFrameRef.current + deltaY));
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        targetFrameRef.current = Math.min(TOTAL_FRAMES, targetFrameRef.current + 15);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        targetFrameRef.current = Math.max(1, targetFrameRef.current - 15);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    animFrameId = requestAnimationFrame(loop);
    render(1);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, []);

  // Calculate title.webp visibility (visible from frame 1 to 100, fades out smoothly, completely gone before frame 101)
  const isTitleActive = frameIndex <= 100;
  let titleOpacity = 0;
  if (isTitleActive) {
    if (frameIndex <= 65) {
      titleOpacity = 1;
    } else {
      titleOpacity = Math.max(0, (100 - frameIndex) / 35);
    }
  }

  // Venue location overlay: Fast line-by-line staggered fade-in starting from frame 250
  // Full 100% opacity with NO fade-out, disappears on frame 400
  const isVenueOverlayActive = frameIndex >= 250 && frameIndex < 400;

  // Line 1: "Venue" with swash (fades in quickly: frames 250 -> 260)
  const l1In = Math.min(1, Math.max(0, (frameIndex - 250) / 10));
  const l1Opacity = l1In;
  const l1Y = (1 - l1In) * 6;

  // Line 2: "ST.THOMAS CATHEDRAL" (fades in quickly: frames 258 -> 268)
  const l2In = Math.min(1, Math.max(0, (frameIndex - 258) / 10));
  const l2Opacity = l2In;
  const l2Y = (1 - l2In) * 6;

  // Line 3: "CHURCH, MUVATTUPUZHA" (fades in quickly: frames 266 -> 276)
  const l3In = Math.min(1, Math.max(0, (frameIndex - 266) / 10));
  const l3Opacity = l3In;
  const l3Y = (1 - l3In) * 6;

  // Line 4: Directions pill button (fades in quickly: frames 274 -> 284)
  const l4In = Math.min(1, Math.max(0, (frameIndex - 274) / 10));
  const l4Opacity = l4In;
  const l4Y = (1 - l4In) * 6;

  // Venue invitation card overlay: Only start text & overlay animation from venue frame 115 (global 515) to frame 200 (global 600)
  // After frame 200 (frameIndex > 600), everything disappears
  const isVenueCardActive = frameIndex >= 515 && frameIndex <= 600;

  // Reduced intensity white cloud/fog aura focused on center: smooth fade-in from frame 515
  const cloudIn = Math.min(1, Math.max(0, (frameIndex - 515) / 8));
  const cloudOpacity = cloudIn;

  // Block 1: Rings Crest + Heart + Laurel (frames 515 -> 522)
  const b1In = Math.min(1, Math.max(0, (frameIndex - 515) / 7));
  const b1Opacity = b1In;
  const b1Y = (1 - b1In) * 6;

  // Block 2: Invitation Message (frames 521 -> 528)
  const b2In = Math.min(1, Math.max(0, (frameIndex - 521) / 7));
  const b2Opacity = b2In;
  const b2Y = (1 - b2In) * 6;

  // Block 3: Groom (ALEN REJI + Parents + Sister) (frames 527 -> 534)
  const b3In = Math.min(1, Math.max(0, (frameIndex - 527) / 7));
  const b3Opacity = b3In;
  const b3Y = (1 - b3In) * 6;

  // Block 4: Connecting Ampersand "&" (frames 533 -> 539)
  const b4In = Math.min(1, Math.max(0, (frameIndex - 533) / 6));
  const b4Opacity = b4In;
  const b4Y = (1 - b4In) * 6;

  // Block 5: Bride (AMMU SANJAYAN + Parents + Brother) (frames 538 -> 545)
  const b5In = Math.min(1, Math.max(0, (frameIndex - 538) / 7));
  const b5Opacity = b5In;
  const b5Y = (1 - b5In) * 6;

  // Block 6: Divider & "WEDDING" (frames 544 -> 551)
  const b6In = Math.min(1, Math.max(0, (frameIndex - 544) / 7));
  const b6Opacity = b6In;
  const b6Y = (1 - b6In) * 6;

  // Block 7: Date Badge (MONDAY | 11 | JANUARY 2027 + 2:00 PM) (frames 550 -> 557)
  const b7In = Math.min(1, Math.max(0, (frameIndex - 550) / 7));
  const b7Opacity = b7In;
  const b7Y = (1 - b7In) * 6;

  // Calculate dreamy sunlight glare intensity for start of venue section (venue frames 1 to 35, reduced yellow tint)
  const isVenueStart = frameIndex > 400 && frameIndex <= 436;
  const venueProgress = isVenueStart ? (frameIndex - 400 - 1) / 35 : 1;
  const glareOpacity = isVenueStart ? Math.max(0, Math.pow(1 - venueProgress, 1.25)) * 0.75 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[100dvh] max-w-[480px] mx-auto bg-black overflow-hidden select-none touch-none"
    >
      {/* Full-bleed HTML5 Canvas for seamless 600-frame scrubbing */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block object-cover"
      />

      {/* Title logo overlay at top center portion during landing start (visible frame 1 to 100, completely disappears before frame 101) */}
      {isTitleActive && (
        <div
          className="absolute top-8 sm:top-12 inset-x-0 flex justify-center items-center pointer-events-none z-20 transition-opacity duration-150"
          style={{
            opacity: titleOpacity,
          }}
        >
          <img
            src="/title.webp"
            alt="Wedding Title"
            className="w-36 sm:w-44 max-w-[55%] h-auto object-contain"
            loading="eager"
          />
        </div>
      )}

      {/* Venue location text overlay at top left (line-by-line fast fade in from frame 250, disappears on frame 400) */}
      {isVenueOverlayActive && (
        <div className="absolute top-10 sm:top-14 left-7 sm:left-9 max-w-[320px] text-left pointer-events-none z-20">
          {/* Line 1: "Venue" script with elegant swash */}
          <div
            className="flex items-center gap-1.5 transition-all duration-100 ease-out"
            style={{
              opacity: l1Opacity,
              transform: `translateY(${l1Y}px)`,
            }}
          >
            <span className="font-alex text-3xl sm:text-4xl text-[#36441a] leading-none select-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)]">
              Venue
            </span>
            <svg
              className="w-12 h-4 text-[#36441a] mt-2 shrink-0 drop-shadow-[0_1px_2px_rgba(255,255,255,0.4)]"
              viewBox="0 0 60 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <path d="M2 10 C 18 2, 32 15, 48 6 C 54 3, 58 5, 59 6" />
            </svg>
          </div>

          {/* Line 2: "ST.THOMAS CATHEDRAL" */}
          <h2
            className="font-cormorant italic font-bold text-xl sm:text-2xl text-[#36441a] tracking-wide leading-none mt-2 select-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] transition-all duration-100 ease-out"
            style={{
              opacity: l2Opacity,
              transform: `translateY(${l2Y}px)`,
            }}
          >
            ST.THOMAS CATHEDRAL
          </h2>

          {/* Line 3: "CHURCH, MUVATTUPUZHA" */}
          <h2
            className="font-cormorant italic font-bold text-xl sm:text-2xl text-[#36441a] tracking-wide leading-none mt-1 select-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] transition-all duration-100 ease-out"
            style={{
              opacity: l3Opacity,
              transform: `translateY(${l3Y}px)`,
            }}
          >
            CHURCH, MUVATTUPUZHA
          </h2>

          {/* Line 4: Directions pill button */}
          <div
            className="mt-3.5 transition-all duration-100 ease-out"
            style={{
              opacity: l4Opacity,
              transform: `translateY(${l4Y}px)`,
              pointerEvents: l4Opacity > 0.3 ? 'auto' : 'none',
            }}
          >
            <a
              href="https://www.google.com/maps/search/?api=1&query=St.+Thomas+Cathedral+Church,+Muvattupuzha"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-[#384a1e] hover:bg-[#455b25] active:scale-95 text-white px-3.5 py-1.5 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.3)] transition-all cursor-pointer"
            >
              <svg className="w-3.5 h-3.5 fill-current text-white shrink-0" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
              </svg>
              <span className="font-sans text-[11px] sm:text-xs font-medium tracking-normal text-stone-100">
                Click to get Directions
              </span>
            </a>
          </div>
        </div>
      )}

      {/* Subtle cool toning & exposure control overlay visible ONLY on venue frames (frames 401 to 600) */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
        style={{
          opacity: frameIndex > 400 ? 1 : 0,
          background: 'linear-gradient(to bottom, rgba(35, 65, 110, 0.09), rgba(15, 23, 42, 0.12))',
          mixBlendMode: 'color',
        }}
      />

      {/* Dreamy subtle sunlight lens glare overlay at the start of venue (venue frames 1 to 35, softer champagne-gold tone) */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden z-[15] transition-opacity duration-150"
        style={{
          opacity: glareOpacity,
        }}
      >
        {/* Layer 1: Delicate Sun Core & Soft Bloom (top-right light source, reduced yellow saturation) */}
        <div
          className="absolute -top-[15%] -right-[15%] w-[130%] h-[100%] animate-glare-breathe pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 75% 20%, rgba(255, 255, 245, 0.85) 0%, rgba(255, 240, 190, 0.55) 18%, rgba(255, 215, 140, 0.26) 36%, rgba(245, 185, 110, 0.08) 55%, transparent 75%)',
            mixBlendMode: 'screen',
          }}
        />

        {/* Layer 2: Subtle Diagonal Warm Sunlight Ray */}
        <div
          className="absolute inset-0 animate-ray-shimmer pointer-events-none"
          style={{
            background:
              'linear-gradient(135deg, rgba(255, 250, 230, 0.38) 0%, rgba(255, 232, 175, 0.18) 24%, rgba(255, 210, 135, 0.06) 48%, transparent 70%)',
            mixBlendMode: 'screen',
          }}
        />

        {/* Layer 3: Delicate Champagne Ambient Wash */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(255, 235, 185, 0.14) 0%, rgba(255, 205, 140, 0.05) 45%, transparent 75%)',
            mixBlendMode: 'screen',
          }}
        />

        {/* Layer 4: Optical Lens Flare Halos & Bokeh Orbs (soft champagne hues) */}
        <div className="absolute inset-0 animate-flare-drift pointer-events-none">
          {/* Flare Orb 1: Upper soft champagne halo */}
          <div
            className="absolute top-[28%] right-[32%] w-24 h-24 sm:w-28 sm:h-28 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 242, 195, 0.35) 0%, rgba(255, 215, 130, 0.12) 45%, transparent 70%)',
              mixBlendMode: 'screen',
              filter: 'blur(2px)',
            }}
          />

          {/* Flare Orb 2: Mid soft ring */}
          <div
            className="absolute top-[46%] left-[36%] w-32 h-32 sm:w-36 sm:h-36 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 230, 170, 0.25) 0%, rgba(255, 195, 115, 0.07) 50%, transparent 75%)',
              border: '1px solid rgba(255, 235, 180, 0.12)',
              mixBlendMode: 'screen',
              filter: 'blur(3px)',
            }}
          />

          {/* Flare Orb 3: Lower subtle soft-focus disc */}
          <div
            className="absolute top-[64%] left-[22%] w-20 h-20 sm:w-24 sm:h-24 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 225, 155, 0.2) 0%, rgba(255, 180, 90, 0.05) 55%, transparent 70%)',
              mixBlendMode: 'screen',
              filter: 'blur(2px)',
            }}
          />
        </div>

        {/* Layer 5: Ethereal Shimmering Sun Sparkles (soft champagne glints) */}
        <div
          className="absolute top-[18%] right-[24%] w-3 h-3 rounded-full bg-amber-50/85 shadow-[0_0_10px_rgba(255,245,210,0.85)] animate-sparkle-1 pointer-events-none"
          style={{ mixBlendMode: 'screen' }}
        />
        <div
          className="absolute top-[26%] right-[38%] w-2 h-2 rounded-full bg-amber-100/80 shadow-[0_0_8px_rgba(255,235,180,0.8)] animate-sparkle-2 pointer-events-none"
          style={{ mixBlendMode: 'screen' }}
        />
        <div
          className="absolute top-[35%] right-[18%] w-2.5 h-2.5 rounded-full bg-yellow-50/75 shadow-[0_0_8px_rgba(255,240,195,0.75)] animate-sparkle-3 pointer-events-none"
          style={{ mixBlendMode: 'screen' }}
        />
        <div
          className="absolute top-[42%] left-[42%] w-2 h-2 rounded-full bg-amber-100/70 shadow-[0_0_7px_rgba(255,230,170,0.75)] animate-sparkle-1 pointer-events-none"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>

      {/* Aesthetic bottom scroll hint (visible only on early frames) */}
      <div
        className={`absolute bottom-8 inset-x-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-500 z-20 ${frameIndex > 35 ? 'opacity-0' : 'opacity-100'
          }`}
      >
        <p className="font-cormorant italic text-sm sm:text-base tracking-[0.25em] text-stone-200/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          Scroll down to begin our story
        </p>
        <div className="w-[1px] h-6 bg-gradient-to-b from-stone-200/80 to-transparent mt-1.5 animate-pulse" />
      </div>

      {/* Complete Wedding Invitation Card Overlay during Venue section (reveals line-by-line starting earlier at venue frame 75, disappears on frame 200) */}
      {isVenueCardActive && (
        <div className="absolute top-6 sm:top-10 inset-x-3 sm:inset-x-6 max-w-[460px] mx-auto flex flex-col items-center justify-start text-center pointer-events-none z-20">
          {/* Ethereal Seamless White Cloud Aura (Pure continuous gradients with zero rectangular boundaries or backdrop-filter clipping) */}
          <div
            className="absolute -top-10 -inset-x-12 sm:-inset-x-18 h-[590px] pointer-events-none -z-10 transition-opacity duration-200"
            style={{
              opacity: cloudOpacity,
            }}
          >
            {/* Primary soft luminous cloud body: broader elliptical falloff spreading a little more to the sides */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 72% 64% at 50% 45%, rgba(255, 255, 255, 0.72) 0%, rgba(255, 254, 250, 0.48) 38%, rgba(255, 252, 245, 0.20) 64%, rgba(255, 255, 255, 0.04) 82%, transparent 100%)',
              }}
            />

            {/* Cloud Lobe 1: Upper plume behind Rings Crest & Welcome Verse */}
            <div
              className="absolute top-2 left-1/2 -translate-x-1/2 w-[360px] sm:w-[410px] h-[230px] pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle 140px at 50% 50%, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.26) 48%, rgba(255, 255, 255, 0.04) 75%, transparent 100%)',
              }}
            />

            {/* Cloud Lobe 2: Mid-left gentle puff (spread slightly more to the left) */}
            <div
              className="absolute top-[80px] left-[8%] w-[230px] h-[200px] pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle 105px at 50% 50%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0.16) 50%, transparent 85%)',
              }}
            />

            {/* Cloud Lobe 3: Mid-right gentle puff (spread slightly more to the right) */}
            <div
              className="absolute top-[80px] right-[8%] w-[230px] h-[200px] pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle 105px at 50% 50%, rgba(255, 255, 255, 0.42) 0%, rgba(255, 255, 255, 0.16) 50%, transparent 85%)',
              }}
            />

            {/* Cloud Lobe 4: Dense central core directly behind Bride & Groom names */}
            <div
              className="absolute top-[130px] left-1/2 -translate-x-1/2 w-[380px] sm:w-[430px] h-[240px] pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 170px 105px at 50% 50%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.32) 45%, rgba(255, 255, 255, 0.06) 75%, transparent 100%)',
              }}
            />

            {/* Cloud Lobe 5: Lower mist embracing WEDDING, Date Badge, and 2:00 PM */}
            <div
              className="absolute top-[320px] left-1/2 -translate-x-1/2 w-[390px] sm:w-[440px] h-[250px] pointer-events-none"
              style={{
                background:
                  'radial-gradient(ellipse 180px 105px at 50% 48%, rgba(255, 255, 255, 0.58) 0%, rgba(255, 255, 255, 0.24) 48%, rgba(255, 255, 255, 0.04) 75%, transparent 100%)',
              }}
            />
          </div>

          {/* Block 1: Interlocking Golden Rings Crest + Heart + Green Leaves */}
          <div
            className="flex items-center justify-center gap-1.5 mb-2 sm:mb-2.5 transition-all duration-100 ease-out"
            style={{
              opacity: b1Opacity,
              transform: `translateY(${b1Y}px)`,
            }}
          >
            {/* Left olive sprig */}
            <svg className="w-8 h-10 text-[#495f30] shrink-0" viewBox="0 0 24 32" fill="none" stroke="currentColor">
              <path d="M18 30 C 14 24, 10 16, 12 4" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M12 4 C 8 2, 4 6, 6 10 C 8 14, 12 10, 12 4 Z" fill="currentColor" opacity="0.95" />
              <path d="M13 12 C 7 11, 5 15, 8 19 C 11 21, 14 17, 13 12 Z" fill="currentColor" opacity="0.95" />
              <path d="M15 20 C 10 20, 9 24, 12 27 C 14 28, 16 25, 15 20 Z" fill="currentColor" opacity="0.95" />
            </svg>

            {/* Interlocking Rings + Heart */}
            <div className="relative flex flex-col items-center mx-1">
              <svg className="w-4 h-3.5 text-[#9c7225] fill-current mb-0.5" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              <div className="relative flex items-center h-6 w-11">
                <div className="absolute left-0 w-6 h-6 rounded-full border-[2.5px] border-[#9c7225]" />
                <div className="absolute right-0 w-6 h-6 rounded-full border-[2.5px] border-[#9c7225]" />
              </div>
            </div>

            {/* Right olive sprig (mirrored) */}
            <svg className="w-8 h-10 text-[#495f30] shrink-0 -scale-x-100" viewBox="0 0 24 32" fill="none" stroke="currentColor">
              <path d="M18 30 C 14 24, 10 16, 12 4" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M12 4 C 8 2, 4 6, 6 10 C 8 14, 12 10, 12 4 Z" fill="currentColor" opacity="0.95" />
              <path d="M13 12 C 7 11, 5 15, 8 19 C 11 21, 14 17, 13 12 Z" fill="currentColor" opacity="0.95" />
              <path d="M15 20 C 10 20, 9 24, 12 27 C 14 28, 16 25, 15 20 Z" fill="currentColor" opacity="0.95" />
            </svg>
          </div>

          {/* Block 2: Invitation Message (Bigger, bolder, clear & high-contrast) */}
          <div
            className="mb-2.5 sm:mb-3 max-w-[420px] transition-all duration-100 ease-out"
            style={{
              opacity: b2Opacity,
              transform: `translateY(${b2Y}px)`,
            }}
          >
            <p className="font-cormorant text-base sm:text-lg font-bold text-[#0d1613] leading-relaxed">
              We joyfully invite you to share in our<br />
              happiness as we begin a new chapter<br />
              together surrounded by your love and blessings.
            </p>
          </div>

          {/* Block 3: Groom (ALEN REJI - Bigger brown text + clear family details) */}
          <div
            className="mb-2 sm:mb-2.5 transition-all duration-100 ease-out"
            style={{
              opacity: b3Opacity,
              transform: `translateY(${b3Y}px)`,
            }}
          >
            <h2 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[0.2em] text-[#9c7225] leading-none uppercase">
              ALEN REJI
            </h2>
            <p className="font-cormorant text-sm sm:text-[15px] font-bold text-[#0d1613] leading-normal mt-1">
              Son of Reji Thomas &amp; Soly Reji
            </p>
            <p className="font-cormorant text-sm sm:text-[15px] font-bold text-[#0d1613] leading-normal mt-0.5">
              Sister: Aleena Reji
            </p>
          </div>

          {/* Block 4: Connecting Ampersand "&" (Enlarged) */}
          <div
            className="my-1 sm:my-1.5 transition-all duration-100 ease-out"
            style={{
              opacity: b4Opacity,
              transform: `translateY(${b4Y}px)`,
            }}
          >
            <span className="font-cormorant italic font-extrabold text-2xl sm:text-3xl text-[#0d1613] leading-none">
              &amp;
            </span>
          </div>

          {/* Block 5: Bride (AMMU SANJAYAN - Bigger brown text + clear family details) */}
          <div
            className="mb-3 sm:mb-3.5 transition-all duration-100 ease-out"
            style={{
              opacity: b5Opacity,
              transform: `translateY(${b5Y}px)`,
            }}
          >
            <h2 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[0.2em] text-[#9c7225] leading-none uppercase">
              AMMU SANJAYAN
            </h2>
            <p className="font-cormorant text-sm sm:text-[15px] font-bold text-[#0d1613] leading-normal mt-1">
              Daughter of Sanjayan Nair &amp; Bindu
            </p>
            <p className="font-cormorant text-sm sm:text-[15px] font-bold text-[#0d1613] leading-normal mt-0.5">
              Brother: Dr. Sachu Sanjayan
            </p>
          </div>

          {/* Block 6: Floral Divider & "WEDDING" Header (Bigger & crisper) */}
          <div
            className="flex flex-col items-center justify-center w-full mb-2.5 sm:mb-3 transition-all duration-100 ease-out"
            style={{
              opacity: b6Opacity,
              transform: `translateY(${b6Y}px)`,
            }}
          >
            {/* Floral diamond ornament */}
            <div className="flex items-center justify-center gap-2.5 mb-1.5">
              <div className="h-[1.5px] w-14 sm:w-20 bg-gradient-to-r from-transparent to-[#9c7225]" />
              <svg className="w-3.5 h-3.5 text-[#9c7225] fill-current" viewBox="0 0 24 24">
                <path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z" />
              </svg>
              <div className="h-[1.5px] w-14 sm:w-20 bg-gradient-to-l from-transparent to-[#9c7225]" />
            </div>

            {/* WEDDING with wings */}
            <div className="flex items-center justify-center gap-3">
              <div className="h-[1.5px] w-12 sm:w-16 bg-[#9c7225]/75" />
              <h3 className="font-cinzel text-base sm:text-lg font-extrabold tracking-[0.32em] text-[#0d1613] uppercase leading-none">
                WEDDING
              </h3>
              <div className="h-[1.5px] w-12 sm:w-16 bg-[#9c7225]/75" />
            </div>
          </div>

          {/* Block 7: Date Badge (MONDAY | 11 | JANUARY 2027 + 2:00 PM - Bigger, bold & clear) */}
          <div
            className="flex flex-col items-center justify-center w-full mb-2 transition-all duration-100 ease-out"
            style={{
              opacity: b7Opacity,
              transform: `translateY(${b7Y}px)`,
            }}
          >
            {/* Perfectly Symmetrical 3-Column Layout */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 w-full max-w-[370px]">
              {/* Left Box: MONDAY (fixed symmetric width) */}
              <div className="w-[128px] sm:w-[144px] h-[36px] sm:h-[40px] flex items-center justify-center border-[1.5px] border-[#9c7225] rounded-[2px] bg-white/80 shadow-sm shrink-0">
                <span className="font-cinzel text-xs sm:text-[13px] font-extrabold text-[#0d1613] tracking-[0.22em] uppercase whitespace-nowrap">
                  MONDAY
                </span>
              </div>

              {/* Center Anchor: Big, bold serif numeral "11" in rich gold */}
              <div className="w-16 sm:w-20 flex items-center justify-center text-center shrink-0">
                <span className="font-playfair text-6xl sm:text-7xl font-extrabold text-[#9c7225] leading-none select-none tracking-normal">
                  11
                </span>
              </div>

              {/* Right Box: JANUARY 2027 (exact same symmetric width as Left Box) */}
              <div className="w-[128px] sm:w-[144px] h-[36px] sm:h-[40px] flex items-center justify-center border-[1.5px] border-[#9c7225] rounded-[2px] bg-white/80 shadow-sm shrink-0">
                <span className="font-cinzel text-[11px] sm:text-[12.5px] font-extrabold text-[#0d1613] tracking-[0.14em] sm:tracking-[0.16em] uppercase whitespace-nowrap">
                  JANUARY 2027
                </span>
              </div>
            </div>

            {/* Time: 2:00 PM (centered on exact same vertical axis, larger & clearer) */}
            <p className="font-cinzel text-sm sm:text-base font-extrabold text-[#0d1613] tracking-[0.26em] mt-2 text-center">
              2:00 PM
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
