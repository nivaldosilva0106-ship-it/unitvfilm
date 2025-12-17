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
  internal_player_url?: string;
  is_new?: boolean;
  new_since?: string; // ISO timestamp // Player Próprio URL (m3u8, mp4, etc)
  video_urls?: string[]; // Multiple video sources
  episodes?: Episode[];
  download_url?: string;
  trailer_url?: string;
  language?: string;
  release_date?: string;
  tmdb_id?: number;
  rating?: number;
  isPremium?: boolean;

  // New Metadata
  cast?: string;
  duration?: string;
  year?: number;
  genre?: string[];
  backdrop_url?: string;

  // New Downloads
  download_mode?: 'direct' | 'torrent' | 'mixed';
  downloads?: {
    label: string;
    url: string;
    type?: 'direct' | 'torrent';
  }[];
}
