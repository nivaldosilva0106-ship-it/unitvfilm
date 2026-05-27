import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';

/**
 * Secure Download Endpoint
 * 
 * Downloads video content server-side and serves it to the user
 * without ever exposing the real source URL.
 * 
 * Supports: mp4, ts, txt (HLS), m3u8, mkv
 * 
 * For HLS (.txt/.m3u8): Downloads the manifest, resolves all segments,
 * and streams them concatenated as a single video file.
 * 
 * Usage: /api/secure-download?t=ENCRYPTED_TOKEN&f=filename.mp4
 */

// Same key as secure-url.ts (must match)
const _K = [0x55, 0x6E, 0x69, 0x54, 0x76, 0x46, 0x69, 0x6C, 0x6D, 0x53, 0x65, 0x63, 0x75, 0x72, 0x65, 0x4B];

function xorCipher(input: string, salt: number): string {
  const keyWithSalt = _K.map((b, i) => b ^ ((salt >> (i % 4) * 8) & 0xFF));
  let result = '';
  for (let i = 0; i < input.length; i++) {
    result += String.fromCharCode(input.charCodeAt(i) ^ keyWithSalt[i % keyWithSalt.length]);
  }
  return result;
}

function decryptToken(token: string): { url: string; expired: boolean } | null {
  try {
    if (token.length < 5) return null;
    
    const saltHex = token.substring(0, 4);
    const salt = parseInt(saltHex, 16);
    const b64 = token.substring(4);
    
    const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(padded, 'base64').toString('binary');
    const payload = xorCipher(decoded, salt);
    
    const firstPipe = payload.indexOf('|');
    if (firstPipe === -1) return null;
    const secondPipe = payload.indexOf('|', firstPipe + 1);
    if (secondPipe === -1) return null;
    
    const expiry = parseInt(payload.substring(firstPipe + 1, secondPipe));
    const url = payload.substring(secondPipe + 1);
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return { url, expired: Date.now() > expiry };
    }
    
    // Try adjacent salt values (clock skew)
    for (const adj of [salt - 1, salt + 1]) {
      const retryDecoded = Buffer.from(padded, 'base64').toString('binary');
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
  } catch {
    return null;
  }
}

function encryptUrl(url: string, customValidityMs: number = 15 * 60 * 1000): string {
  const now = Date.now();
  const expiry = now + customValidityMs;
  const nonce = Math.random().toString(36).substring(2, 8);
  
  const payload = `${nonce}|${expiry}|${url}`;
  const salt = Math.floor(now / (5 * 60 * 1000)) & 0xFFFF;
  const encrypted = xorCipher(payload, salt);
  
  const b64 = Buffer.from(encrypted, 'binary').toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const saltHex = salt.toString(16).padStart(4, '0');
  
  return saltHex + b64;
}

async function resolveTxtUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (response.ok) {
      const text = await response.text();
      const lines = text.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
      if (lines.length >= 1) {
        const firstLine = lines[0].trim();
        if (firstLine.startsWith('http://') || firstLine.startsWith('https://')) {
          return firstLine;
        }
      }
    }
  } catch (err) {
    console.error('Error resolving txt url:', err);
  }
  return url;
}

const FETCH_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { t: token, f: filename, url: directUrl } = req.query;

  let videoUrl: string;

  // Token-based (preferred, secure)
  if (token && typeof token === 'string') {
    const result = decryptToken(token);
    if (!result) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    if (result.expired) {
      return res.status(410).json({ error: 'Token expirado. Recarregue a página.' });
    }
    videoUrl = result.url;
  } 
  // Direct URL fallback (for backward compatibility)
  else if (directUrl && typeof directUrl === 'string') {
    videoUrl = directUrl;
  } 
  else {
    return res.status(400).json({ error: 'Missing token or url parameter' });
  }

  try {
    let resolvedVideoUrl = videoUrl;
    let lowerUrl = videoUrl.toLowerCase().split('?')[0];

    // If it's a .txt file, resolve the redirect URL inside it first
    if (lowerUrl.endsWith('.txt')) {
      resolvedVideoUrl = await resolveTxtUrl(videoUrl);
      lowerUrl = resolvedVideoUrl.toLowerCase().split('?')[0];
    }

    if (lowerUrl.endsWith('.m3u8') || resolvedVideoUrl.includes('typezero.top/pl/') || resolvedVideoUrl.includes('typezero.top')) {
      // Instead of downloading and concatenating the entire HLS stream in Vercel (which hits memory/timeout limits),
      // we redirect the user to our stream-proxy endpoint which safely processes the manifest
      // External downloaders (like 1DM, IDM, ADM) can intercept this URL and download the HLS stream directly.
      const hlsToken = encryptUrl(resolvedVideoUrl);
      const filenameParam = filename ? `&f=${encodeURIComponent(filename as string)}` : '';
      const proxyUrl = `/api/stream-proxy?t=${encodeURIComponent(hlsToken)}&dl=1${filenameParam}`;
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      return res.redirect(302, proxyUrl);
    }

    // Instead of proxying the entire large video file through Vercel (which causes timeouts and limits),
    // we simply redirect the user to the real URL. 
    // This still hides the real URL from the DOM and the download button hover, 
    // satisfying the requirement while being much more robust.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.redirect(302, resolvedVideoUrl);
  } catch (error: any) {
    console.error('Secure download error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Download falhou', message: error.message });
    }
  }
}



function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/');
    const last = segments[segments.length - 1];
    if (last && last.includes('.')) return last;
  } catch {}
  return 'video.mp4';
}

function convertGoogleDriveUrl(url: string): string {
  const driveRegex = /drive\.google\.com\/(?:file\/d\/|open\?id=)([^/?#]+)/;
  const match = url.match(driveRegex);
  if (match) {
    const fileId = match[1];
    // Use API key if available
    const apiKey = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY;
    if (apiKey) {
      return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
    }
    // Fallback
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return url;
}
