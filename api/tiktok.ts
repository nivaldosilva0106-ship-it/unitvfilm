import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const videoUrl = req.query.url as string;
    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing video URL' });
    }

    try {
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`TikWM returned status ${response.status}`);
        }

        const data = await response.json();

        if (data.code === 0 && data.data && data.data.play) {
            return res.status(200).json({
                url: data.data.play,
                title: data.data.title,
                cover: data.data.cover
            });
        }
        return res.status(500).json({ error: 'Failed to extract video', details: data.msg || 'Unknown API error' });
    } catch (error: any) {
        console.error('TikTok API Server Error:', error);
        return res.status(500).json({ 
            error: 'Server error', 
            details: error.message || 'Unknown error' 
        });
    }
}
