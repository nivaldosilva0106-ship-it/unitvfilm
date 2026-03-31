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

        // ============================================================
        // SAME SCHEDULING LOGIC AS Canais24h.tsx (Cumulative Dynamic)
        // ============================================================
        const GAP_DURATION = 180; // 3 min gap for ads/intervals between programs
        const nowSec = Math.floor(Date.now() / 1000);
        const channelSalt = (channelId as string).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

        // Build the cycle timeline
        let totalCycleSeconds = 0;
        const timeline = programs.map((p: any, i: number) => {
            const start = totalCycleSeconds;
            const dur = p.duration || 1800; // 30min fallback
            const end = start + dur;
            totalCycleSeconds = end + GAP_DURATION;
            return { index: i, cycleStart: start, cycleEnd: end, dur, prog: p };
        });

        const timeInCycle = (nowSec + channelSalt) % totalCycleSeconds;

        let playbackUrl = '';
        let playbackStartTime = 0;
        let playbackTitle = 'Canal 24h';
        let isAdSlot = false;

        for (const slot of timeline) {
            // Currently in a program
            if (timeInCycle >= slot.cycleStart && timeInCycle < slot.cycleEnd) {
                playbackUrl = slot.prog.internal_player_url || slot.prog.url || '';
                playbackStartTime = timeInCycle - slot.cycleStart;
                playbackTitle = slot.prog.title || 'Programa';
                break;
            }
            // Currently in the gap (ad/interval)
            if (timeInCycle >= slot.cycleEnd && timeInCycle < slot.cycleEnd + GAP_DURATION) {
                isAdSlot = true;
                const intervalUrls = channel.interval_urls || [];
                const adUrls = channel.ad_urls || [];
                const gapOffset = timeInCycle - slot.cycleEnd;
                const slotIdx = Math.floor(gapOffset / 60);
                const isInterval = (slotIdx % 2 === 0) || adUrls.length === 0;
                const adUrl = isInterval && intervalUrls.length > 0
                    ? intervalUrls[slotIdx % intervalUrls.length]
                    : (adUrls.length > 0 ? adUrls[slotIdx % adUrls.length] : '');

                playbackUrl = adUrl || slot.prog.internal_player_url || slot.prog.url || '';
                playbackStartTime = gapOffset % 60;
                playbackTitle = isInterval ? 'Intervalo' : 'Publicidade';
                break;
            }
        }

        // Fallback
        if (!playbackUrl) {
            const first = programs[0];
            playbackUrl = first.internal_player_url || first.url || '';
            playbackStartTime = 0;
            playbackTitle = first.title || 'Canal 24h';
        }

        // Resolve TikTok URLs
        if (playbackUrl.includes('tiktok.com')) {
            try {
                const protocol = req.headers['x-forwarded-proto'] || 'http';
                const host = req.headers.host;
                const resolverUrl = `${protocol}://${host}/api/tiktok?url=${encodeURIComponent(playbackUrl)}`;
                const resolveRes = await fetch(resolverUrl);
                const resolveData = await resolveRes.json();
                if (resolveData.url) playbackUrl = resolveData.url;
            } catch {}
        }

        if (!playbackUrl) {
            return res.status(404).send('No valid URL for current timeslot');
        }

        // ============================================================
        // HLS MANIFEST — Points IPTV players to the correct content
        // ============================================================
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');

        const manifest = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-ALLOW-CACHE:NO
#EXT-X-TARGETDURATION:60
#EXT-X-PLAYLIST-TYPE:EVENT
#EXTINF:60,${playbackTitle}
#EXT-X-DISCONTINUITY
#EXT-X-START:TIME-OFFSET=${playbackStartTime}
#EXT-X-PROGRAM-DATE-TIME:${new Date().toISOString()}
${playbackUrl}`;

        return res.status(200).send(manifest);

    } catch (error) {
        console.error("M3U8 Error:", error);
        return res.status(500).send('Internal Server Error');
    }
}
