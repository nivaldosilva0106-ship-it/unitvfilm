import type { VercelRequest, VercelResponse } from '@vercel/node';

// Chave idêntica ao secure-url.ts
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

async function resolveTxtUrl(rawUrl: string): Promise<string | null> {
  if (rawUrl.match(/\.(mp4|mkv|m3u8|ts)$/i)) {
    return rawUrl;
  }

  if (rawUrl.endsWith('.txt')) {
    try {
      const response = await fetch(rawUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) return null;
      
      const textContent = await response.text();
      const mediaRegex = /https?:\/\/[^\s"'<>]+?\.(mp4|mkv|m3u8|ts)(?:\?[^\s"'<>]*)?/i;
      const match = textContent.match(mediaRegex);
      
      if (match && match[0]) {
        return match[0];
      }
    } catch (error) {
      console.error('Erro ao resolver .txt no servidor:', error);
    }
  }

  return rawUrl;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'ID de stream ausente' });
  }

  // Limpa extensão (ex: 4075.mp4 -> 4075)
  // No nosso caso, o ID será o token encriptado que o frontend gerou
  const token = id.replace(/\.(mp4|mkv|ts|m3u8)$/i, '');

  const result = decryptToken(token);
  if (!result) {
    return res.status(403).json({ error: 'Stream ID (Token) inválido' });
  }
  if (result.expired) {
    return res.status(410).json({ error: 'Stream expirado' });
  }

  const rawUrl = result.url;
  
  // Extrai a URL verdadeira de dentro do .txt
  const resolvedUrl = await resolveTxtUrl(rawUrl);
  
  if (!resolvedUrl) {
    return res.status(404).json({ error: 'Mídia não encontrada no destino' });
  }

  // Como o app APK espera redirecionamento 302 direto ou um proxy,
  // Para .txt IPTV, se a URL resolvida for m3u8 ou ts, podemos redirecionar 
  // diretamente para a rota api/stream-proxy original passando a URL resolvida,
  // ou fazer o redirect puro para o player seguir.
  // Vamos encaminhar internamente para stream-proxy se precisar de proxy de Range,
  // ou responder com 302.
  
  const forceProxy = resolvedUrl.includes('.m3u8') || process.env.FORCE_PROXY === 'true';
  
  if (!forceProxy) {
    // Redirecionamento 302 transparente - Players Android seguem
    res.redirect(302, resolvedUrl);
  } else {
    // Encaminha para o motor original que tem suporte pesado a HLS/Range
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const proxyUrl = `${protocol}://${host}/api/stream-proxy?url=${encodeURIComponent(resolvedUrl)}&ext=.m3u8`;
    res.redirect(302, proxyUrl);
  }
}
