
interface EmbedPlayerResponse {
    movie?: boolean;
    dub?: boolean; // Dublado
    leg?: boolean; // Legendado
}

const BASE_URL = "https://embed.embedplayer.site";

// List of proxies to try
const PROXIES = [
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}` // corsproxy.io sometimes blocks free tier
];

// Simple fetch function with fallback
async function fetchWithFallback(targetUrl: string): Promise<any> {
    let lastError;

    // First try allorigins (most generous)
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
        console.log(`[EmbedPlayer] Trying proxy: ${proxyUrl}`);
        const response = await fetch(proxyUrl);
        if (response.ok) {
            return await response.json();
        }
        console.warn(`[EmbedPlayer] Proxy 1 failed: Status ${response.status}`);
    } catch (e) {
        console.warn(`[EmbedPlayer] Proxy 1 error:`, e);
        lastError = e;
    }

    // Try corsproxy.io as fallback
    try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        console.log(`[EmbedPlayer] Trying proxy: ${proxyUrl}`);
        const response = await fetch(proxyUrl);
        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.warn(`[EmbedPlayer] Proxy 2 error:`, e);
        lastError = e;
    }

    throw lastError || new Error("All proxies failed");
}

export const checkEmbedPlayerMovie = async (tmdbId: number): Promise<string | null> => {
    try {
        const targetUrl = `${BASE_URL}/dooplay?movie=${tmdbId}`;
        console.log(`[EmbedPlayer] Checking Movie: ${targetUrl}`);

        // Attempt to fetch
        const data: EmbedPlayerResponse = await fetchWithFallback(targetUrl);
        console.log("[EmbedPlayer] Response:", data);

        // PHP Logic: if($response->movie) ...
        if (data && data.movie) {
            return `${BASE_URL}/${tmdbId}`;
        }
        return null;
    } catch (error) {
        console.error("[EmbedPlayer] Error checking movie:", error);
        return null;
    }
};

export const checkEmbedPlayerEpisode = async (tmdbId: number, season: number, episode: number): Promise<string | null> => {
    try {
        const targetUrl = `${BASE_URL}/tv/${tmdbId}/${season}/${episode}/lang`;
        console.log(`[EmbedPlayer] Checking Episode: ${targetUrl}`);

        const data: EmbedPlayerResponse = await fetchWithFallback(targetUrl);
        console.log("[EmbedPlayer] Episode Response:", data);

        if (data && data.dub) {
            return `${BASE_URL}/tv/${tmdbId}/${season}/${episode}/dub`;
        }
        if (data && data.leg) {
            return `${BASE_URL}/tv/${tmdbId}/${season}/${episode}/leg`;
        }

        return null;
    } catch (error) {
        console.error("[EmbedPlayer] Error checking episode:", error);
        return null;
    }
};
