import React, { useRef, useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
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

// Scroll frame 1 to 600: Landing (1-400) & Church Venue (401-600)
// Scroll frame 601 to 720: Smooth sliding-up of the Reception page over the venue
// Scroll frame 721 to 820: Hold/stay on full Reception page with 100% content visible
// Scroll frame 821 to 920: Smooth combined continuation showing Reception + RSVP seamlessly together
// Scroll frame 921 to 990: Comfortable hold/stay on RSVP form before Thank You
// Scroll frame 991 to 1110: Smooth full-screen Thank You closing page after RSVP
const TOTAL_SCROLL_FRAMES = 1110;

// Google Apps Script Web App URL for Sheet ID: 1bTVNuSTGGOsWoX_J9q1eJFiIGxNLfGVEFvzGT3Lkge0
// Set VITE_RSVP_SHEET_URL in .env or paste the deployed https://script.google.com/macros/s/.../exec URL below
const RSVP_GOOGLE_SCRIPT_URL =
  import.meta.env.VITE_RSVP_SHEET_URL ||
  'https://script.google.com/macros/s/AKfycbzwqCd3Mpee_yLnTeLgFID8yJnmufKuj7QOrj7xaVDGK4IrscuCAdIpSWOmRmFjOECi2g/exec';

export default function LandingPage({ preloadedBundle }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const receptionContainerRef = useRef(null);
  const beigeBackdropRef = useRef(null);
  const receptionDetailsRef = useRef(null);
  const rsvpDetailsRef = useRef(null);
  const thankyouContainerRef = useRef(null);
  const [frameIndex, setFrameIndex] = useState(1);
  const [isReceptionImgLoaded, setIsReceptionImgLoaded] = useState(false);

  // Inline RSVP Form State
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpPhone, setRsvpPhone] = useState('');
  const [rsvpAttendance, setRsvpAttendance] = useState(''); // '' | 'accepted' | 'rejected'
  const [rsvpGuests, setRsvpGuests] = useState('');
  const [rsvpNote, setRsvpNote] = useState('');
  const [rsvpError, setRsvpError] = useState('');
  const [isSubmittingRsvp, setIsSubmittingRsvp] = useState(false);
  const [rsvpSubmitted, setRsvpSubmitted] = useState(() => {
    try {
      const saved = localStorage.getItem('alen_ammu_rsvp');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleRsvpSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isSubmittingRsvp) return;

    if (!rsvpName.trim()) {
      setRsvpError('Please enter your name');
      return;
    }
    if (!rsvpAttendance) {
      setRsvpError('Please select your attendance');
      return;
    }

    setRsvpError('');
    setIsSubmittingRsvp(true);

    const attendanceLabel =
      rsvpAttendance === 'accepted' ? 'Joyfully Accepted' : 'Regretfully Rejected';
    const guestCount = rsvpAttendance === 'accepted' ? (rsvpGuests || '1') : '0';
    const guestsLabel =
      rsvpAttendance === 'accepted'
        ? (guestCount === '5+' ? '5+ Guests' : `${guestCount} ${guestCount === '1' ? 'Guest' : 'Guests'}`)
        : '0';

    const submission = {
      name: rsvpName.trim(),
      phone: rsvpPhone.trim(),
      attendance: rsvpAttendance,
      guests: guestCount,
      note: rsvpNote.trim(),
      submittedAt: new Date().toISOString()
    };

    try {
      if (RSVP_GOOGLE_SCRIPT_URL) {
        const formBody = new URLSearchParams({
          timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          name: submission.name,
          phone: submission.phone,
          attendance: attendanceLabel,
          guests: guestsLabel,
          wishes: submission.note
        });

        await fetch(RSVP_GOOGLE_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: formBody
        });
      }

      setRsvpSubmitted(submission);
      try {
        localStorage.setItem('alen_ammu_rsvp', JSON.stringify(submission));
      } catch { }
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#fff7e6', '#f0d8a8', '#cfa962', '#9c7225']
      });
    } catch {
      setRsvpError('Could not send response. Please check your internet connection.');
    } finally {
      setIsSubmittingRsvp(false);
    }
  };

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
    let lastBlurred = false;

    // Detect Canvas 2D ctx.filter support (older iOS Safari ignores ctx.filter silently)
    let supportsCtxFilter = false;
    try {
      ctx.filter = 'blur(1px)';
      supportsCtxFilter = ctx.filter === 'blur(1px)';
      ctx.filter = 'none';
    } catch {
      supportsCtxFilter = false;
    }

    // Cover canvas while preserving 9:16 aspect ratio
    const drawCover = (img, blurPx = 0) => {
      if (!img || !img.complete || img.naturalWidth === 0) return;
      const cw = canvas.width;
      const ch = canvas.height;
      if (cw <= 0 || ch <= 0) return;
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

      // Smooth lens blur transition with GPU CSS fallback for iOS Safari
      if (blurPx > 0.5) {
        if (supportsCtxFilter) {
          if (lastBlurred) {
            canvas.style.filter = 'none';
            canvas.style.transform = 'none';
            lastBlurred = false;
          }
          const margin = Math.ceil(blurPx * 1);
          ctx.filter = `blur(${blurPx.toFixed(1)}px)`;
          ctx.drawImage(img, ox - margin, oy - margin, rw + margin * 2, rh + margin * 2);
        } else {
          ctx.filter = 'none';
          ctx.drawImage(img, ox, oy, rw, rh);
          canvas.style.filter = `blur(${blurPx.toFixed(1)}px)`;
          canvas.style.transform = 'scale(1.06)';
          lastBlurred = true;
        }
      } else {
        ctx.filter = 'none';
        if (lastBlurred) {
          canvas.style.filter = 'none';
          canvas.style.transform = 'none';
          lastBlurred = false;
        }
        ctx.drawImage(img, ox, oy, rw, rh);
      }
      ctx.filter = 'none';
    };

    const handleResize = () => {
      const activeTag = document.activeElement?.tagName;
      const isEditingField = activeTag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag);
      const vvHeight = window.visualViewport?.height || window.innerHeight;
      if (isEditingField && Math.max(window.innerHeight, vvHeight) - vvHeight > 140) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextW = Math.round(rect.width * dpr);
      const nextH = Math.round(rect.height * dpr);
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }

      lastDrawn = -1;
      render(Math.round(currentFrameRef.current));
      updateReceptionSlide(currentFrameRef.current);
    };

    const updateReceptionSlide = (curr) => {
      const container = receptionContainerRef.current;
      const backdrop = beigeBackdropRef.current;
      const details = receptionDetailsRef.current;
      const rsvpDetails = rsvpDetailsRef.current;
      const thankyouContainer = thankyouContainerRef.current;
      if (!container) return;

      if (curr <= 600) {
        container.style.transform = 'translate3d(0, 100%, 0)';
        container.style.visibility = 'hidden';
        if (backdrop) backdrop.style.opacity = '0';
        if (details) {
          details.style.opacity = '0';
          details.style.transform = 'translate3d(0, 10px, 0)';
          details.style.pointerEvents = 'none';
        }
        if (rsvpDetails) {
          rsvpDetails.style.opacity = '0';
          rsvpDetails.style.transform = 'translate3d(0, 14px, 0)';
          rsvpDetails.style.pointerEvents = 'none';
        }
        if (thankyouContainer) {
          thankyouContainer.style.transform = 'translate3d(0, 100%, 0)';
          thankyouContainer.style.visibility = 'hidden';
        }
        return;
      }

      container.style.visibility = 'visible';
      // Reception slide-in progress (frames 600 -> 720): 0 -> 1
      const receptionInProgress = Math.max(0, Math.min(1, (curr - 600) / 120));
      // Hold full Reception page steady on screen during frames 720 -> 820, then scroll into RSVP (820 -> 920): 0 -> 1
      const rsvpScrollProgress = curr > 820 ? Math.max(0, Math.min(1, (curr - 820) / 100)) : 0;
      // Comfortable hold on RSVP (920 -> 990), then slide Thank You final page up (990 -> 1110): 0 -> 1
      const thankyouProgress = curr > 990 ? Math.max(0, Math.min(1, (curr - 990) / 120)) : 0;

      // 100% (offscreen bottom) -> 0% (Reception full view & hold) -> -51% (Unified Reception + RSVP One-Page composition)
      const translateY = (1 - receptionInProgress) * 100 - rsvpScrollProgress * 51;
      container.style.transform = `translate3d(0, ${translateY.toFixed(2)}%, 0)`;

      // When sliding pass half of the screen (receptionInProgress > 0.5):
      // background colour changes to beige
      if (receptionInProgress <= 0.5) {
        if (backdrop) backdrop.style.opacity = '0';
      } else {
        // Smooth fade-in to warm wedding beige from 0.5 to 0.85
        const beigeFactor = Math.min(1, (receptionInProgress - 0.5) / 0.35);
        if (backdrop) backdrop.style.opacity = beigeFactor.toFixed(3);
      }

      // Reveal full Reception content as slide completes (receptionInProgress >= 0.85) and keep visible during Reception stay
      if (details) {
        if (receptionInProgress >= 0.85) {
          details.style.opacity = '1';
          details.style.transform = 'translate3d(0, 0, 0)';
          details.style.pointerEvents = rsvpScrollProgress > 0.2 ? 'none' : 'auto';
        } else {
          details.style.opacity = '0';
          details.style.transform = 'translate3d(0, 10px, 0)';
          details.style.pointerEvents = 'none';
        }
      }

      // Smoothly reveal RSVP centerpiece composition once scrolled into combined RSVP view
      if (rsvpDetails) {
        const rsvpOpacity = Math.max(0, Math.min(1, (rsvpScrollProgress - 0.35) / 0.5));
        const rsvpRise = (1 - rsvpOpacity) * 14;
        rsvpDetails.style.opacity = rsvpOpacity.toFixed(3);
        rsvpDetails.style.transform = `translate3d(0, ${rsvpRise.toFixed(1)}px, 0)`;
        rsvpDetails.style.pointerEvents =
          rsvpOpacity > 0.5 && thankyouProgress < 0.15 ? 'auto' : 'none';
      }

      // Smoothly slide Thank You full-screen image page up after RSVP section
      if (thankyouContainer) {
        if (curr <= 990) {
          thankyouContainer.style.transform = 'translate3d(0, 100%, 0)';
          thankyouContainer.style.visibility = 'hidden';
        } else {
          thankyouContainer.style.visibility = 'visible';
          const tyTranslateY = (1 - thankyouProgress) * 100;
          thankyouContainer.style.transform = `translate3d(0, ${tyTranslateY.toFixed(2)}%, 0)`;
        }
      }
    };

    const render = (globalNum) => {
      const clamped = Math.max(1, Math.min(TOTAL_FRAMES, globalNum));
      if (clamped === lastDrawn && globalNum > TOTAL_FRAMES) {
        return;
      }
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

    // Delta-time normalized 60fps/120fps smooth interpolation & gentle non-skidding momentum
    let lastLoopTime = performance.now();
    let touchVelocity = 0; // frames per ms, tightly capped to avoid skidding across pages

    const loop = (now) => {
      const dtMs = Math.min(50, Math.max(1, now - lastLoopTime));
      const dt = dtMs / 1000;
      lastLoopTime = now;

      if (Math.abs(touchVelocity) > 0.002) {
        const prevTarget = targetFrameRef.current;
        const zoneMax = prevTarget >= 600 ? 0.16 : 0.34;
        const clampedVel = Math.max(-zoneMax, Math.min(zoneMax, touchVelocity));
        let nextTarget = Math.max(
          1,
          Math.min(TOTAL_SCROLL_FRAMES, prevTarget + clampedVel * dtMs)
        );

        // Settle flick momentum onto full Reception (720) or full RSVP (920) view cleanly
        if (clampedVel > 0 && prevTarget < 720 && nextTarget >= 720) {
          nextTarget = 720;
          touchVelocity = 0;
        } else if (clampedVel > 0 && prevTarget < 920 && nextTarget >= 920) {
          nextTarget = 920;
          touchVelocity = 0;
        } else {
          touchVelocity = clampedVel * Math.exp(-9 * dt);
        }

        targetFrameRef.current = nextTarget;
      } else {
        touchVelocity = 0;
      }

      const target = targetFrameRef.current;
      const current = currentFrameRef.current;
      const diff = target - current;

      if (Math.abs(diff) > 0.05) {
        const alpha = 1 - Math.exp(-11 * dt);
        currentFrameRef.current += diff * alpha;
        const toDraw = Math.round(currentFrameRef.current);
        if (toDraw !== lastDrawn) {
          render(toDraw);
          setFrameIndex(toDraw);
          lastDrawn = toDraw;
        }
      } else if (current !== target) {
        currentFrameRef.current = target;
        const toDraw = Math.round(target);
        if (toDraw !== lastDrawn) {
          render(toDraw);
          setFrameIndex(toDraw);
          lastDrawn = toDraw;
        }
      }

      updateReceptionSlide(currentFrameRef.current);
      animFrameId = requestAnimationFrame(loop);
    };

    // Desktop mouse wheel / trackpad scroll (normalized & capped so trackpad flicks don't rush pages)
    const handleWheel = (e) => {
      e.preventDefault();
      touchVelocity = 0;
      const lineMultiplier = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 300 : 1;
      const normalizedDelta = e.deltaY * lineMultiplier;
      const sensitivity = targetFrameRef.current >= 600 ? 0.13 : 0.21;
      const delta = Math.max(-14, Math.min(14, normalizedDelta * sensitivity));
      targetFrameRef.current = Math.max(1, Math.min(TOTAL_SCROLL_FRAMES, targetFrameRef.current + delta));
    };

    // Mobile touch drag with active-touch tracking & controlled speed (no skidding past pages)
    let activeTouchId = null;
    let lastTouchY = 0;
    let lastTouchTime = 0;
    let recentFrameRate = 0;

    const handleTouchStart = (e) => {
      touchVelocity = 0;
      recentFrameRate = 0;
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        activeTouchId = touch.identifier;
        lastTouchY = touch.clientY;
        lastTouchTime = performance.now();
      }
    };

    const handleTouchMove = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(e.target.tagName)) return;
      if (e.cancelable) e.preventDefault();

      const touch =
        Array.from(e.touches).find((t) => t.identifier === activeTouchId) || e.touches[0];
      if (!touch) return;

      const now = performance.now();
      const dtMs = Math.max(4, now - lastTouchTime);
      const rawPx = Math.max(-42, Math.min(42, lastTouchY - touch.clientY));
      lastTouchY = touch.clientY;
      lastTouchTime = now;

      const sensitivity = targetFrameRef.current >= 600 ? 0.17 : 0.26;
      const deltaFrames = rawPx * sensitivity;
      targetFrameRef.current = Math.max(1, Math.min(TOTAL_SCROLL_FRAMES, targetFrameRef.current + deltaFrames));

      const instantRate = deltaFrames / dtMs;
      recentFrameRate = recentFrameRate * 0.55 + instantRate * 0.45;
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        activeTouchId = null;
        if (performance.now() - lastTouchTime < 80 && Math.abs(recentFrameRate) > 0.05) {
          const zoneMax = targetFrameRef.current >= 600 ? 0.16 : 0.34;
          touchVelocity = Math.max(-zoneMax, Math.min(zoneMax, recentFrameRate * 0.65));
        } else {
          touchVelocity = 0;
        }
        recentFrameRate = 0;
      }
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      touchVelocity = 0;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        targetFrameRef.current = Math.min(TOTAL_SCROLL_FRAMES, targetFrameRef.current + 14);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        targetFrameRef.current = Math.max(1, targetFrameRef.current - 14);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    animFrameId = requestAnimationFrame(loop);
    render(1);
    updateReceptionSlide(1);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
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

  // Venue invitation card overlay: Only start text & overlay animation from venue frame 115 (global 515)
  // Stays active while the reception page smoothly slides up over it
  const isVenueCardActive = frameIndex >= 515;

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
      className="relative w-full h-full mx-auto bg-[#181612] overflow-hidden select-none touch-none"
    >
      {/* Full-bleed HTML5 Canvas for seamless 600-frame scrubbing */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block object-cover"
      />

      {/* Title logo overlay at top center portion during landing start (visible frame 1 to 100, completely disappears before frame 101) */}
      {isTitleActive && (
        <div
          className="absolute top-[max(2rem,calc(env(safe-area-inset-top)+0.75rem))] sm:top-12 inset-x-0 flex justify-center items-center pointer-events-none z-20 transition-opacity duration-150"
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
        <div className="absolute top-[max(2.5rem,calc(env(safe-area-inset-top)+1rem))] sm:top-14 left-6 min-[360px]:left-7 sm:left-9 right-4 max-w-[320px] text-left pointer-events-none z-20">
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
            className="font-cormorant italic font-bold text-[18px] min-[360px]:text-xl sm:text-2xl text-[#36441a] tracking-wide leading-none mt-2 select-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] transition-all duration-100 ease-out"
            style={{
              opacity: l2Opacity,
              transform: `translateY(${l2Y}px)`,
            }}
          >
            ST.THOMAS CATHEDRAL
          </h2>

          {/* Line 3: "CHURCH, MUVATTUPUZHA" */}
          <h2
            className="font-cormorant italic font-bold text-[18px] min-[360px]:text-xl sm:text-2xl text-[#36441a] tracking-wide leading-none mt-1 select-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.35)] transition-all duration-100 ease-out"
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
        className={`absolute bottom-[max(2rem,calc(env(safe-area-inset-bottom)+1.25rem))] inset-x-0 flex flex-col items-center justify-center pointer-events-none transition-opacity duration-500 z-20 ${frameIndex > 35 ? 'opacity-0' : 'opacity-100'
          }`}
      >
        <p className="font-cormorant italic text-sm sm:text-base tracking-[0.25em] text-stone-200/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          Scroll down to begin our story
        </p>
        <div className="w-[1px] h-6 bg-gradient-to-b from-stone-200/80 to-transparent mt-1.5 animate-pulse" />
      </div>

      {/* Complete Wedding Invitation Card Overlay during Venue section (reveals line-by-line starting earlier at venue frame 75, disappears on frame 200) */}
      {isVenueCardActive && (
        <div className="absolute top-[max(1.25rem,env(safe-area-inset-top))] sm:top-10 inset-x-3 sm:inset-x-6 max-w-[460px] mx-auto flex flex-col items-center justify-start text-center pointer-events-none z-20 short-screen-scale">
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
            <h2 className="font-cinzel text-[21px] min-[360px]:text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[0.15em] min-[360px]:tracking-[0.2em] text-[#9c7225] leading-none uppercase">
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
            <h2 className="font-cinzel text-[21px] min-[360px]:text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[0.15em] min-[360px]:tracking-[0.2em] text-[#9c7225] leading-none uppercase">
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
            <div className="flex items-center justify-center gap-1.5 min-[360px]:gap-2 sm:gap-3 w-full max-w-[370px] px-1">
              {/* Left Box: MONDAY (fixed symmetric width) */}
              <div className="flex-1 max-w-[128px] sm:max-w-[144px] h-[34px] min-[360px]:h-[36px] sm:h-[40px] flex items-center justify-center border-[1.5px] border-[#9c7225] rounded-[2px] bg-white/80 shadow-sm">
                <span className="font-cinzel text-[10.5px] min-[360px]:text-xs sm:text-[13px] font-extrabold text-[#0d1613] tracking-[0.18em] min-[360px]:tracking-[0.22em] uppercase whitespace-nowrap">
                  MONDAY
                </span>
              </div>

              {/* Center Anchor: Big, bold serif numeral "11" in rich gold */}
              <div className="w-13 min-[360px]:w-16 sm:w-20 flex items-center justify-center text-center shrink-0">
                <span className="font-playfair text-5xl min-[360px]:text-6xl sm:text-7xl font-extrabold text-[#9c7225] leading-none select-none tracking-normal">
                  11
                </span>
              </div>

              {/* Right Box: JANUARY 2027 (exact same symmetric width as Left Box) */}
              <div className="flex-1 max-w-[128px] sm:max-w-[144px] h-[34px] min-[360px]:h-[36px] sm:h-[40px] flex items-center justify-center border-[1.5px] border-[#9c7225] rounded-[2px] bg-white/80 shadow-sm">
                <span className="font-cinzel text-[9.5px] min-[360px]:text-[11px] sm:text-[12.5px] font-extrabold text-[#0d1613] tracking-[0.1em] min-[360px]:tracking-[0.14em] sm:tracking-[0.16em] uppercase whitespace-nowrap">
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

      {/* Full-screen warm wedding beige background that smoothly fades in when sliding pass half screen (z-25) */}
      <div
        ref={beigeBackdropRef}
        className="absolute inset-0 pointer-events-none z-25 transition-opacity duration-150"
        style={{
          opacity: 0,
          background: 'linear-gradient(to bottom, #f9f7f2 0%, #f4eee3 50%, #eae1d2 100%)',
        }}
      />

      {/* RECEPTION & RSVP CONTINUOUS COLUMN: Reception slides up over venue (601-720), then combines cleanly with RSVP (721-820) (z-30) */}
      <div
        ref={receptionContainerRef}
        className="absolute inset-0 w-full h-full z-30 overflow-visible will-change-transform pointer-events-none"
        style={{
          transform: 'translate3d(0, 100%, 0)',
          visibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      >
        {/* Warm moss-green garden bridge directly behind the seamless lawn transition between Reception and RSVP */}
        <div
          className="absolute left-0 right-0 top-[76%] h-[36%] pointer-events-none z-[-1]"
          style={{
            background: 'linear-gradient(to bottom, transparent 0%, #21270d 35%, #21270d 65%, transparent 100%)',
          }}
        />

        {/* Full-Page Reception Image (converted WebP with seamless bottom blend into RSVP grass) */}
        <img
          src="/reception.webp"
          alt="Wedding Reception - Alen & Ammu"
          onLoad={() => setIsReceptionImgLoaded(true)}
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none z-10"
          style={{
            maskImage: 'linear-gradient(to bottom, black 0%, black 84%, transparent 99%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 84%, transparent 99%)',
          }}
          draggable={false}
        />

        {/* Reception Details Overlay: Arched champagne-gold layout matching new reference over reception.webp open sky */}
        <div
          ref={receptionDetailsRef}
          className="absolute top-[max(0.5rem,env(safe-area-inset-top))] sm:top-3 inset-x-3 sm:inset-x-4 flex flex-col items-center justify-start text-center z-20 transition-all duration-500 ease-out"
          style={{
            opacity: 0,
            transform: 'translate3d(0, 10px, 0)',
            pointerEvents: 'none',
          }}
        >
          <div className="relative w-full flex flex-col items-center justify-start short-screen-scale">
            {/* Delicate arched golden outline framing the sky card cleanly */}
          <div
            className="absolute -top-0.5 inset-x-3 sm:inset-x-5 h-[285px] sm:h-[310px] rounded-t-[180px] border-t border-l border-r border-[#b59251]/50 pointer-events-none -z-10"
            style={{
              maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 98%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 98%)',
            }}
          />

          {/* Top Intertwined Wedding Rings Divider */}
          <div className="flex items-center justify-center gap-2.5 mt-3 sm:mt-3.5 mb-0.5">
            <div className="h-[1px] w-9 sm:w-12 bg-[#b59251]/60" />
            <svg className="w-6 h-3.5 text-[#9c7225] shrink-0" viewBox="0 0 36 20" fill="none" stroke="currentColor" strokeWidth="1.25">
              <circle cx="14" cy="10" r="5.5" />
              <circle cx="22" cy="10" r="5.5" />
            </svg>
            <div className="h-[1px] w-9 sm:w-12 bg-[#b59251]/60" />
          </div>

          {/* WEDDING RECEPTION Title */}
          <p className="font-cinzel text-[9.5px] sm:text-[10.5px] font-bold tracking-[0.38em] text-[#141412] uppercase leading-none">
            WEDDING
          </p>
          <h3 className="font-cinzel text-[22px] sm:text-[26px] font-medium tracking-[0.14em] leading-none bg-gradient-to-b from-[#6d4e19] via-[#98722d] to-[#b08941] bg-clip-text text-transparent uppercase mt-0.5">
            RECEPTION
          </h3>

          {/* Horizontal Gold Leaf Twig Divider */}
          <div className="flex items-center justify-center gap-2 my-1">
            <div className="h-[1px] w-6 sm:w-8 bg-[#b59251]/60" />
            <svg className="w-8 h-3 text-[#9c7225] shrink-0" viewBox="0 0 48 16" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9 Q 24 7, 42 8" />
              <path d="M14 8 C 12 4, 17 2, 19 6 Z" fill="currentColor" fillOpacity="0.25" />
              <path d="M18 9 C 17 13, 22 14, 23 10 Z" fill="currentColor" fillOpacity="0.25" />
              <path d="M25 8 C 24 3, 29 2, 31 6 Z" fill="currentColor" fillOpacity="0.25" />
              <path d="M29 9 C 28 13, 33 14, 34 9 Z" fill="currentColor" fillOpacity="0.25" />
              <path d="M35 8 C 36 4, 40 4, 41 7 Z" fill="currentColor" fillOpacity="0.25" />
            </svg>
            <div className="h-[1px] w-6 sm:w-8 bg-[#b59251]/60" />
          </div>

          {/* Champagne Pill Date Capsule + Center Crest Shield "11" + 5:30 PM */}
          <div className="flex flex-col items-center justify-center w-full my-1">
            <div className="relative flex items-center justify-between w-full max-w-[266px] sm:max-w-[292px] h-[25px] sm:h-[27px] px-3 sm:px-3.5 rounded-full border border-[#b59251]/80 bg-white/55">
              {/* Left: MONDAY */}
              <span className="font-cinzel text-[8.5px] sm:text-[9.5px] font-extrabold text-[#141412] tracking-[0.14em] uppercase whitespace-nowrap">
                MONDAY
              </span>

              {/* Center Overlapping Gold Shield for "11" */}
              <div
                className="w-11 sm:w-13 h-8 sm:h-9 rounded-xl border border-[#c9a259]/70 shadow-xs flex items-center justify-center shrink-0"
                style={{
                  background: 'linear-gradient(155deg, #f6e7c8 0%, #e4c68c 55%, #d0ab63 100%)',
                }}
              >
                <span className="font-playfair text-[24px] sm:text-[28px] font-extrabold text-[#5c3e10] leading-none select-none tracking-tight">
                  11
                </span>
              </div>

              {/* Right: JANUARY 2027 */}
              <span className="font-cinzel text-[8px] sm:text-[9px] font-extrabold text-[#141412] tracking-[0.07em] uppercase whitespace-nowrap">
                JANUARY 2027
              </span>
            </div>

            {/* Time: 5:30 PM */}
            <p className="font-cinzel text-[11px] sm:text-xs font-extrabold text-[#141412] tracking-[0.22em] mt-1.5 text-center">
              5:30 PM
            </p>
          </div>

          {/* Subtle Diamond Horizontal Divider */}
          <div className="flex items-center justify-center gap-2 w-full max-w-[210px] my-1">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#b59251]/60" />
            <svg className="w-2 h-2 text-[#9c7225]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
              <polygon points="6,1 11,6 6,11 1,6" />
            </svg>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#b59251]/60" />
          </div>

          {/* Venue Details: C9 EVENT CENTER / BY C9 HOSPITALITY / Pin + Address */}
          <div className="flex flex-col items-center text-center">
            <h4 className="font-cinzel text-[12.5px] sm:text-[14px] font-extrabold text-[#141412] tracking-[0.14em] uppercase leading-tight">
              C9 EVENT CENTER
            </h4>
            <p className="font-cinzel text-[8.5px] sm:text-[9.5px] font-bold text-[#967028] tracking-[0.14em] uppercase mt-0.5 leading-tight">
              BY C9 HOSPITALITY
            </p>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <svg className="w-2.5 h-2.5 text-[#9c7225] shrink-0 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
              </svg>
              <span className="font-cinzel text-[7px] sm:text-[7.5px] font-semibold text-[#2a2824] tracking-[0.07em] uppercase">
                PUTHUPPADY, MUVATTUPUZHA, KERALAM 686673
              </span>
            </div>
          </div>

          {/* Two Symmetrical Venue Cards + Vertical Divider + Google Maps Action Pills */}
          <div className="w-full max-w-[300px] sm:max-w-[322px] flex flex-col items-center mt-2 mb-1 pointer-events-auto">
            {/* Row 1: Two Venue Info Pills with center vertical hairline */}
            <div className="flex items-center justify-between gap-2 w-full mb-1.5">
              {/* Left Card: St. Thomas Cathedral */}
              <div className="flex-1 rounded-full border border-[#b59251]/40 bg-[#faf7f0]/75 px-2.5 py-1 flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#9a7228] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M10 4h4" />
                  <path d="M12 6L4 12v9h16v-9L12 6z" />
                  <path d="M10 21v-6h4v6" />
                </svg>
                <span className="font-cormorant font-bold text-[10px] sm:text-[11px] leading-[1.08] text-[#1a1815] text-left">
                  St. Thomas
                  <br />
                  Cathedral
                </span>
              </div>

              {/* Center Vertical Gold Line */}
              <div className="w-[1px] h-7 bg-[#b59251]/45 shrink-0" />

              {/* Right Card: C9 Event Center */}
              <div className="flex-1 rounded-full border border-[#b59251]/40 bg-[#faf7f0]/75 px-2.5 py-1 flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-[#9a7228] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
                  <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3" />
                </svg>
                <span className="font-cormorant font-bold text-[10px] sm:text-[11px] leading-[1.08] text-[#1a1815] text-left">
                  C9 Event
                  <br />
                  Center
                </span>
              </div>
            </div>

            {/* Row 2: Google Maps Action Buttons with Arrow */}
            <div className="flex items-center justify-between gap-4.5 w-full">
              {/* Button 1: CATHEDRAL MAP -> */}
              <a
                href="https://www.google.com/maps/search/?api=1&query=St.+Thomas+Cathedral+Church,+Muvattupuzha"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-full border border-[#8c6725]/85 bg-[#fffcf6] hover:bg-white active:scale-95 text-[#1a1815] shadow-2xs transition-all cursor-pointer group"
              >
                <svg className="w-2.5 h-2.5 text-[#8c6725] shrink-0 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                </svg>
                <span className="font-cinzel text-[7.5px] sm:text-[8px] font-bold tracking-[0.06em] uppercase whitespace-nowrap">
                  CATHEDRAL MAP
                </span>
                <svg className="w-2.5 h-2.5 text-[#8c6725] shrink-0 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
              </a>

              {/* Button 2: RECEPTION MAP -> */}
              <a
                href="https://www.google.com/maps/search/?api=1&query=C9+Event+Center+By+C9+Hospitality+Puthuppady+Muvattupuzha"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-full bg-gradient-to-r from-[#9e7731] to-[#87611f] hover:brightness-105 active:scale-95 text-white shadow-xs transition-all cursor-pointer group"
              >
                <svg className="w-2.5 h-2.5 text-white shrink-0 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z" />
                </svg>
                <span className="font-cinzel text-[7.5px] sm:text-[8px] font-bold tracking-[0.06em] uppercase whitespace-nowrap">
                  RECEPTION MAP
                </span>
                <svg className="w-2.5 h-2.5 text-white shrink-0 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="13 6 19 12 13 18" />
                </svg>
              </a>
            </div>
          </div>

          {/* Graceful Calligraphy Presence Line + Minimal Swirl Flourish */}
          <p className="font-alex text-[15px] sm:text-[17px] text-[#8f6a24] text-center mt-1 select-none leading-none">

          </p>
          <svg className="w-16 h-2.5 text-[#9c7225]/70 mt-0.5" viewBox="0 0 80 12" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
            <path d="M8 4 Q 26 2, 40 9 Q 54 2, 72 4" />
            <path d="M36 9 L 40 11 L 44 9" />
          </svg>
          </div>
        </div>

        {/* RSVP PAGE: Seamlessly blended below Reception so couch+stairs top & centerpiece floral table bottom frame one unified lawn page */}
        <picture
          className="absolute left-0 right-0 top-[95%] w-full h-full pointer-events-none overflow-hidden z-0"
        >
          <source srcSet="/rsvp.webp" type="image/webp" />
          <img
            src="/rsvp.png"
            alt="RSVP - Alen & Ammu"
            className="w-full h-full object-cover object-center pointer-events-none select-none"
            style={{
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 12%, black 100%)',
            }}
            draggable={false}
          />
        </picture>

        {/* RSVP INLINE DESIGN & FORM OVERLAY: Shifted slightly higher across the shaded lawn right below stairs */}
        <div
          ref={rsvpDetailsRef}
          className="absolute left-0 right-0 top-[68%] h-[51%] flex flex-col items-center justify-start pt-2 sm:pt-3 text-center z-30 px-4 transition-all duration-300 ease-out"
          style={{
            opacity: 0,
            transform: 'translate3d(0, 14px, 0)',
            pointerEvents: 'none',
          }}
        >
          {/* Very slight soft dark-olive radial tint behind texts for gentle legibility */}
          <div
            className="absolute inset-0 pointer-events-none -z-10"
            style={{
              background:
                'radial-gradient(ellipse 76% 62% at 50% 45%, rgba(15, 19, 6, 0.28) 0%, rgba(15, 19, 6, 0.14) 55%, transparent 100%)',
            }}
          />

          <div className="w-full flex flex-col items-center short-screen-rsvp-scale">
            {/* Top Ornamental Wedding Rings Divider */}
          <div className="relative flex items-center justify-center gap-2.5 w-full max-w-[260px] mb-1">
            <div className="h-[1px] w-12 sm:w-14 bg-[#e2c685]/65" />
            <svg
              className="w-6 h-3.5 text-[#e4c785] shrink-0 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
              viewBox="0 0 36 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.35"
            >
              <circle cx="14" cy="10" r="6" />
              <circle cx="22" cy="10" r="6" />
            </svg>
            <div className="h-[1px] w-12 sm:w-14 bg-[#e2c685]/65" />
          </div>

          {/* Main Title: Will you celebrate with us? in Great Vibes font */}
          <h2 className="font-script font-normal text-[28px] sm:text-[33px] text-[#fff9ec] tracking-wide leading-[1.15] drop-shadow-[0_1px_5px_rgba(0,0,0,0.7)] select-none">
            Will you celebrate with us?
          </h2>

          {/* Graceful Curved Swash + Two White Blossoms */}
          <svg
            className="w-44 sm:w-52 h-6 sm:h-7 pointer-events-none mt-0.5 mb-2.5 sm:mb-3 drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]"
            viewBox="0 0 220 34"
            fill="none"
          >
            {/* Flowing cream calligraphy swash */}
            <path
              d="M12 21 C 52 8, 96 9, 148 22 C 166 26, 182 24, 196 17"
              stroke="#fff7e6"
              strokeWidth="1.6"
              strokeLinecap="round"
              opacity="0.92"
            />
            {/* Delicate leaves around right end */}
            <path d="M180 18 C 175 11, 182 6, 187 12 Z" fill="#909b54" opacity="0.85" />
            <path d="M196 16 C 201 10, 208 11, 204 17 Z" fill="#909b54" opacity="0.85" />
            <path d="M192 22 C 198 27, 205 25, 201 19 Z" fill="#7d8945" opacity="0.85" />
            {/* Main white 5-petal blossom */}
            <g transform="translate(186 19)">
              <circle cx="0" cy="-4.5" r="3" fill="#fffdf8" />
              <circle cx="4.3" cy="-1.4" r="3" fill="#fffdf8" />
              <circle cx="2.7" cy="3.6" r="3" fill="#fffdf8" />
              <circle cx="-2.7" cy="3.6" r="3" fill="#fffdf8" />
              <circle cx="-4.3" cy="-1.4" r="3" fill="#fffdf8" />
              <circle cx="0" cy="0" r="1.8" fill="#d9a538" />
            </g>
            {/* Smaller companion white blossom */}
            <g transform="translate(198 13) scale(0.72)">
              <circle cx="0" cy="-4.5" r="3" fill="#fffdf8" />
              <circle cx="4.3" cy="-1.4" r="3" fill="#fffdf8" />
              <circle cx="2.7" cy="3.6" r="3" fill="#fffdf8" />
              <circle cx="-2.7" cy="3.6" r="3" fill="#fffdf8" />
              <circle cx="-4.3" cy="-1.4" r="3" fill="#fffdf8" />
              <circle cx="0" cy="0" r="1.8" fill="#d9a538" />
            </g>
          </svg>

          {rsvpSubmitted ? (
            /* Confirmation View After Submitting Inline Form */
            <div className="w-full max-w-[270px] sm:max-w-[288px] flex flex-col items-center text-center py-4 px-5 rounded-xl bg-black/20 backdrop-blur-xs border border-[#e2c685]/40 space-y-2.5">
              <div className="w-8 h-8 rounded-full bg-[#e6c67c]/20 border border-[#e6c67c]/60 flex items-center justify-center text-[#f4db9c]">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="font-script text-2xl sm:text-[26px] text-[#fff8eb] leading-snug">
                Thank you, {rsvpSubmitted.name}!
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setRsvpName(rsvpSubmitted.name || '');
                  setRsvpPhone(rsvpSubmitted.phone || '');
                  setRsvpAttendance(rsvpSubmitted.attendance || 'accepted');
                  setRsvpGuests(rsvpSubmitted.guests && rsvpSubmitted.guests !== '0' ? rsvpSubmitted.guests : '');
                  setRsvpNote(rsvpSubmitted.note || '');
                  setRsvpSubmitted(null);
                }}
                className="mt-2 px-5 py-1.5 rounded-full border border-[#e6c67c]/70 text-[#f4db9c] font-playfair text-xs hover:bg-[#e6c67c]/15 transition-colors cursor-pointer"
              >
                Edit Response
              </button>
            </div>
          ) : (
            /* Direct Inline Minimal Underline Form */
            <form
              onSubmit={handleRsvpSubmit}
              className="w-full max-w-[272px] sm:max-w-[292px] flex flex-col items-center space-y-2.5 sm:space-y-3"
            >
              {/* Field 1: Name */}
              <div className="w-full flex items-center gap-3 border-b border-[#d6b97a]/65 focus-within:border-[#f4db9c] pb-1.5 pt-0.5 transition-colors">
                <svg className="w-4 h-4 text-[#e5c989] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <input
                  type="text"
                  value={rsvpName}
                  onChange={(e) => {
                    setRsvpName(e.target.value);
                    if (rsvpError) setRsvpError('');
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Name"
                  className="w-full bg-transparent font-script font-script-input text-[20px] sm:text-[22px] tracking-wide leading-[1.35] text-[#fff8eb] placeholder:text-[20px] sm:placeholder:text-[22px] placeholder:text-[#efe3ca]/95 outline-none select-text drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                />
              </div>

              {/* Field 2: Phone */}
              <div className="w-full flex items-center gap-3 border-b border-[#d6b97a]/65 focus-within:border-[#f4db9c] pb-1.5 pt-0.5 transition-colors">
                <svg className="w-4 h-4 text-[#e5c989] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <input
                  type="tel"
                  value={rsvpPhone}
                  onChange={(e) => setRsvpPhone(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Phone"
                  className="w-full bg-transparent font-script font-script-input text-[20px] sm:text-[22px] tracking-wide leading-[1.35] text-[#fff8eb] placeholder:text-[20px] sm:placeholder:text-[22px] placeholder:text-[#efe3ca]/95 outline-none select-text drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                />
              </div>

              {/* Field 3: Attendance Dropdown (Joyfully Accepted / Regretfully Rejected) */}
              <div className="relative w-full flex items-center gap-3 border-b border-[#d6b97a]/65 focus-within:border-[#f4db9c] pb-1.5 pt-0.5 transition-colors">
                <svg className="w-4 h-4 text-[#e5c989] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <select
                  value={rsvpAttendance}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRsvpAttendance(val);
                    if (val !== 'accepted') {
                      setRsvpGuests('');
                    }
                    if (rsvpError) setRsvpError('');
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className={`w-full appearance-none bg-transparent font-script font-script-input text-[20px] sm:text-[22px] tracking-wide leading-[1.35] outline-none cursor-pointer pr-5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] ${
                    rsvpAttendance === '' ? 'text-[#efe3ca]/95' : 'text-[#fff8eb]'
                  }`}
                >
                  <option value="" disabled className="bg-[#21270d] text-[#efe3ca]">
                    Attendance
                  </option>
                  <option value="accepted" className="bg-[#21270d] text-[#fff8eb]">
                    Joyfully Accepted
                  </option>
                  <option value="rejected" className="bg-[#21270d] text-[#fff8eb]">
                    Regretfully Rejected
                  </option>
                </select>
                <svg
                  className="w-3.5 h-3.5 text-[#e5c989] absolute right-0.5 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Field 4: Number of Guest Dropdown — behaves strictly according to Attendance selection */}
              {rsvpAttendance === 'accepted' && (
                <div className="relative w-full flex items-center gap-3 border-b border-[#d6b97a]/65 focus-within:border-[#f4db9c] pb-1.5 pt-0.5 transition-colors animate-fadeIn">
                  <svg className="w-4 h-4 text-[#e5c989] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <select
                    value={rsvpGuests}
                    onChange={(e) => setRsvpGuests(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className={`w-full appearance-none bg-transparent font-script font-script-input text-[20px] sm:text-[22px] tracking-wide leading-[1.35] outline-none cursor-pointer pr-5 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] ${
                      rsvpGuests === '' ? 'text-[#efe3ca]/95' : 'text-[#fff8eb]'
                    }`}
                  >
                    <option value="" disabled className="bg-[#21270d] text-[#efe3ca]">
                      Number of Guest
                    </option>
                    <option value="1" className="bg-[#21270d] text-[#fff8eb]">1 Guest</option>
                    <option value="2" className="bg-[#21270d] text-[#fff8eb]">2 Guests</option>
                    <option value="3" className="bg-[#21270d] text-[#fff8eb]">3 Guests</option>
                    <option value="4" className="bg-[#21270d] text-[#fff8eb]">4 Guests</option>
                    <option value="5+" className="bg-[#21270d] text-[#fff8eb]">5+ Guests</option>
                  </select>
                  <svg
                    className="w-3.5 h-3.5 text-[#e5c989] absolute right-0.5 pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              )}

              {/* Field 5: Send your Wishes... */}
              <div className="w-full flex items-center gap-3 border-b border-[#d6b97a]/65 focus-within:border-[#f4db9c] pb-1.5 pt-0.5 transition-colors">
                <svg className="w-4 h-4 text-[#e5c989] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <input
                  type="text"
                  value={rsvpNote}
                  onChange={(e) => setRsvpNote(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Send your Wishes..."
                  className="w-full bg-transparent font-script font-script-input text-[20px] sm:text-[22px] tracking-wide leading-[1.35] text-[#fff8eb] placeholder:text-[20px] sm:placeholder:text-[22px] placeholder:text-[#efe3ca]/95 outline-none select-text drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]"
                />
              </div>

              {rsvpError && (
                <p className="text-[11px] text-[#ffcf99] tracking-wide pt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                  {rsvpError}
                </p>
              )}

              {/* Primary CTA Button: Send Response -> */}
              <button
                type="submit"
                disabled={isSubmittingRsvp}
                onClick={(e) => e.stopPropagation()}
                className={`mt-2.5 sm:mt-3 inline-flex items-center justify-center gap-2 px-8 py-2 rounded-full text-[#1a130a] shadow-[0_0_20px_rgba(236,199,118,0.45),0_4px_12px_rgba(0,0,0,0.4)] transition-all group ${
                  isSubmittingRsvp
                    ? 'opacity-75 cursor-wait'
                    : 'hover:brightness-105 active:scale-95 cursor-pointer'
                }`}
                style={{
                  background: 'linear-gradient(135deg, #fff5dc 0%, #efd291 50%, #d8ae5e 100%)',
                }}
              >
                <span className="font-playfair text-[13px] sm:text-[14px] font-semibold tracking-wide text-[#1a130a]">
                  {isSubmittingRsvp ? 'Sending...' : 'Send Response'}
                </span>
                {!isSubmittingRsvp && (
                  <svg
                    className="w-4 h-4 text-[#1a130a] shrink-0 group-hover:translate-x-0.5 transition-transform"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                )}
              </button>
            </form>
          )}

          {/* Bottom Ornamental Ribbon Bow Divider */}
          <div className="flex items-center justify-center gap-2.5 w-full max-w-[200px] mt-2.5 sm:mt-3">
            <div className="h-[1px] w-10 sm:w-12 bg-[#dec17c]/60" />
            <svg
              className="w-5 h-4 text-[#e2c685] shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
              viewBox="0 0 28 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Left loop */}
              <path d="M14 9 C 10 4, 4 5, 5 9 C 6 12, 11 10, 14 9 Z" />
              {/* Right loop */}
              <path d="M14 9 C 18 4, 24 5, 23 9 C 22 12, 17 10, 14 9 Z" />
              {/* Ribbon tails */}
              <path d="M14 9 L 10 17" />
              <path d="M14 9 L 18 17" />
            </svg>
            <div className="h-[1px] w-10 sm:w-12 bg-[#dec17c]/60" />
          </div>
          </div>
        </div>
      </div>

      {/* THANK YOU PAGE: Final full-screen closing page sliding up smoothly after RSVP section (821-940) */}
      <div
        ref={thankyouContainerRef}
        className="absolute inset-0 w-full h-full z-[35] overflow-hidden will-change-transform pointer-events-none"
        style={{
          transform: 'translate3d(0, 100%, 0)',
          visibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      >
        <img
          src="/thankyou.webp"
          alt="Thank You - Alen & Ammu"
          className="w-full h-full object-cover object-center pointer-events-none select-none"
          draggable={false}
        />
      </div>
    </div>
  );
}
