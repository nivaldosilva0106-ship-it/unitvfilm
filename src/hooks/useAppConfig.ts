import { useState, useEffect, useCallback } from 'react';

export interface AppConfig {
  mode: 'standard' | 'lite';
  isLiteMode: boolean;
  imageQuality: 'low' | 'high';
  enableVideoHero: boolean;
  enableBackdropBlur: boolean;
  enableAnimations: boolean;
  enableTooltips: boolean;
  maxCardsInRow: number;
  maxSectionsPerPage: number;
  performanceMode: 'auto' | 'standard' | 'lite';
  setPerformanceMode: (mode: 'auto' | 'standard' | 'lite') => void;
}

// Simple TV User Agent detection helper
const detectIsTV = (): boolean => {
  if (typeof window === 'undefined' || !window.navigator) return false;
  const ua = navigator.userAgent.toLowerCase();
  const tvKeywords = [
    'smarttv', 'googletv', 'androidtv', 'appletv', 'tv', 'tizen', 'webos', 
    'box', 'firetv', 'mibox', 'chromecast', 'philips', 'sony', 'panasonic',
    'samsung', 'lg', 'hisense', 'toshiba', 'roku', 'tcl', 'xiaomi', 'vizio',
    'apple tv', 'mi box', 'amazon fire'
  ];
  // Check user agent
  if (tvKeywords.some(keyword => ua.includes(keyword))) {
    return true;
  }
  // Check if running on Android/Linux but with typical TV characteristics (e.g., no touchscreen, wide screen, TV keys)
  const isAndroidOrLinux = ua.includes('android') || ua.includes('linux');
  const hasNoTouch = !('ontouchstart' in window) && !navigator.maxTouchPoints;
  if (isAndroidOrLinux && hasNoTouch) {
    return true;
  }
  return false;
};

export const useAppConfig = (): AppConfig => {
  const [perfMode, setPerfModeState] = useState<'auto' | 'standard' | 'lite'>(() => {
    if (typeof window === 'undefined') return 'auto';
    return (localStorage.getItem('unitv_perf_mode') as 'auto' | 'standard' | 'lite') || 'auto';
  });

  useEffect(() => {
    const handleConfigChange = () => {
      const stored = (localStorage.getItem('unitv_perf_mode') as 'auto' | 'standard' | 'lite') || 'auto';
      setPerfModeState(stored);
    };

    window.addEventListener('unitv_config_changed', handleConfigChange);
    // Also listen to storage changes from other tabs/frames if any
    window.addEventListener('storage', handleConfigChange);
    
    return () => {
      window.removeEventListener('unitv_config_changed', handleConfigChange);
      window.removeEventListener('storage', handleConfigChange);
    };
  }, []);

  const setPerformanceMode = useCallback((mode: 'auto' | 'standard' | 'lite') => {
    localStorage.setItem('unitv_perf_mode', mode);
    setPerfModeState(mode);
    window.dispatchEvent(new Event('unitv_config_changed'));
  }, []);

  // Determine actual active mode (isLiteMode) based on selection or environment
  const isEnvLite = import.meta.env.VITE_APP_MODE === 'lite';
  const isLiteMode = isEnvLite || perfMode === 'lite' || (perfMode === 'auto' && detectIsTV());
  const resolvedMode = isLiteMode ? 'lite' : 'standard';

  return {
    mode: resolvedMode,
    isLiteMode,
    imageQuality: isLiteMode ? 'low' : 'high',
    enableVideoHero: !isLiteMode,
    enableBackdropBlur: !isLiteMode,
    enableAnimations: !isLiteMode,
    enableTooltips: !isLiteMode,
    maxCardsInRow: isLiteMode ? 8 : 40,
    maxSectionsPerPage: isLiteMode ? 4 : 20,
    performanceMode: perfMode,
    setPerformanceMode
  };
};

