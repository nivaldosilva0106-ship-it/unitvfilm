export interface Episode {
  season: number;
  episode: number;
  title: string;
  url: string;
  internal_player_url?: string; // URL for internal player (m3u8, mp4, ts)
  subtitle_url?: string; // URL for VTT subtitles
  download_url?: string; // Legacy
  download_mode?: 'direct' | 'torrent' | 'mixed';
  downloads?: {
    label: string;
    url: string;
    type?: 'direct' | 'torrent';
  }[];
  google_drive_url?: string;
  tiktok_url?: string;
}

export interface Content {
  id: string;
  title: string;
  category: 'movie' | 'series' | 'tv' | 'nostalgia' | 'canais24h';
  description: string;
  thumbnail_url: string;
  video_url: string;
  internal_player_url?: string;
  subtitle_url?: string; // URL for VTT subtitles
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
  likes?: number;
  dislikes?: number;
  user_vote?: 'like' | 'dislike'; // Local state helper

  // New Metadata
  classification?: 'L' | '10' | '12' | '14' | '16' | '18';
  cast?: string;
  duration?: string;
  year?: number;
  genre?: string[];
  backdrop_url?: string;
  adBlockFriendly?: boolean;

  // New Downloads
  download_mode?: 'direct' | 'torrent' | 'mixed';
  downloads?: {
    label: string;
    url: string;
    type?: 'direct' | 'torrent';
  }[];
  is_cinema_mode?: boolean;
  cast_members?: { name: string; character: string; profile_path: string | null }[];
  google_drive_url?: string;
  tiktok_url?: string;
  channel_logo_url?: string;
  main_video_id?: string;
}
