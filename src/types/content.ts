export interface Episode {
  season: number;
  episode: number;
  title: string;
  url: string;
  download_url?: string;
}

export interface Content {
  id: string;
  title: string;
  category: 'movie' | 'series' | 'tv';
  description: string;
  thumbnail_url: string;
  video_url: string;
  episodes?: Episode[];
  download_url?: string;
  trailer_url?: string;
  language?: string;
  release_date?: string;
  tmdb_id?: number;
  rating?: number;
  isPremium?: boolean;
}
