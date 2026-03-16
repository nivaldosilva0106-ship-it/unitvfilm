import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const videoUrl = req.query.url as string;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing video URL' });
    }

    try {
        // Use TikWM API to get non-watermarked video URL
        const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(videoUrl)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.code === 0 && data.data && data.data.play) {
            // Return the direct high quality played video URL
            return res.status(200).json({
                url: data.data.play,
                title: data.data.title,
                cover: data.data.cover
            });
        } else {
            console.error('TikWM Error:', data);
            return res.status(500).json({ error: 'Failed to extract video from TikTok', details: data.msg });
        }
    } catch (error) {
        console.error('TikTok API Fetch error:', error);
        return res.status(500).json({ error: 'Internal Server Error while fetching TikTok data.' });
    }
}
