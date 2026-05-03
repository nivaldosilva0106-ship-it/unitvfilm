export interface MediaLink {
  title: string;
  url: string;
}

export interface Episode {
  season: number;
  episode: number;
  title: string;
  description?: string;
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
  duration?: number;
  playback_speed?: number;
  post_video_intervals?: number;
  post_video_ads?: number;
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
  watermark_position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  watermark_size?: number; // height scale (default 8 = h-8)
  main_video_id?: string;
  interval_urls?: string[]; // Legacy
  ad_urls?: string[]; // Legacy
  interval_list?: MediaLink[];
  ad_list?: MediaLink[];
  shuffle_intervals?: boolean;
  shuffle_ads?: boolean;
  break_frequency?: number;
  global_intervals_count?: number;
  global_ads_count?: number;
  post_break_logo_url?: string;
  watch_provider?: 'netflix' | 'amazon' | 'hbo' | 'disney' | 'apple' | 'hulu' | 'paramount' | 'starplus' | 'globoplay' | 'crunchyroll' | 'skyshowtime' | 'youtube' | 'other';
  external_sync_enabled?: boolean;
  external_source_url?: string;
}
