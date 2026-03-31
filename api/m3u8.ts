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

        // Set Cache-Control to avoid being stuck on an old video in some players
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        return res.redirect(302, finalUrl);

    } catch (error) {
        console.error('M3U8 Error:', error);
        return res.status(500).send('Internal Server Error');
    }
}
