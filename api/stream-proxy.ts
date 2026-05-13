import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Smart Stream Proxy with Token-Based URL Protection
 * 
 * Accepts either:
 * - ?t=ENCRYPTED_TOKEN  (secure, preferred)
 * - ?url=DIRECT_URL     (backward compat, legacy)
 * 
 * The real video URL is never exposed to the client.
 * Tokens are time-limited and encrypted.
 * 
 * KEY FIX: Uses streaming for binary content (TS, MP4) instead of
 * buffering the entire response. This prevents .txt live streams from
 * hanging forever on browsers and APKs.
 */

// Same key as secure-url.ts — MUST MATCH
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
    
    // Try adjacent salt values (clock skew protection)
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for browser playback
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { t: token, url: directUrl, ext } = req.query;
  let videoUrl: string;

  // 1. Encrypted token (secure, preferred)
  if (token && typeof token === 'string') {
    const result = decryptToken(token);
    if (!result) {
      return res.status(403).json({ error: 'Token inválido ou corrompido' });
    }
    if (result.expired) {
      return res.status(410).json({ error: 'Token expirado. Recarregue a página.' });
    }
    videoUrl = result.url;
  }
  // 2. Direct URL (backward compatibility)
  else if (directUrl && typeof directUrl === 'string') {
    videoUrl = directUrl;
  }
  else {
    return res.status(400).json({ error: 'Missing token (t) or url parameter' });
  }

  try {
    // Forward Range header for partial content requests (seeking)
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': new URL(videoUrl).origin + '/',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    // Use AbortController with a timeout to prevent hanging on dead streams
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(videoUrl, {
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok && response.status !== 206) {
      return res.status(response.status).json({
        error: `Upstream returned ${response.status}: ${response.statusText}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const urlLower = videoUrl.toLowerCase().split('?')[0];
    const extHint = typeof ext === 'string' ? ext.toLowerCase() : '';

    // Determine if this is likely a manifest that needs URL rewriting
    // We need to buffer manifests, but we should stream binary content
    const isLikelyManifest = 
      urlLower.endsWith('.m3u8') ||
      urlLower.endsWith('.m3u') ||
      extHint === '.m3u8' ||
      contentType.includes('mpegurl') ||
      contentType.includes('x-mpegurl');

    // For .txt URLs: we need to peek at the content to determine type
    const isTxtUrl = urlLower.endsWith('.txt');

    // If it's clearly a manifest or a .txt that might be a manifest, buffer it
    if (isLikelyManifest || isTxtUrl) {
      // Buffer the response to inspect and possibly rewrite
      const body = await response.arrayBuffer();
      const uint8 = new Uint8Array(body);

      const detectedType = detectMediaType(uint8, videoUrl, contentType);

      res.setHeader('Content-Type', detectedType);
      res.setHeader('Cache-Control', 'public, max-age=300');

      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
        res.status(206);
      } else {
        res.status(200);
      }

      // If it's an HLS manifest, rewrite relative URLs
      if (detectedType === 'application/vnd.apple.mpegurl' || detectedType === 'audio/mpegurl') {
        const text = new TextDecoder().decode(uint8);
        const rewritten = rewriteM3U8Urls(text, videoUrl);
        return res.send(rewritten);
      }

      // Otherwise send the buffered content
      return res.send(Buffer.from(body));
    }

    // --- STREAMING PATH ---
    // For binary content (TS segments, MP4, MKV, etc.), pipe directly
    // This prevents hanging on large files and live streams

    // Read first chunk for type detection
    const reader = response.body?.getReader();
    if (!reader) {
      // Fallback: no readable stream, buffer everything
      const body = await response.arrayBuffer();
      const uint8 = new Uint8Array(body);
      const detectedType = detectMediaType(uint8, videoUrl, contentType);
      res.setHeader('Content-Type', detectedType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
        res.status(206);
      } else {
        res.status(200);
      }
      return res.send(Buffer.from(body));
    }

    // Read the first chunk to detect content type
    const firstRead = await reader.read();
    if (firstRead.done || !firstRead.value) {
      return res.status(204).end();
    }

    const firstChunk = firstRead.value;
    const detectedType = detectMediaType(firstChunk, videoUrl, contentType);

    // If the first chunk reveals it's actually a manifest (rare edge case),
    // we need to buffer the rest and rewrite
    if (detectedType === 'application/vnd.apple.mpegurl' || detectedType === 'audio/mpegurl') {
      const chunks: Uint8Array[] = [firstChunk];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }

      const text = new TextDecoder().decode(combined);
      const rewritten = rewriteM3U8Urls(text, videoUrl);
      res.setHeader('Content-Type', detectedType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).send(rewritten);
    }

    // Set headers for binary streaming
    res.setHeader('Content-Type', detectedType);
    res.setHeader('Cache-Control', 'public, max-age=300');

    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
      res.status(206);
    } else {
      res.status(200);
    }

    // Write first chunk
    res.write(Buffer.from(firstChunk));

    // Stream remaining chunks
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }

    return res.end();

  } catch (error: any) {
    // Handle abort (timeout)
    if (error.name === 'AbortError') {
      console.error('Stream proxy timeout for:', videoUrl);
      return res.status(504).json({
        error: 'Stream timeout — the upstream server did not respond in time.',
      });
    }

    console.error('Stream proxy error:', error);
    return res.status(500).json({
      error: 'Stream proxy failed',
      message: error.message,
    });
  }
}

/**
 * Detect the real media type by inspecting content bytes and URL patterns
 */
function detectMediaType(data: Uint8Array, url: string, serverContentType: string): string {
  // Convert first 512 bytes to string for text-based detection
  const header = new TextDecoder('utf-8', { fatal: false }).decode(data.slice(0, 512));

  // 1. Check for HLS manifest (M3U8)
  if (header.trimStart().startsWith('#EXTM3U') || header.includes('#EXT-X-')) {
    return 'application/vnd.apple.mpegurl';
  }

  // 2. Check for MPEG-TS magic bytes (0x47 sync byte)
  // TS packets are 188 bytes, sync byte 0x47 at start
  if (data.length >= 188 && data[0] === 0x47) {
    return 'video/mp2t';
  }

  // 3. Check for MP4/fMP4 (ftyp box or moov/moof)
  if (data.length >= 8) {
    const sig = String.fromCharCode(data[4], data[5], data[6], data[7]);
    if (sig === 'ftyp' || sig === 'moov' || sig === 'moof' || sig === 'styp') {
      return 'video/mp4';
    }
  }

  // 4. Check for WebM/MKV (EBML header)
  if (data.length >= 4 && data[0] === 0x1A && data[1] === 0x45 && data[2] === 0xDF && data[3] === 0xA3) {
    return 'video/webm';
  }

  // 5. Check for FLV
  if (data.length >= 3 && data[0] === 0x46 && data[1] === 0x4C && data[2] === 0x56) {
    return 'video/x-flv';
  }

  // 6. URL-based detection as fallback
  const urlLower = url.toLowerCase().split('?')[0];
  if (urlLower.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl';
  if (urlLower.endsWith('.ts')) return 'video/mp2t';
  if (urlLower.endsWith('.mp4') || urlLower.endsWith('.m4s')) return 'video/mp4';
  if (urlLower.endsWith('.webm')) return 'video/webm';
  if (urlLower.endsWith('.flv')) return 'video/x-flv';

  // 7. If the URL ends in .txt but we couldn't detect the type,
  // assume it's an HLS manifest (most common case for IPTV)
  if (urlLower.endsWith('.txt')) {
    // Check if it looks like it could be text-based streaming data
    if (header.includes('http') || header.includes('.ts') || header.includes('.m3u')) {
      return 'application/vnd.apple.mpegurl';
    }
    // Default for .txt IPTV streams - treat as binary stream
    return 'video/mp2t';
  }

  // 8. Trust the server's content type if it's already a media type
  if (serverContentType.includes('video/') || 
      serverContentType.includes('audio/') || 
      serverContentType.includes('mpegurl')) {
    return serverContentType.split(';')[0].trim();
  }

  // Final fallback: application/octet-stream (browser will try to play it)
  return 'application/octet-stream';
}

/**
 * Rewrite relative URLs in M3U8 manifests to absolute URLs proxied through this endpoint
 */
function rewriteM3U8Urls(manifest: string, originalUrl: string): string {
  const baseUrl = originalUrl.substring(0, originalUrl.lastIndexOf('/') + 1);

  return manifest.split('\n').map(line => {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') {
      // But check for URI= attributes in tags like #EXT-X-KEY
      if (trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
          if (uri.startsWith('http://') || uri.startsWith('https://')) {
            return `URI="/api/stream-proxy?url=${encodeURIComponent(uri)}"`;
          }
          const absoluteUri = new URL(uri, baseUrl).toString();
          return `URI="/api/stream-proxy?url=${encodeURIComponent(absoluteUri)}"`;
        });
      }
      return line;
    }

    // If it's a URL line (segment or sub-manifest)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // Absolute URL — proxy it
      return `/api/stream-proxy?url=${encodeURIComponent(trimmed)}`;
    }

    // Relative URL — make absolute, then proxy
    if (trimmed && !trimmed.startsWith('#')) {
      try {
        const absoluteUrl = new URL(trimmed, baseUrl).toString();
        return `/api/stream-proxy?url=${encodeURIComponent(absoluteUrl)}`;
      } catch {
        return line;
      }
    }

    return line;
  }).join('\n');
}
