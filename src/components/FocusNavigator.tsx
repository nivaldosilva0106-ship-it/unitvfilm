"use client";

import { useEffect } from "react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

function isFocusable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(el);
  const notVisible = style.visibility === "hidden" || style.display === "none" || el.offsetParent === null;
  const disabled = (el as HTMLButtonElement).disabled === true;
  const tabIndexValid = !el.hasAttribute("tabindex") || (el.tabIndex >= 0);
  return !notVisible && !disabled && tabIndexValid && (
    el.tagName === "BUTTON" ||
    el.tagName === "A" ||
    el.hasAttribute("role") ||
    el.getAttribute("tabindex") !== null
  );
}

function getFocusable(): HTMLElement[] {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(
    'button, [href], a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ));
  return candidates.filter(isFocusable);
}

function center(rect: DOMRect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export default function FocusNavigator() {
  const { playNavigationSound } = useKeyboardNavigation({ enabled: false });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
      if (!keys.includes(e.key)) return;

      const focusables = getFocusable();
      if (focusables.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const current = (active && isFocusable(active)) ? active : null;

      // If nothing focused, focus first element on the page
      if (!current) {
        focusables[0].focus();
        playNavigationSound("focus");
        e.preventDefault();
        return;
      }

      const currentRect = current.getBoundingClientRect();
      const c = center(currentRect);

      // Partition candidates relative to current position
      let candidates: Array<{ el: HTMLElement; rect: DOMRect; c: { x: number; y: number } }> = [];
      for (const el of focusables) {
        if (el === current) continue;
        const rect = el.getBoundingClientRect();
        const mc = center(rect);
        candidates.push({ el, rect, c: mc });
      }

      const sameRowThreshold = Math.max(40, currentRect.height * 0.8);

      let target: HTMLElement | null = null;

      if (e.key === "ArrowLeft") {
        const lefts = candidates
          .filter(it => it.c.x < c.x && Math.abs(it.c.y - c.y) <= sameRowThreshold)
          .sort((a, b) => (c.x - a.c.x) - (c.x - b.c.x) || Math.abs(a.c.y - c.y) - Math.abs(b.c.y - c.y));
        target = (lefts[0]?.el) || null;
      } else if (e.key === "ArrowRight") {
        const rights = candidates
          .filter(it => it.c.x > c.x && Math.abs(it.c.y - c.y) <= sameRowThreshold)
          .sort((a, b) => (a.c.x - c.x) - (b.c.x - c.x) || Math.abs(a.c.y - c.y) - Math.abs(b.c.y - c.y));
        target = (rights[0]?.el) || null;
      } else if (e.key === "ArrowUp") {
        const ups = candidates
          .filter(it => it.c.y < c.y)
          .sort((a, b) => (c.y - a.c.y) - (c.y - b.c.y) || Math.abs(a.c.x - c.x) - Math.abs(b.c.x - c.x));
        target = (ups[0]?.el) || null;
      } else if (e.key === "ArrowDown") {
        const downs = candidates
          .filter(it => it.c.y > c.y)
          .sort((a, b) => (a.c.y - c.y) - (b.c.y - c.y) || Math.abs(a.c.x - c.x) - Math.abs(b.c.x - c.x));
        target = (downs[0]?.el) || null;
      }

      if (target) {
        target.focus();
        playNavigationSound("focus");
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playNavigationSound]);

  return null;
}