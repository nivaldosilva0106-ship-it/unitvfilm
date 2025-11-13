import { useEffect, useCallback } from 'react';

// Navigation sound effects
const playNavigationSound = (type: 'focus' | 'select' | 'back') => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  // Different frequencies for different actions
  const frequencies = {
    focus: 800,
    select: 1200,
    back: 400,
  };

  oscillator.frequency.value = frequencies[type];
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.1);
};

interface UseKeyboardNavigationOptions {
  enabled?: boolean;
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onArrowLeft?: () => void;
  onArrowRight?: () => void;
}

export const useKeyboardNavigation = (options: UseKeyboardNavigationOptions = {}) => {
  const {
    enabled = true,
    onEscape,
    onEnter,
    onArrowUp,
    onArrowDown,
    onArrowLeft,
    onArrowRight,
  } = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        playNavigationSound('focus');
        onArrowUp?.();
        break;
      case 'ArrowDown':
        e.preventDefault();
        playNavigationSound('focus');
        onArrowDown?.();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        playNavigationSound('focus');
        onArrowLeft?.();
        break;
      case 'ArrowRight':
        e.preventDefault();
        playNavigationSound('focus');
        onArrowRight?.();
        break;
      case 'Enter':
        playNavigationSound('select');
        onEnter?.();
        break;
      case 'Escape':
        playNavigationSound('back');
        onEscape?.();
        break;
    }
  }, [enabled, onEscape, onEnter, onArrowUp, onArrowDown, onArrowLeft, onArrowRight]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { playNavigationSound };
};
