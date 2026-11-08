import React, { useState } from 'react';
import LoadingScreen from './components/LoadingScreen';
import LandingPage from './components/LandingPage';

export default function App() {
  const [stage, setStage] = useState('loading'); // 'loading' | 'landing'
  const [preloadedBundle, setPreloadedBundle] = useState(null);

  const handleStartExperience = (bundle) => {
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
          />
        ) : (
          <div className="relative w-full animate-fadeIn">
            {/* Seamless 600-frame sequence scroll animation (400 landing + blur fade + 200 venue) */}
            <LandingPage
              preloadedBundle={preloadedBundle}
            />
          </div>
        )}
      </div>
    </div>
  );
}
