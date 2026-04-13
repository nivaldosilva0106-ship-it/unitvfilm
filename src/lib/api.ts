/**
 * Helper to determine the base URL for API calls.
 * Works across Web and Mobile (Capacitor).
 */
export const getBaseUrl = (): string => {
  if (typeof window === 'undefined') return '';
  
  const { origin, protocol, hostname } = window.location;
  
  // 1. If on Web (standard browser)
  if (protocol === 'http:' || protocol === 'https:') {
    // Special case: Local development using Vite (doesn't serve /api)
    // If you're using 'vercel dev', you might want to use relative path.
    // By default, we point to production if on localhost to ensure API works.
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return import.meta.env.VITE_SITE_URL || 'https://unitvfilm.vercel.app';
    }
    // Production Web: Use the current origin
    return origin;
  }
  
  // 2. Mobile App (Capacitor) or other non-web environments
  // Must use an absolute URL
  return import.meta.env.VITE_SITE_URL || 'https://unitvfilm.vercel.app';
};
