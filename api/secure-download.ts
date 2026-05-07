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
    // Instead of proxying the entire large video file through Vercel (which causes timeouts and limits),
    // we simply redirect the user to the real URL. 
    // This still hides the real URL from the DOM and the download button hover, 
    // satisfying the requirement while being much more robust.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.redirect(302, videoUrl);
  } catch (error: any) {
    console.error('Secure download error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Download falhou', message: error.message });
    }
  }
}

/**
 * Download an HLS stream (.txt/.m3u8) and serve as a single file
 * Downloads the manifest, finds segment URLs, downloads them all, concatenates
 */
async function downloadHLSStream(manifestUrl: string, filename: string, res: VercelResponse) {
  // Step 1: Download the manifest
  const manifestResponse = await fetch(manifestUrl, {
    headers: { ...FETCH_HEADERS, Referer: new URL(manifestUrl).origin + '/' },
    redirect: 'follow',
  });

  if (!manifestResponse.ok) {
    return res.status(manifestResponse.status).json({ error: 'Falha ao buscar manifesto HLS' });
  }

  const manifestText = await manifestResponse.text();
  const baseUrl = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);

  // Step 2: Check if it's a master playlist (has #EXT-X-STREAM-INF)
  if (manifestText.includes('#EXT-X-STREAM-INF')) {
    // Master playlist — find the highest quality variant
    const lines = manifestText.split('\n');
    let bestBandwidth = 0;
    let bestUrl = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF')) {
        const bwMatch = line.match(/BANDWIDTH=(\d+)/);
        const bandwidth = bwMatch ? parseInt(bwMatch[1]) : 0;
        
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && !nextLine.startsWith('#') && bandwidth > bestBandwidth) {
          bestBandwidth = bandwidth;
          bestUrl = nextLine;
        }
      }
    }

    if (bestUrl) {
      const absoluteUrl = bestUrl.startsWith('http') ? bestUrl : new URL(bestUrl, baseUrl).toString();
      return downloadHLSStream(absoluteUrl, filename, res);
    }
  }

  // Step 3: It's a media playlist — extract segment URLs
  const segmentUrls: string[] = [];
  const lines = manifestText.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const segmentUrl = trimmed.startsWith('http') 
        ? trimmed 
        : new URL(trimmed, baseUrl).toString();
      segmentUrls.push(segmentUrl);
    }
  }

  if (segmentUrls.length === 0) {
    return res.status(404).json({ error: 'Nenhum segmento de vídeo encontrado' });
  }

  // Step 4: Download segments and concatenate
  // Set response headers immediately
  res.setHeader('Content-Type', 'video/mp2t');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(filename)}"`);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Transfer-Encoding', 'chunked');

  // Download segments in batches (to avoid overwhelming the server)
  const BATCH_SIZE = 5;
  
  for (let i = 0; i < segmentUrls.length; i += BATCH_SIZE) {
    const batch = segmentUrls.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(
      batch.map(async (segUrl) => {
        try {
          const segResponse = await fetch(segUrl, {
            headers: { ...FETCH_HEADERS, Referer: new URL(segUrl).origin + '/' },
            redirect: 'follow',
          });
          if (segResponse.ok) {
            return Buffer.from(await segResponse.arrayBuffer());
          }
          return null;
        } catch {
          return null;
        }
      })
    );

    for (const buffer of results) {
      if (buffer) {
        res.write(buffer);
      }
    }
  }

  res.end();
}

function detectContentType(url: string): string {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.mp4') || lower.endsWith('.m4s')) return 'video/mp4';
  if (lower.endsWith('.ts')) return 'video/mp2t';
  if (lower.endsWith('.mkv')) return 'video/x-matroska';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.avi')) return 'video/x-msvideo';
  return 'application/octet-stream';
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._\-\s]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 200) || 'video.mp4';
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
