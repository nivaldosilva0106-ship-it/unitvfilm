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
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.code === 0 && data.data && data.data.play) {
            return res.status(200).json({
                url: data.data.play,
                title: data.data.title,
                cover: data.data.cover
            });
        }
        return res.status(500).json({ error: 'Failed to extract video', details: data.msg });
    } catch (error) {
        return res.status(500).json({ error: 'Server error' });
    }
}
