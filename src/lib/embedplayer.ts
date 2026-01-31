
interface EmbedPlayerResponse {
    movie?: boolean;
    dub?: boolean; // Dublado
    leg?: boolean; // Legendado
}

const CORS_PROXY = "https://api.allorigins.win/raw?url=";
const BASE_URL = "https://embed.embedplayer.site";

export const checkEmbedPlayerMovie = async (tmdbId: number): Promise<string | null> => {
    try {
        const targetUrl = `${BASE_URL}/dooplay?movie=${tmdbId}`;
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`);
        if (!response.ok) return null;

        // The API might return JSON or just 200 OK.
        // PHP code: $response = @json_decode(curl_exec($ch)); if($response->movie) ...
        // So it returns JSON.
        const data: EmbedPlayerResponse = await response.json();

        if (data && data.movie) {
            return `${BASE_URL}/${tmdbId}`;
        }
        return null;
    } catch (error) {
        console.error("Error checking EmbedPlayer movie:", error);
        return null;
    }
};

export const checkEmbedPlayerEpisode = async (tmdbId: number, season: number, episode: number): Promise<string | null> => {
    try {
        const targetUrl = `${BASE_URL}/tv/${tmdbId}/${season}/${episode}/lang`;
        const response = await fetch(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`);
        if (!response.ok) return null;

        const data: EmbedPlayerResponse = await response.json();

        // Prioritize Dubbed (pt-BR)
        if (data && data.dub) {
            return `${BASE_URL}/tv/${tmdbId}/${season}/${episode}/dub`;
        }
        // Fallback to Subtitled
        if (data && data.leg) {
            return `${BASE_URL}/tv/${tmdbId}/${season}/${episode}/leg`;
        }

        return null;
    } catch (error) {
        console.error("Error checking EmbedPlayer episode:", error);
        return null;
    }
};
