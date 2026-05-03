import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Smart Stream Proxy
 * 
 * Solves the problem of video URLs that end in .txt or have incorrect
 * Content-Type headers (e.g., text/plain instead of application/vnd.apple.mpegurl).
 * 
 * This proxy fetches the content, detects the real media type by inspecting
 * the content, and re-serves it with the correct Content-Type header.
 * 
 * VLC can play these because it ignores Content-Type and sniffs the content.
 * Browsers/HLS.js need the correct Content-Type to work properly.
 * 
 * Usage: /api/stream-proxy?url=https://example.com/video.txt
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers for browser playback
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Forward Range header for partial content requests (seeking)
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': new URL(url).origin + '/',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await fetch(url, {
      headers,
      redirect: 'follow',
    });

    if (!response.ok && response.status !== 206) {
      return res.status(response.status).json({
        error: `Upstream returned ${response.status}: ${response.statusText}`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');

    // Read first chunk to detect content type
    const body = await response.arrayBuffer();
    const uint8 = new Uint8Array(body);

    // Detect the real content type by inspecting the data
    const detectedType = detectMediaType(uint8, url, contentType);

    // Set response headers
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

    // For HLS manifests (.m3u8 content), rewrite relative URLs to absolute
    if (detectedType === 'application/vnd.apple.mpegurl' || detectedType === 'audio/mpegurl') {
      const text = new TextDecoder().decode(uint8);
      const rewritten = rewriteM3U8Urls(text, url);
      return res.send(rewritten);
    }

    // For binary content (TS segments, MP4, etc.), send directly
    return res.send(Buffer.from(body));
  } catch (error: any) {
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
