import { useEffect, useCallback, useRef } from 'react';

export const FOCUSABLE_CLASS = 'tv-focusable';

interface UseSpatialNavigationProps {
  enabled?: boolean;
  onEnter?: (element: HTMLElement) => void;
  onBack?: () => void;
  onDirectionClick?: (direction: 'up' | 'down' | 'left' | 'right') => boolean | void;
}

export function useSpatialNavigation({ 
  enabled = true, 
  onEnter,
  onBack,
  onDirectionClick
}: UseSpatialNavigationProps = {}) {
  const lastKeyTimeRef = useRef(0);
  const KEY_REPEAT_DELAY = 150;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    const isUp = e.key === 'ArrowUp' || e.key === 'Up';
    const isDown = e.key === 'ArrowDown' || e.key === 'Down';
    const isLeft = e.key === 'ArrowLeft' || e.key === 'Left';
    const isRight = e.key === 'ArrowRight' || e.key === 'Right';
    const isEnter = e.key === 'Enter' || e.key === 'MediaPlayPause';
    const isBack = e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack' || e.key === 'BrowserBack';

    if (!isUp && !isDown && !isLeft && !isRight && !isEnter && !isBack) return;

    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

    if (isInput && !isBack && !isEnter) return;

    const now = Date.now();
    if (now - lastKeyTimeRef.current < KEY_REPEAT_DELAY) {
      e.preventDefault();
      return;
    }
    lastKeyTimeRef.current = now;

    if (isBack) {
      if (e.key === 'Backspace' && isInput) {
        return;
      }
      
      if (onBack) {
        e.preventDefault();
        onBack();
      }
      return;
    }

    if (isEnter) {
      if (isInput) return;
      e.preventDefault();
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.classList.contains(FOCUSABLE_CLASS)) {
        if (onEnter) {
          onEnter(activeElement);
        } else {
          activeElement.click();
        }
      }
      return;
    }

    e.preventDefault();

    let direction: 'up' | 'down' | 'left' | 'right' | null = null;
    if (isUp) direction = 'up';
    if (isDown) direction = 'down';
    if (isLeft) direction = 'left';
    if (isRight) direction = 'right';

    if (direction && onDirectionClick) {
      const handled = onDirectionClick(direction);
      if (handled) return;
    }

    const focusableElements = Array.from(document.querySelectorAll(`.${FOCUSABLE_CLASS}`)) as HTMLElement[];
    const visibleElements = focusableElements.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    });

    if (visibleElements.length === 0) return;

    let currentFocused = document.activeElement as HTMLElement;
    
    if (!currentFocused || !currentFocused.classList.contains(FOCUSABLE_CLASS) || !visibleElements.includes(currentFocused)) {
      let bestFirst = visibleElements[0];
      let minDistance = Infinity;
      visibleElements.forEach(el => {
         const rect = el.getBoundingClientRect();
         const dist = Math.sqrt(rect.left * rect.left + rect.top * rect.top);
         if (dist < minDistance) {
           minDistance = dist;
           bestFirst = el;
         }
      });
      bestFirst.focus();
      return;
    }

    const currentRect = currentFocused.getBoundingClientRect();
    
    let bestCandidate: HTMLElement | null = null;
    let minScore = Infinity;

    visibleElements.forEach(candidate => {
      if (candidate === currentFocused) return;
      
      const candidateRect = candidate.getBoundingClientRect();
      
      const currentCenterX = currentRect.left + currentRect.width / 2;
      const currentCenterY = currentRect.top + currentRect.height / 2;
      
      const candidateCenterX = candidateRect.left + candidateRect.width / 2;
      const candidateCenterY = candidateRect.top + candidateRect.height / 2;

      const dx = candidateCenterX - currentCenterX;
      const dy = candidateCenterY - currentCenterY;

      let inDirection = false;
      let primaryAxisDistance = 0;
      let secondaryAxisDistance = 0;

      if (isUp && dy < 0) {
        inDirection = true;
        primaryAxisDistance = Math.abs(dy);
        secondaryAxisDistance = Math.abs(dx);
      } else if (isDown && dy > 0) {
        inDirection = true;
        primaryAxisDistance = Math.abs(dy);
        secondaryAxisDistance = Math.abs(dx);
      } else if (isLeft && dx < 0) {
        inDirection = true;
        primaryAxisDistance = Math.abs(dx);
        secondaryAxisDistance = Math.abs(dy);
      } else if (isRight && dx > 0) {
        inDirection = true;
        primaryAxisDistance = Math.abs(dx);
        secondaryAxisDistance = Math.abs(dy);
      }

      if (inDirection) {
        const score = primaryAxisDistance + (secondaryAxisDistance * 2);
        
        if (score < minScore) {
          minScore = score;
          bestCandidate = candidate;
        }
      }
    });

    if (bestCandidate) {
      bestCandidate.focus();
      bestCandidate.scrollIntoView({ behavior: 'instant', block: 'nearest', inline: 'nearest' });
    }

  }, [enabled, onEnter, onDirectionClick]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleKeyDown]);
}
