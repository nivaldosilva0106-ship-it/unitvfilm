
const BASE_URL = "https://player.autoembed.cc/embed";

export const getAutoEmbedMovie = (tmdbId: number): string => {
    return `${BASE_URL}/movie/${tmdbId}`;
};

export const getAutoEmbedEpisode = (tmdbId: number, season: number, episode: number): string => {
    return `${BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
};
