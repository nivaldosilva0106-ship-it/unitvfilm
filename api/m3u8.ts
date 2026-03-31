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
            // Fallback to main video URL if no programs
            if (channel.video_url || channel.internal_player_url) {
                return res.redirect(302, channel.internal_player_url || channel.video_url);
            }
            return res.status(404).send('No content available for this channel');
        }

        // --- Deterministic Global Sync Logic (Same as Frontend) ---
        const SLOT_DURATION = 3600; // 1 hour
        const nowSec = Math.floor(Date.now() / 1000);
        
        // Channel ID as seed for shift
        const channelSalt = (channelId as string).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const globalTime = nowSec + channelSalt;
        
        const syncIndex = Math.floor(globalTime / SLOT_DURATION) % programs.length;
        const currentProgram = programs[syncIndex];

        // The URL to redirect to
        let finalUrl = currentProgram.internal_player_url || currentProgram.url;

        // If it's a TikTok URL, we might need to resolve it 
        // (but for M3U8 players, it's better to redirect to a direct link if possible)
        if (currentProgram.tiktok_url) {
            // Option: Call our own tiktok proxy logic here or redirect to it
            // For simplicity, we redirect to the tiktok resolver
            const protocol = req.headers['x-forwarded-proto'] || 'http';
            const host = req.headers.host;
            const resolverUrl = `${protocol}://${host}/api/tiktok?url=${encodeURIComponent(currentProgram.tiktok_url)}`;
            
            // Fetch the resolver to get the direct URL
            const resolveRes = await fetch(resolverUrl);
            const resolveData = await resolveRes.json();
            if (resolveData.url) {
                finalUrl = resolveData.url;
            }
        }

        if (!finalUrl) {
            return res.status(404).send('Current program has no valid URL');
        }

        // --- HLS Manifest Generation (TV Online Mode) ---
        const syncOffset = globalTime % SLOT_DURATION;
        
        // --- AD/INTERVAL LOGIC (Same as Frontend) ---
        const intervalUrls = channel.interval_urls || [];
        const adUrls = channel.ad_urls || [];
        
        // Use a default duration (e.g., 45 min) if not specified to allow ads/intervals to trigger
        const videoDuration = currentProgram.duration || 2700; 
        
        let playbackUrl = finalUrl;
        let playbackStartTime = syncOffset;
        let playbackTitle = currentProgram.title || 'Canal 24h';

        if (syncOffset >= videoDuration && (intervalUrls.length > 0 || adUrls.length > 0)) {
            const AD_SLOT = 60; // 1 min slots
            const gapOffset = syncOffset - videoDuration;
            const slotIdx = Math.floor(gapOffset / AD_SLOT);
            
            const isInterval = (slotIdx % 4 === 0) || adUrls.length === 0;
            const adUrl = isInterval && intervalUrls.length > 0 
                ? intervalUrls[slotIdx % intervalUrls.length]
                : adUrls[slotIdx % adUrls.length];

            if (adUrl) {
                playbackUrl = adUrl;
                playbackStartTime = gapOffset % AD_SLOT;
                playbackTitle = isInterval ? 'Intervalo' : 'Publicidade';
                
                // If the ad is a TikTok URL, resolve it too
                if (adUrl.includes('tiktok.com')) {
                    const protocol = req.headers['x-forwarded-proto'] || 'http';
                    const host = req.headers.host;
                    const resolverUrl = `${protocol}://${host}/api/tiktok?url=${encodeURIComponent(adUrl)}`;
                    try {
                        const resolveRes = await fetch(resolverUrl);
                        const resolveData = await resolveRes.json();
                        if (resolveData.url) playbackUrl = resolveData.url;
                    } catch(e) {}
                }
            }
        }

        // --- HLS Manifest Generation ---
        const hlsManifest = [
            '#EXTM3U',
            '#EXT-X-VERSION:3',
            '#EXT-X-TARGETDURATION:3600',
            '#EXT-X-MEDIA-SEQUENCE:0',
            '#EXT-X-PLAYLIST-TYPE:EVENT',
            `#EXTINF:3600.0, ${playbackTitle}`,
            `${playbackUrl}${playbackUrl.includes('?') ? '&' : '?'}t=${playbackStartTime}`
        ].join('\n');

        // Set Headers for M3U8 compatibility and no-caching
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Content-Disposition', 'inline; filename="playlist.m3u8"');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Access-Control-Allow-Origin', '*');

        return res.status(200).send(hlsManifest);

    } catch (error) {
        console.error('M3U8 Error:', error);
        return res.status(500).send('Internal Server Error');
    }
}
