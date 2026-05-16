import { useEffect, useCallback } from 'react';

// Classes that indicate an element is focusable via remote control
export const FOCUSABLE_CLASS = 'tv-focusable';

interface UseSpatialNavigationProps {
  enabled?: boolean;
  onEnter?: (element: HTMLElement) => void;
  onBack?: () => void;
  onDirectionClick?: (direction: 'up' | 'down' | 'left' | 'right') => boolean | void; // Return true to prevent default focus logic
}

export function useSpatialNavigation({ 
  enabled = true, 
  onEnter,
  onBack,
  onDirectionClick
}: UseSpatialNavigationProps = {}) {

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Detect if the key pressed is a D-Pad key, Enter or Back
    const isUp = e.key === 'ArrowUp';
    const isDown = e.key === 'ArrowDown';
    const isLeft = e.key === 'ArrowLeft';
    const isRight = e.key === 'ArrowRight';
    const isEnter = e.key === 'Enter';
    const isBack = e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack';

    if (!isUp && !isDown && !isLeft && !isRight && !isEnter && !isBack) return;

    // Handle Back
    if (isBack) {
      // Don't prevent default for Backspace if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (e.key === 'Backspace' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      
      if (onBack) {
        e.preventDefault();
        onBack();
      }
      return;
    }

    // Handle Enter
    if (isEnter) {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && activeElement.classList.contains(FOCUSABLE_CLASS)) {
        if (onEnter) {
          onEnter(activeElement);
        } else {
          activeElement.click(); // trigger default click
        }
      }
      return;
    }

    // Direction keys
    e.preventDefault(); // prevent scrolling the page with arrows natively

    let direction: 'up' | 'down' | 'left' | 'right' | null = null;
    if (isUp) direction = 'up';
    if (isDown) direction = 'down';
    if (isLeft) direction = 'left';
    if (isRight) direction = 'right';

    if (direction && onDirectionClick) {
      const handled = onDirectionClick(direction);
      if (handled) return; // Custom handler completely bypassed standard navigation
    }

    const focusableElements = Array.from(document.querySelectorAll(`.${FOCUSABLE_CLASS}`)) as HTMLElement[];
    const visibleElements = focusableElements.filter(el => {
      const rect = el.getBoundingClientRect();
      // Ensure it's not hidden via CSS or completely zero size
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
    });

    if (visibleElements.length === 0) return;

    let currentFocused = document.activeElement as HTMLElement;
    
    // If no element is focused, or the currently focused element isn't in our tv-focusable list, focus the first one
    if (!currentFocused || !currentFocused.classList.contains(FOCUSABLE_CLASS) || !visibleElements.includes(currentFocused)) {
      // Find the element closest to the top-left of the screen
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
      
      // Calculate distances based on centers to improve heuristic
      const currentCenterX = currentRect.left + currentRect.width / 2;
      const currentCenterY = currentRect.top + currentRect.height / 2;
      
      const candidateCenterX = candidateRect.left + candidateRect.width / 2;
      const candidateCenterY = candidateRect.top + candidateRect.height / 2;

      const dx = candidateCenterX - currentCenterX;
      const dy = candidateCenterY - currentCenterY;

      // Filter candidates that are logically in the pressed direction
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
        // Scoring formula: prioritize elements that are aligned on the primary axis and penalize secondary axis divergence
        const score = primaryAxisDistance + (secondaryAxisDistance * 2); 
        
        if (score < minScore) {
          minScore = score;
          bestCandidate = candidate;
        }
      }
    });

    if (bestCandidate) {
      (bestCandidate as HTMLElement).focus();
      // Scroll into view if needed
      (bestCandidate as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

  }, [enabled, onEnter, onDirectionClick]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
