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
let preloadPromise = null;

// High-priority dedicated loader for the loading screen background
export const preloadLoadingScreenImage = () => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const img = new Image();
    img.fetchPriority = 'high';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/loading.webp';
    if (img.complete && img.naturalWidth > 0) {
      resolve(img);
    }
  });
};

/**
 * High-speed concurrent worker pool for preloading 600 frames.
 * Uses a controlled concurrency queue (18 parallel connections) to maximize
 * network bandwidth without socket congestion or thread locking.
 */
export const preloadAllImages = (onProgress) => {
  if (cachedBundle) {
    if (onProgress) onProgress(100, TOTAL_FRAMES);
    return Promise.resolve(cachedBundle);
  }

  if (preloadPromise) {
    if (onProgress) {
      // If already running, subscribe to progress
      const origProgress = onProgress;
      // Return existing promise
    }
    return preloadPromise;
  }

  preloadPromise = new Promise((resolve) => {
    let loadedCount = 0;
    const progressListeners = onProgress ? [onProgress] : [];

    const notify = () => {
      loadedCount++;
      const pct = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));
      for (const listener of progressListeners) {
        listener(pct, loadedCount);
      }
      if (loadedCount >= TOTAL_FRAMES) {
        cachedBundle = { landingImages, venueImages };
        resolve(cachedBundle);
      }
    };

    // Build ordered task queue:
    // 1. Landing frames 1 to 400
    // 2. Venue frames 1 to 200
    const tasks = [];

    // Preload title image in parallel
    const titleImg = new Image();
    titleImg.decoding = 'async';
    titleImg.src = '/title.webp';

    for (let i = 1; i <= TOTAL_LANDING_FRAMES; i++) {
      tasks.push({ type: 'landing', index: i });
    }
    for (let i = 1; i <= TOTAL_VENUE_FRAMES; i++) {
      tasks.push({ type: 'venue', index: i });
    }

    // High-performance worker pool
    const CONCURRENCY = 18;
    let nextTaskIndex = 0;

    const startWorker = () => {
      if (nextTaskIndex >= tasks.length) return;

      const task = tasks[nextTaskIndex++];
      const targetArray = task.type === 'landing' ? landingImages : venueImages;
      const getUrl = task.type === 'landing' ? getLandingFrameUrl : getVenueFrameUrl;

      // If already loaded in memory
      if (targetArray[task.index] && targetArray[task.index].complete && targetArray[task.index].naturalWidth > 0) {
        notify();
        startWorker();
        return;
      }

      const img = new Image();
      img.decoding = 'async';

      const onDone = () => {
        targetArray[task.index] = img;
        notify();
        startWorker();
      };

      img.onload = onDone;
      img.onerror = () => {
        // Quick single retry with cache-buster
        const retry = new Image();
        retry.decoding = 'async';
        retry.onload = () => {
          targetArray[task.index] = retry;
          notify();
          startWorker();
        };
        retry.onerror = () => {
          notify();
          startWorker();
        };
        retry.src = getUrl(task.index) + '?r=' + Date.now();
      };

      img.src = getUrl(task.index);
    };

    // Spin up 18 concurrent parallel workers
    const activeWorkers = Math.min(CONCURRENCY, tasks.length);
    for (let w = 0; w < activeWorkers; w++) {
      startWorker();
    }
  });

  return preloadPromise;
};

// Start preloading gracefully:
// First fetch loading.webp immediately with top priority, then initiate frame pool
if (typeof window !== 'undefined') {
  preloadLoadingScreenImage().then(() => {
    preloadAllImages();
  });
}
