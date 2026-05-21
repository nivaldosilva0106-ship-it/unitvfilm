/**
 * Secure URL System
 * 
 * Generates encrypted, time-limited tokens for video URLs.
 * The real URL is never exposed in the browser DOM or Network tab.
 * 
 * Architecture:
 * 1. Real URL → encryptUrl() → encrypted token
 * 2. Token sent to /api/stream-proxy?t=TOKEN
 * 3. Server decrypts token → validates expiry → proxies stream
 * 4. User only sees: /api/stream-proxy?t=a8f3b2c1d4e5...
 */

// Obfuscation key (rotated with timestamp for extra security)
// In production, this should match the server-side key
const _K = [0x55, 0x6E, 0x69, 0x54, 0x76, 0x46, 0x69, 0x6C, 0x6D, 0x53, 0x65, 0x63, 0x75, 0x72, 0x65, 0x4B];

// Token validity in milliseconds (15 minutes)
const TOKEN_VALIDITY_MS = 15 * 60 * 1000;

/**
 * XOR encrypt/decrypt with rotating key
 */
function xorCipher(input: string, salt: number): string {
  const keyWithSalt = _K.map((b, i) => b ^ ((salt >> (i % 4) * 8) & 0xFF));
  let result = '';
  for (let i = 0; i < input.length; i++) {
    result += String.fromCharCode(input.charCodeAt(i) ^ keyWithSalt[i % keyWithSalt.length]);
  }
  return result;
}

/**
 * Encrypt a URL into a time-limited token
 */
export function encryptUrl(url: string, customValidityMs: number = TOKEN_VALIDITY_MS): string {
  const now = Date.now();
  const expiry = now + customValidityMs;
  const nonce = Math.random().toString(36).substring(2, 8);
  
  // Payload: nonce|expiry|url
  const payload = `${nonce}|${expiry}|${url}`;
  
  // XOR cipher with time-based salt (MUST fit in 16 bits since we store 4 hex chars)
  const salt = Math.floor(now / (5 * 60 * 1000)) & 0xFFFF; // Changes every 5 minutes
  const encrypted = xorCipher(payload, salt);
  
  // Base64 encode (URL-safe)
  const b64 = btoa(encrypted)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  // Prepend salt indicator (4 chars = 16 bits) for server-side decryption
  const saltHex = salt.toString(16).padStart(4, '0');
  
  return saltHex + b64;
}

/**
 * Decrypt a token back to the original URL (used server-side)
 */
export function decryptToken(token: string): { url: string; expired: boolean } | null {
  try {
    if (token.length < 5) return null;
    
    // Extract salt from first 4 chars
    const saltHex = token.substring(0, 4);
    const salt = parseInt(saltHex, 16);
    const b64 = token.substring(4);
    
    // Restore base64 padding
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    
    // Decode in Node.js or browser
    let decoded: string;
    if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(padded, 'base64').toString('binary');
    } else {
      decoded = atob(padded);
    }
    
    // XOR decrypt
    const payload = xorCipher(decoded, salt);
    
    // Parse: nonce|expiry|url
    const firstPipe = payload.indexOf('|');
    if (firstPipe === -1) return null;
    
    const secondPipe = payload.indexOf('|', firstPipe + 1);
    if (secondPipe === -1) return null;
    
    const expiry = parseInt(payload.substring(firstPipe + 1, secondPipe));
    const url = payload.substring(secondPipe + 1);
    
    // Validate URL looks reasonable
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      // Try adjacent salt values (clock skew protection)
      for (const adj of [salt - 1, salt + 1]) {
        const retryDecoded = typeof Buffer !== 'undefined'
          ? Buffer.from(padded, 'base64').toString('binary')
          : atob(padded);
        const retryPayload = xorCipher(retryDecoded, adj);
        const rFirst = retryPayload.indexOf('|');
        const rSecond = retryPayload.indexOf('|', rFirst + 1);
        if (rFirst !== -1 && rSecond !== -1) {
          const rUrl = retryPayload.substring(rSecond + 1);
          const rExpiry = parseInt(retryPayload.substring(rFirst + 1, rSecond));
          if (rUrl.startsWith('http://') || rUrl.startsWith('https://')) {
            return { url: rUrl, expired: Date.now() > rExpiry };
          }
        }
      }
      return null;
    }
    
    return {
      url,
      expired: Date.now() > expiry
    };
  } catch (e) {
    console.error('Token decryption failed:', e);
    return null;
  }
}

/**
 * Check if a URL should be protected (mp4, ts, txt, m3u8)
 */
