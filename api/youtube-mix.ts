import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const url = req.query.url as string;

    if (!url) {
        return res.status(400).json({ error: 'Missing YouTube Mix URL' });
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        const html = await response.text();

        const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
        if (!match) {
            return res.status(404).json({ error: 'No playlist data found' });
        }

        let initialData;
        try {
            initialData = JSON.parse(match[1]);
        } catch(e) {
            return res.status(500).json({ error: 'Failed to parse ytInitialData' });
        }
        
        let playlistContent = null;
        try {
            const twoColumn = initialData?.contents?.twoColumnWatchNextResults?.playlist;
            if (twoColumn && twoColumn.playlist) {
               playlistContent = twoColumn.playlist.contents;
            }
        } catch(e) {
            // Context not found
        }

        if (!playlistContent) {
           return res.status(500).json({ error: 'Could not extract playlist contents' });
        }

        const items = playlistContent.map((item: any) => {
           const plItem = item.playlistPanelVideoRenderer;
           if (!plItem) return null;
           return {
               title: plItem.title?.simpleText || plItem.title?.runs?.[0]?.text,
               videoId: plItem.videoId
           };
        }).filter(Boolean);

        return res.status(200).json({ items });

    } catch (error) {
        console.error('YouTube Mix Fetch error:', error);
        return res.status(500).json({ error: 'Internal Server Error while fetching Mix' });
    }
}
