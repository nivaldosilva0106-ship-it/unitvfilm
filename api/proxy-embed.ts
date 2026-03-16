import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const targetUrl = req.query.url as string;

    if (!targetUrl) {
        return res.status(400).send('Missing URL parameter');
    }

    try {
        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            return res.status(response.status).send(`Failed to fetch target URL: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && !contentType.includes('text/html')) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            res.setHeader('Content-Type', contentType);
            return res.send(buffer);
        }

        let html = await response.text();
        const urlObj = new URL(targetUrl);
        const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

        // Script to override window.open and disable popups
        const injectedScript = `
      <script>
        // Override popup functions
        window.open = function() { console.log("[Proxy] Blocked a popup."); return null; };
        
        // Prevent clicking target="_blank" links
        document.addEventListener('click', function(e) {
            const target = e.target.closest('a');
            if (target && target.target === '_blank') {
                e.preventDefault();
                console.log("[Proxy] Blocked a click from opening a new tab.");
            }
        }, true);
      </script>
    `;

        // Inject the base tag and the anti-popup script
        const headEndIndex = html.toLowerCase().indexOf('</head>');
        if (headEndIndex !== -1) {
            html = html.substring(0, headEndIndex) +
                `\\n<base href="${baseUrl}/">\\n${injectedScript}\\n` +
                html.substring(headEndIndex);
        } else {
            html = `<base href="${baseUrl}/">\\n${injectedScript}\\n` + html;
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=0, stale-while-revalidate=0');
        return res.status(200).send(html);

    } catch (error) {
        console.error('Proxy error:', error);
        return res.status(500).send('Internal Server Error while proxying.');
    }
}
