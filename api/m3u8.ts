import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyAWr4do1UXOBd5Hd08OxNv-yztUOlH6wQM",
  databaseURL: "https://unitvfilm-678d5-default-rtdb.firebaseio.com/",
  projectId: "unitvfilm-678d5",
  appId: "1:989230761933:android:4ac80dd1790f962c996684"
};

if (!getApps().length) {
  initializeApp(firebaseConfig);
}

const database = getDatabase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { channelId } = req.query;

    if (!channelId) {
        return res.status(400).send('Missing channelId');
    }

    try {
        const snapshot = await get(ref(database, `contents/${channelId}`));
        if (!snapshot.exists()) {
            return res.status(404).send('Channel not found');
        }

        const channel = snapshot.val();
        const programs = channel.episodes || [];

        if (programs.length === 0) {
            if (channel.video_url || channel.internal_player_url) {
                return res.redirect(302, channel.internal_player_url || channel.video_url);
            }
            return res.status(404).send('No content available for this channel');
        }

        // --- Deterministic Global Sync Logic (Sequential Dynamic) ---
        const GAP_DURATION = 180; // 3 min mandatory interval/ads between programs
        const nowSec = Math.floor(Date.now() / 1000);
        
        const channelSalt = (channelId as string).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        
        let totalCycleSeconds = 0;
        const processedPrograms = programs.map((p: any) => {
            const start = totalCycleSeconds;
            const duration = p.duration || 1800;
            totalCycleSeconds = start + duration + GAP_DURATION;
            return { ...p, startTimeInCycle: start, endTimeInCycle: start + duration };
        });

        const timeInCycle = (nowSec + channelSalt) % totalCycleSeconds;
        let currentMatch = null;
        let isAdSlot = false;
        let playStartTime = 0;

        for (const prog of processedPrograms) {
            if (timeInCycle >= prog.startTimeInCycle && timeInCycle < prog.endTimeInCycle) {
                currentMatch = prog;
                playStartTime = timeInCycle - prog.startTimeInCycle;
                break;
            }
            if (timeInCycle >= prog.endTimeInCycle && timeInCycle < (prog.endTimeInCycle + GAP_DURATION)) {
                isAdSlot = true;
                playStartTime = timeInCycle - prog.endTimeInCycle;
                currentMatch = prog;
                break;
            }
        }

        if (!currentMatch) {
            currentMatch = processedPrograms[0];
            playStartTime = 0;
        }

        let finalUrl = currentMatch.internal_player_url || currentMatch.url;
        let playbackTitle = currentMatch.title || 'Canal 24h';
        let playbackUrl = finalUrl;
        let playbackStartTime = playStartTime;

        if (isAdSlot) {
            const intervalUrls = channel.interval_urls || [];
            const adUrls = channel.ad_urls || [];
            const slotIdx = Math.floor(playStartTime / 60);
            const isInterval = (slotIdx % 2 === 0) || adUrls.length === 0;
            const adUrl = isInterval && intervalUrls.length > 0 
                ? intervalUrls[slotIdx % intervalUrls.length]
                : adUrls[slotIdx % adUrls.length];
            
            playbackUrl = adUrl || finalUrl;
            playbackStartTime = playStartTime % 60;
            playbackTitle = isInterval ? 'Intervalo' : 'Publicidade';
        }

        // Respond with HLS Manifest
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache');
        
        const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:60
#EXT-X-PLAYLIST-TYPE:EVENT
#EXTINF:60,
#EXT-X-DISCONTINUITY
#EXT-X-START:TIME-OFFSET=${playbackStartTime}
#EXT-X-PROGRAM-DATE-TIME:${new Date().toISOString()}
#EXT-X-TITLE:${playbackTitle}
${playbackUrl}`;

        return res.status(200).send(manifest);

    } catch (error) {
        console.error("M3U8 Error:", error);
        return res.status(500).send('Internal Server Error');
    }
}
