import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Optimizes TMDB image URLs by replacing resolution keywords based on app configuration.
 * Low quality: w342 for posters, w780 for backdrops
 * High quality: w500 for posters, original for backdrops
 */
export function getOptimizedImageUrl(url: string | undefined | null, type: 'poster' | 'backdrop', quality: 'low' | 'high' = 'high'): string {
  if (!url) return "/placeholder.svg";
  
  // If not a TMDB URL, return as is
  if (!url.includes('tmdb.org/t/p/')) return url;

  if (quality === 'low') {
    if (type === 'poster') return url.replace(/\/t\/p\/(original|w500)\//, '/t/p/w342/');
    if (type === 'backdrop') return url.replace(/\/t\/p\/original\//, '/t/p/w780/');
  } else {
    if (type === 'poster') return url.replace(/\/t\/p\/original\//, '/t/p/w500/');
  }

  return url;
}

export function isContentAllowedForProfile(classification: string | undefined, isKids: boolean): boolean {
  if (!isKids) return true;
  if (!classification) return true;

  const blockedClassifications = ['12', '14', '16', '18'];
  return !blockedClassifications.includes(classification);
}