export function isProtectedUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase().split('?')[0];
  return (
    lower.endsWith('.mp4') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.m3u8') ||
    lower.endsWith('.m3u') ||
    lower.endsWith('.mkv') ||
    lower.endsWith('.m4s') ||
    url.includes('typezero.top') ||
    url.includes('googleapis.com/drive')
  );
}

/**
 * Create a secure playback URL (for VideoPlayer)
 * Returns a proxied URL with encrypted token
 */
export function createSecurePlaybackUrl(url: string): string {
  if (!url) return url;
  
  // Don't double-encrypt already proxied URLs
  if (url.startsWith('/api/')) return url;
  if (url.includes('stream-proxy?')) return url;
  
  // Only protect certain URL types
  if (!isProtectedUrl(url)) return url;
  
  // HLS.js strongly relies on extensions in the URL to determine the parser type
  // Since we obfuscate the URL, we need to provide a fake extension hint
  let ext = '';
  const urlLower = url.toLowerCase().split('?')[0];
  if (urlLower.endsWith('.m3u8') || urlLower.endsWith('.txt') || urlLower.endsWith('.m3u') || url.includes('typezero.top')) {
    ext = '&ext=.m3u8';
  } else if (urlLower.endsWith('.mp4')) {
    ext = '&ext=.mp4';
  } else if (urlLower.endsWith('.ts')) {
    ext = '&ext=.ts';
  }
  
  // APK FIX: In native apps (Capacitor/APK), relative URLs like "/api/..." fail 
  // because they point to http://localhost/api/...
  // We MUST use the absolute domain from SiteSettings or window.location.origin
  let baseUrl = '';
  if (typeof window !== 'undefined') {
    // Check if we are in a native APK environment (Capacitor)
    const isNative = (window as any).Capacitor?.isNative || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

    if (isNative) {
      try {
        const cached = localStorage.getItem('cached_settings');
        if (cached) {
          const settings = JSON.parse(cached);
          if (settings.officialSiteUrl) {
            baseUrl = settings.officialSiteUrl.replace(/\/$/, '');
          }
        }
      } catch (e) {}
      
      // Fallback if settings not found - use the production Vercel domain
      if (!baseUrl) {
        baseUrl = 'https://unitvfilms.vercel.app'; // Default fallback
      }
    }
  }
  
  // Encrypted URL with 2 hours validity to prevent live streams from stopping and long movies from stalling
  const token = encryptUrl(url, 2 * 60 * 60 * 1000);
  return `${baseUrl}/api/stream-proxy?t=${token}${ext}`;
}

/**
 * Create a secure download URL
 * Returns a download URL that never exposes the real source
 */
export function createSecureDownloadUrl(url: string, filename?: string): string {
  if (!url) return url;
  
  const token = encryptUrl(url);
  const params = new URLSearchParams({ t: token });
  if (filename) params.set('f', filename);
  
  // APK FIX: Absolute URL for downloads in native environment
  let baseUrl = '';
  if (typeof window !== 'undefined') {
    const isNative = (window as any).Capacitor?.isNative || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

    if (isNative) {
      try {
        const cached = localStorage.getItem('cached_settings');
        if (cached) {
          const settings = JSON.parse(cached);
          if (settings.officialSiteUrl) {
            baseUrl = settings.officialSiteUrl.replace(/\/$/, '');
          }
        }
      } catch (e) {}
      if (!baseUrl) baseUrl = 'https://unitvfilms.vercel.app';
    }
  }
  
  return `${baseUrl}/api/secure-download?${params.toString()}`;
}

/**
 * Create an Xtream-compatible playback URL for Android APKs
 * Returns /movie/user/pass/ID.mp4 or /series/user/pass/ID.mkv
 * where ID is the securely encrypted token.
 */
export function createXtreamPlaybackUrl(url: string, type: 'movie' | 'series', username = 'user', password = 'password'): string {
  if (!url) return url;
  
  // Encrypt the real URL into a secure token to use as the ID
  const token = encryptUrl(url);
  
  // APK FIX: Absolute URL for native environment
  let baseUrl = '';
  if (typeof window !== 'undefined') {
    const isNative = (window as any).Capacitor?.isNative || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';

    if (isNative) {
      try {
        const cached = localStorage.getItem('cached_settings');
        if (cached) {
          const settings = JSON.parse(cached);
          if (settings.officialSiteUrl) {
            baseUrl = settings.officialSiteUrl.replace(/\/$/, '');
          }
        }
      } catch (e) {}
      if (!baseUrl) baseUrl = 'https://unitvfilms.vercel.app';
    }
  }
  
  const ext = type === 'movie' ? '.mp4' : '.mkv';
  return `${baseUrl}/${type}/${encodeURIComponent(username)}/${encodeURIComponent(password)}/${token}${ext}`;
}
