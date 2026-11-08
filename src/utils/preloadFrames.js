export const TOTAL_LANDING_FRAMES = 400;
export const TOTAL_VENUE_FRAMES = 200;
export const TOTAL_FRAMES = TOTAL_LANDING_FRAMES + TOTAL_VENUE_FRAMES; // 600 total frames

export const getLandingFrameUrl = (index) => {
  const clamped = Math.max(1, Math.min(TOTAL_LANDING_FRAMES, Math.round(index)));
  const num = clamped < 10 ? `0${clamped}` : `${clamped}`;
  return `/landing/frame_${num}.webp`;
};

export const getVenueFrameUrl = (index) => {
  const clamped = Math.max(1, Math.min(TOTAL_VENUE_FRAMES, Math.round(index)));
  const num = clamped < 10 ? `0${clamped}` : `${clamped}`;
  return `/venue/frame_${num}.webp`;
};

// Global arrays so frames stay decoded in memory
export const landingImages = new Array(TOTAL_LANDING_FRAMES + 1);
export const venueImages = new Array(TOTAL_VENUE_FRAMES + 1);

let cachedBundle = null;

export const preloadAllImages = (onProgress) => {
  if (cachedBundle) {
    if (onProgress) onProgress(100, TOTAL_FRAMES);
    return Promise.resolve(cachedBundle);
  }

  return new Promise((resolve) => {
    let loadedCount = 0;

    const notify = () => {
      loadedCount++;
      const pct = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));
      if (onProgress) onProgress(pct, loadedCount);
      if (loadedCount >= TOTAL_FRAMES) {
        cachedBundle = { landingImages, venueImages };
        resolve(cachedBundle);
      }
    };

    // 1. Preload 400 Landing Frames
    for (let i = 1; i <= TOTAL_LANDING_FRAMES; i++) {
      if (landingImages[i] && landingImages[i].complete && landingImages[i].naturalWidth > 0) {
        notify();
        continue;
      }
      const img = new Image();
      img.onload = () => {
        landingImages[i] = img;
        notify();
      };
      img.onerror = () => {
        const retry = new Image();
        retry.onload = notify;
        retry.onerror = notify;
        retry.src = getLandingFrameUrl(i) + '?retry=' + Date.now();
        landingImages[i] = retry;
      };
      img.src = getLandingFrameUrl(i);
      landingImages[i] = img;
    }

    // 2. Preload 200 Venue Frames
    for (let i = 1; i <= TOTAL_VENUE_FRAMES; i++) {
      if (venueImages[i] && venueImages[i].complete && venueImages[i].naturalWidth > 0) {
        notify();
        continue;
      }
      const img = new Image();
      img.onload = () => {
        venueImages[i] = img;
        notify();
      };
      img.onerror = () => {
        const retry = new Image();
        retry.onload = notify;
        retry.onerror = notify;
        retry.src = getVenueFrameUrl(i) + '?retry=' + Date.now();
        venueImages[i] = retry;
      };
      img.src = getVenueFrameUrl(i);
      venueImages[i] = img;
    }
  });
};

// Preload immediately in background
if (typeof window !== 'undefined') {
  const titleImg = new Image();
  titleImg.src = '/title.webp';
  preloadAllImages();
}

