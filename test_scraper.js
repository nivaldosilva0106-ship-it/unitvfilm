const axios = require('axios');

async function scrapeMix(url) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        
        const match = data.match(/var ytInitialData = (\{.*?\});<\/script>/);
        if (!match) {
            console.log("No ytInitialData found");
            return;
        }
        
        let initialData;
        try {
           initialData = JSON.parse(match[1]);
        } catch(e) {
           console.log("Failed to parse", e);
           return;
        }
        
        let playlistContent = null;
        try {
            // Find the playlist panel
            const twoColumn = initialData.contents.twoColumnWatchNextResults.playlist;
            if (twoColumn && twoColumn.playlist) {
               playlistContent = twoColumn.playlist.contents;
            }
        } catch(e) {
            console.log("Not a watch playlist context");
        }
        
        if (!playlistContent) {
           console.log("Could not extract playlist contents");
           return;
        }
        
        const items = playlistContent.map(item => {
           let plItem = item.playlistPanelVideoRenderer;
           if (!plItem) return null;
           return {
               title: plItem.title?.simpleText || plItem.title?.runs?.[0]?.text,
               videoId: plItem.videoId
           };
        }).filter(Boolean);
        
        console.log("Found items:", items.length);
        console.log("First item:", items[0]);
    } catch(e) {
        console.error(e);
    }
}

scrapeMix('https://www.youtube.com/watch?v=AhWyTSYuXHM&list=RDAhWyTSYuXHM');
