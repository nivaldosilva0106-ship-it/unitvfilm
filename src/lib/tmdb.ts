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
  if (!path) return '';
  return `${IMAGE_BASE_URL}${path}`;
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
