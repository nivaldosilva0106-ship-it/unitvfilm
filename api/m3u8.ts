import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { channelId, format } = req.query;

    if (!channelId) {
        return res.status(400).send('Missing channelId');
    }

    try {
        const { data: channel, error } = await supabase
            .from('contents')
            .select('*')
            .eq('id', channelId)
            .maybeSingle();

        if (error || !channel) {
            console.error("Supabase error or channel not found:", error);
            return res.status(404).send('Channel not found');
        }

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
        const GAP_DURATION = 180;
        const nowSec = Math.floor(Date.now() / 1000);
        const channelSalt = (channelId as string).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

        let totalCycleSeconds = 0;
        const timeline = programs.map((p: any, i: number) => {
            const start = totalCycleSeconds;
            const dur = p.duration || 1800;
            const end = start + dur;
            totalCycleSeconds = end + GAP_DURATION;
            return { index: i, cycleStart: start, cycleEnd: end, dur, prog: p };
        });

        const timeInCycle = (nowSec + channelSalt) % totalCycleSeconds;

        let playbackUrl = '';
        let playbackTitle = 'Canal 24h';

        for (const slot of timeline) {
            if (timeInCycle >= slot.cycleStart && timeInCycle < slot.cycleEnd) {
                playbackUrl = slot.prog.internal_player_url || slot.prog.url || '';
                playbackTitle = slot.prog.title || 'Programa';
                break;
            }
            if (timeInCycle >= slot.cycleEnd && timeInCycle < slot.cycleEnd + GAP_DURATION) {
                const intervalUrls = channel.interval_urls || channel.interval_list || [];
                const adUrls = channel.ad_urls || channel.ad_list || [];
                const gapOffset = timeInCycle - slot.cycleEnd;
                const slotIdx = Math.floor(gapOffset / 60);
                const isInterval = (slotIdx % 2 === 0) || adUrls.length === 0;
                const adUrl = isInterval && intervalUrls.length > 0
                    ? intervalUrls[slotIdx % intervalUrls.length]
                    : (adUrls.length > 0 ? adUrls[slotIdx % adUrls.length] : '');

                playbackUrl = adUrl || slot.prog.internal_player_url || slot.prog.url || '';
                playbackTitle = isInterval ? 'Intervalo' : 'Publicidade';
                break;
            }
        }

        // Fallback
        if (!playbackUrl) {
            const first = programs[0];
            playbackUrl = first.internal_player_url || first.url || '';
            playbackTitle = first.title || 'Canal 24h';
        }

        // Resolve TikTok
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
        // RESPONSE: 302 redirect for VLC/IPTV compatibility
        // The external player only sees the m3u8 URL, the redirect
        // happens server-side so sniffers capture only this endpoint.
        // ============================================================
        
        // If format=m3u requested, return an M3U playlist
        if (format === 'm3u') {
            res.setHeader('Content-Type', 'audio/x-mpegurl');
            res.setHeader('Content-Disposition', `inline; filename="${channelId}.m3u"`);
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            const protocol = req.headers['x-forwarded-proto'] || 'https';
            const host = req.headers.host;
            const selfUrl = `${protocol}://${host}/api/m3u8?channelId=${channelId}`;
            
            const m3u = `#EXTM3U
#EXTINF:-1 tvg-name="${playbackTitle}" group-title="UnitVFilm",${playbackTitle}
${selfUrl}`;
            return res.status(200).send(m3u);
        }

        // Default: 302 redirect to the actual content
        // VLC, Smarters, IPTV players follow this redirect transparently
        // IDM and sniffers only see: /api/m3u8?channelId=xxx
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Now-Playing', playbackTitle);
        
        return res.redirect(302, playbackUrl);

    } catch (error) {
        console.error("M3U8 Error:", error);
        return res.status(500).send('Internal Server Error');
    }
}
