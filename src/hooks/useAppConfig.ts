import { useMemo } from 'react';

export interface AppConfig {
  mode: 'standard' | 'lite';
  isLiteMode: boolean;
  imageQuality: 'low' | 'high';
  enableVideoHero: boolean;
  enableBackdropBlur: boolean;
  enableAnimations: boolean;
  enableTooltips: boolean;
  maxCardsInRow: number;
}

export const useAppConfig = (): AppConfig => {
  const config = useMemo((): AppConfig => {
    // Detect mode from environment variable defined in .env files
    const mode = (import.meta.env.VITE_APP_MODE as 'standard' | 'lite') || 'standard';
    const isLite = mode === 'lite';

    return {
      mode,
      isLiteMode: isLite,
      // In lite mode (TV Box/Smart TV), we prioritize speed and memory
      imageQuality: isLite ? 'low' : 'high',
      enableVideoHero: !isLite,
      enableBackdropBlur: !isLite,
      enableAnimations: !isLite,
      enableTooltips: !isLite,
      maxCardsInRow: isLite ? 10 : 40, // Reduced from 15 to 10 for better performance
    };
  }, []);

  return config;
};
