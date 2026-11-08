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
let loadedCount = 0;
const completedTaskKeys = new Set();
const progressListeners = new Set();

export const removeProgressListener = (listener) => {
  if (listener) {
    progressListeners.delete(listener);
  }
};

const notifyListeners = () => {
  const pct = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));
  progressListeners.forEach((listener) => {
    try {
      listener(pct, loadedCount);
    } catch (err) {
      console.error('Error in progress listener:', err);
    }
  });
};

let loadingImagePromise = null;

// High-priority dedicated loader for the loading screen background
export const preloadLoadingScreenImage = () => {
  if (loadingImagePromise) return loadingImagePromise;

  loadingImagePromise = new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    const img = new Image();
    img.fetchPriority = 'high';
    img.decoding = 'async';

    let settled = false;
    const done = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    // 2.5-second fallback timeout so preloading never permanently hangs
    const timer = setTimeout(() => done(null), 2500);

    img.onload = () => {
      clearTimeout(timer);
      done(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    img.src = '/loading.webp';
    if (img.complete && img.naturalWidth > 0) {
      clearTimeout(timer);
      done(img);
    }
  });

  return loadingImagePromise;
};

/**
 * High-speed concurrent worker pool for preloading 600 frames.
 * Uses a controlled concurrency queue (18 parallel connections) to maximize
 * network bandwidth without socket congestion or thread locking.
 */
export const preloadAllImages = (onProgress) => {
  if (typeof onProgress === 'function') {
    progressListeners.add(onProgress);
    // Immediately emit current progress to the new listener
    const currentPct = Math.min(100, Math.round((loadedCount / TOTAL_FRAMES) * 100));
    try {
      onProgress(currentPct, loadedCount);
    } catch (e) {}
  }

  if (cachedBundle) {
    if (typeof onProgress === 'function') {
      try {
        onProgress(100, TOTAL_FRAMES);
      } catch (e) {}
    }
    return Promise.resolve(cachedBundle);
  }

  if (preloadPromise) {
    return preloadPromise;
  }

  preloadPromise = new Promise((resolve) => {
    const notify = (taskKey) => {
      if (taskKey) {
        if (completedTaskKeys.has(taskKey)) return;
        completedTaskKeys.add(taskKey);
      }
      loadedCount = completedTaskKeys.size;
      notifyListeners();

      if (loadedCount >= TOTAL_FRAMES) {
        cachedBundle = { landingImages, venueImages };
        notifyListeners();
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
      const taskKey = `${task.type}_${task.index}`;

      // If already loaded in memory
      if (targetArray[task.index] && targetArray[task.index].complete && targetArray[task.index].naturalWidth > 0) {
        notify(taskKey);
        startWorker();
        return;
      }

      let taskSettled = false;
      const finishTask = (imageResult) => {
        if (taskSettled) return;
        taskSettled = true;
        clearTimeout(timeoutId);
        if (imageResult) {
          targetArray[task.index] = imageResult;
        }
        notify(taskKey);
        startWorker();
      };

      // 7-second safety timeout per frame to prevent any hung network sockets
      const timeoutId = setTimeout(() => {
        finishTask(null);
      }, 7000);

      const img = new Image();
      img.decoding = 'async';

      img.onload = () => finishTask(img);
      img.onerror = () => {
        // Quick single retry with cache-buster
        const retry = new Image();
        retry.decoding = 'async';
        retry.onload = () => finishTask(retry);
        retry.onerror = () => finishTask(null);
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
