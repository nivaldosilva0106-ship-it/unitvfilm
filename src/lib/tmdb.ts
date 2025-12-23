import axios from 'axios';

const TMDB_API_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJmYmRiYTBiNzIzODg2YmM3NGFjZWYyZjU4ZmRkN2IxNiIsIm5iZiI6MTY5NzYzMDk0My42ODEsInN1YiI6IjY1MmZjYWRmY2FlZjJkMDExY2M3OTMxMSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.F0apjKGkawprS2uRGY-9sqbYBGcFlIRmLyL-mEJ6EJo';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const tmdbApi = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: `Bearer ${TMDB_API_TOKEN}`,
  },
});

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  release_date: string;
  vote_average: number;
  original_language: string;
}

export interface TMDBSeries {
  id: number;
  name: string;
  overview: string;
  poster_path: string;
  backdrop_path: string;
  first_air_date: string;
  vote_average: number;
  original_language: string;
}

export const searchMovies = async (query: string) => {
  const response = await tmdbApi.get('/search/movie', {
    params: { query, language: 'pt-BR' },
  });
  return response.data.results;
};

export const searchSeries = async (query: string) => {
  const response = await tmdbApi.get('/search/tv', {
    params: { query, language: 'pt-BR' },
  });
  return response.data.results;
};

export const getImageUrl = (path: string) => {
  if (!path) return '/placeholder.svg';
  return `${IMAGE_BASE_URL}${path}`;
};

// Fetch content rating/classification from TMDB
export const getContentRating = async (tmdbId: number, type: 'movie' | 'tv'): Promise<string | null> => {
  try {
    const endpoint = type === 'movie'
      ? `/movie/${tmdbId}/release_dates`
      : `/tv/${tmdbId}/content_ratings`;

    const response = await tmdbApi.get(endpoint);

    if (type === 'movie') {
      // Find Brazilian rating (BR)
      const brRelease = response.data.results.find((r: any) => r.iso_3166_1 === 'BR');
      if (brRelease && brRelease.release_dates && brRelease.release_dates.length > 0) {
        const certification = brRelease.release_dates[0].certification;
        return certification || null;
      }
    } else {
      // TV Series
      const brRating = response.data.results.find((r: any) => r.iso_3166_1 === 'BR');
      if (brRating && brRating.rating) {
        return brRating.rating;
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching content rating from TMDB:', error);
    return null;
  }
};

export const getMovieTrailer = async (movieId: number) => {
  try {
    const response = await tmdbApi.get(`/movie/${movieId}/videos`, {
      params: { language: 'pt-BR' },
    });
    const videos = response.data.results;
    const trailer = videos.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') || videos[0];
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '';
  } catch (error) {
    return '';
  }
};

export const getSeriesTrailer = async (seriesId: number) => {
  try {
    const response = await tmdbApi.get(`/tv/${seriesId}/videos`, {
      params: { language: 'pt-BR' },
    });
    const videos = response.data.results;
    const trailer = videos.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube') || videos[0];
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : '';
  } catch (error) {
    return '';
  }
};

export const getMovieDetails = async (id: number) => {
  try {
    const response = await tmdbApi.get(`/movie/${id}`, {
      params: {
        language: 'pt-BR',
        append_to_response: 'credits,images'
      }
    });
    return response.data;
  } catch (e) {
    console.error(e);
    return null;
  }
}

export const getSeriesDetails = async (id: number) => {
  try {
    const response = await tmdbApi.get(`/tv/${id}`, {
      params: {
        language: 'pt-BR',
        append_to_response: 'credits,images'
      }
    });
    return response.data;
  } catch (e) {
    console.error(e);
    return null;
  }
};

export const getSeasonDetails = async (seriesId: number, seasonNumber: number) => {
  try {
    const response = await tmdbApi.get(`/tv/${seriesId}/season/${seasonNumber}`, {
      params: { language: 'pt-BR' },
    });

    // Se não houver episódios, tentamos em inglês
    if (!response.data || !response.data.episodes || response.data.episodes.length === 0) {
      console.log(`Dados PT-BR ausentes para S${seasonNumber}, tentando EN-US...`);
      const engResponse = await tmdbApi.get(`/tv/${seriesId}/season/${seasonNumber}`, {
        params: { language: 'en-US' },
      });
      return engResponse.data;
    }

    return response.data;
  } catch (e) {
    console.warn(`Erro ao buscar temporada em PT-BR para ID ${seriesId}:`, e);
    try {
      const engResponse = await tmdbApi.get(`/tv/${seriesId}/season/${seasonNumber}`, {
        params: { language: 'en-US' },
      });
      return engResponse.data;
    } catch (err) {
      console.error("Falha fatal ao buscar temporada em ambos idiomas:", err);
      return null;
    }
  }
};
