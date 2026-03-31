import { useState, useRef } from "react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Play, Search, Trash, Loader2, Link as LinkIcon, Download, DownloadIcon, CheckCircle2, Clapperboard, MonitorPlay, Sparkles, X, Plus, PlusCircle, Maximize, AlertTriangle, ShieldCheck, ChevronUp, ChevronDown, Save, Lock, Bell, Upload, Film, Tv, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { searchMovies, searchSeries, getImageUrl, getMovieTrailer, getSeriesTrailer, getMovieDetails, getSeriesDetails, getSeasonDetails } from "@/lib/tmdb";
import { sendContentNotification, getAllContents, updateContent } from "@/lib/firebase";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Content, Episode } from "@/types/content";
import type { TMDBMovie, TMDBSeries } from "@/lib/tmdb";
import { AdminBulkUpdate } from "./AdminBulkUpdate";
import { getAutoEmbedMovie, getAutoEmbedEpisode } from "@/lib/embedplayer";

interface AdminContentFormProps {
  editingContent: Partial<Content>;
  setEditingContent: React.Dispatch<React.SetStateAction<Partial<Content>>>;
  handleSave: (sendNotification?: boolean) => Promise<void>;
}

const normalizeVideoUrl = (value?: string) => {
  if (!value) return value;
  const trimmed = value.trim();
  // Se for um iframe colado, extrai o src
  const match = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) return match[1];
  return trimmed;
};

export const AdminContentForm = ({ editingContent, setEditingContent, handleSave }: AdminContentFormProps) => {
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<(TMDBMovie | TMDBSeries)[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendNotification, setSendNotification] = useState(false);
  const [comandoPlayUrl, setComandoPlayUrl] = useState("");
  const [isImportingComando, setIsImportingComando] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [isImportingPlaylist, setIsImportingPlaylist] = useState(false);

  // --- Smart Import State ---
  const [smartConfigText, setSmartConfigText] = useState("");

  const handleSmartProcess = async () => {
    if (!smartConfigText.trim()) {
      toast.error("Cole o texto para processar");
      return;
    }

    const lines = smartConfigText.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) return;

    // Save current selection to avoid losing context
    const initialCategory = editingContent.category;
    const isNostalgiaSelected = initialCategory === 'nostalgia';
    const isSeriesSelected = initialCategory === 'series';
    const isCanais24hSelected = initialCategory === 'canais24h';

    // --- DETECT CATEGORY & CONTEXT ---
    const seasonHeaderPattern = /(?:temporada\s+(\d+)|(\d+)\s*temporada)/i;
    const seriesPattern = /(\d+)x(\d+)/;
    const hierarchicalPattern = /^(\d+\.\s*)?(.+?)\s*[-:]\s*(https?:\/\/[^\s]+)/i;
    const titlePattern = /^titulo:\s*(.*)/i;
    const tiktokPattern = /https?:\/\/(?:www\.)?tiktok\.com\/@[^\/]+\/video\/\d+/;

    // It's a series if it matches patterns OR if the user already selected a serial category OR contains TikTok links
    const isTikTok = lines.some(l => tiktokPattern.test(l));
    const isSeriesText = lines.some(l => seriesPattern.test(l) || seasonHeaderPattern.test(l) || hierarchicalPattern.test(l)) || isTikTok;
    const shouldHandleAsMultiple = isSeriesText || isSeriesSelected || isNostalgiaSelected || isCanais24hSelected;

    let extractedTitle = "";
    // If first line isn't a pattern, it's likely the title
    if (!seasonHeaderPattern.test(lines[0]) && !seriesPattern.test(lines[0]) && !hierarchicalPattern.test(lines[0])) {
      extractedTitle = lines[0].replace(/\(\d{4}\)/, '').trim();
    }

    if (shouldHandleAsMultiple) {
      toast.info(`Processando como lista de episódios...`);

      const finalCategory = isNostalgiaSelected ? 'nostalgia' : isCanais24hSelected ? 'canais24h' : (isSeriesSelected ? 'series' : 'series');

      // Update basic info if title found, or just ensure category
      setEditingContent(prev => ({
        ...prev,
        title: extractedTitle || prev.title,
        category: finalCategory
      }));

      const newEpisodes: Episode[] = [];
      let currentSeason = 1;

      const buildEpisodeURLs = (url: string, isGoogle: boolean) => {
        let finalUrl = isGoogle ? "" : url;
        let google_drive_url = isGoogle && isNostalgiaSelected ? url : "";
        let internal_player_url = (isGoogle && !isNostalgiaSelected && !isCanais24hSelected) ? url : "";
        let tiktok_url = "";

        if (isCanais24hSelected) {
          // In 24h channels, we want all URLs to populate the 'url' field (embed) 
          // as well as their specific fields for maximum compatibility
          finalUrl = url;
          if (url.includes('tiktok.com')) {
            tiktok_url = url;
          } else if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            internal_player_url = url;
          }
        }
        
        return { finalUrl, google_drive_url, internal_player_url, tiktok_url };
      };

      lines.forEach(line => {
        // Check for Season header
        const seasonMatch = line.match(seasonHeaderPattern);
        if (seasonMatch) {
          currentSeason = parseInt(seasonMatch[1] || seasonMatch[2]);
          return;
        }

        // Check for Title field ("Titulo: Nome")
        const titleMatch = line.match(titlePattern);
        if (titleMatch) {
          extractedTitle = titleMatch[1].trim();
          return;
        }

        // TikTok direct URL pattern
        const tiktokMatch = line.match(tiktokPattern);
        if (tiktokMatch) {
          const url = tiktokMatch[0].trim();
          const episodeNumber = newEpisodes.filter(e => e.season === currentSeason).length + 1;

          newEpisodes.push({
            season: currentSeason,
            episode: episodeNumber,
            title: extractedTitle || `Episódio ${episodeNumber}`,
            url: "",
            tiktok_url: url,
            downloads: []
          });
          return;
        }

        // Standard 1x1 pattern
        const epPatternMatch = line.match(/^(\d+)x(\d+)\s*(.*)/i);
        if (epPatternMatch) {
          const season = parseInt(epPatternMatch[1]);
          const episode = parseInt(epPatternMatch[2]);
          const remaining = epPatternMatch[3];

          const urlMatch = remaining.match(/https?:\/\/[^\s]+/);
          const title = remaining.replace(/https?:\/\/[^\s]+/, '').trim() || `Episódio ${episode}`;
          const url = urlMatch ? urlMatch[0] : "";
          const isGoogle = url.includes('googleapis.com');

          const urls = buildEpisodeURLs(url, isGoogle);

          newEpisodes.push({
            season,
            episode,
            title: title || (isCanais24hSelected ? `Vídeo ${episode}` : `Episódio ${episode}`),
            url: urls.finalUrl,
            google_drive_url: urls.google_drive_url,
            internal_player_url: urls.internal_player_url,
            tiktok_url: urls.tiktok_url,
            downloads: []
          });
          return;
        }

        // Hierarchical pattern: "1. 01 - URL" or "2. Title - URL"
        const hierarchicalMatch = line.match(hierarchicalPattern);
        if (hierarchicalMatch) {
          const rawTitle = hierarchicalMatch[2].trim();
          const url = hierarchicalMatch[3].trim();
          const isGoogle = url.includes('googleapis.com');

          // Use the rawTitle directly as the user requested ("01", "Ep X", "Nome")
          const episodeNumber = newEpisodes.filter(e => e.season === currentSeason).length + 1;

          const urls = buildEpisodeURLs(url, isGoogle);

          newEpisodes.push({
            season: currentSeason,
            episode: episodeNumber,
            title: rawTitle,
            url: urls.finalUrl,
            google_drive_url: urls.google_drive_url,
            internal_player_url: urls.internal_player_url,
            tiktok_url: urls.tiktok_url,
            downloads: []
          });
        }
      });

      if (newEpisodes.length > 0) {
        setEditingContent(prev => {
          const updatedEpisodes = [...(prev.episodes || []), ...newEpisodes];

          // Also fill top-level google_drive_url for Nostalgia if none exists
          let topGoogleDriveUrl = prev.google_drive_url;
          if (isNostalgiaSelected && !topGoogleDriveUrl) {
            topGoogleDriveUrl = newEpisodes.find(e => e.google_drive_url)?.google_drive_url || "";
          }

          return {
            ...prev,
            episodes: updatedEpisodes,
            google_drive_url: topGoogleDriveUrl
          };
        });

        toast.success(`${newEpisodes.length} episódios identificados!`);
        if (extractedTitle) {
          setTmdbSearchQuery(extractedTitle);
          handleTmdbSearch();
        }
      } else if (!extractedTitle) {
        toast.warning("Nenhum episódio ou título identificado no texto.");
      }

    } else {
      // --- MOVIE PARSING ---
      toast.info(`Detectado padrão de FILME. Processando...`);

      const urls = lines.flatMap(l => l.match(/https?:\/\/[^\s]+/g) || []);
      const googleApiUrl = urls.find(u => u.includes('googleapis.com')) || "";
      const otherUrls = urls.filter(u => u !== googleApiUrl);

      setEditingContent(prev => ({
        ...prev,
        title: extractedTitle || prev.title,
        category: initialCategory || 'movie', // Respect current or default to movie
        google_drive_url: googleApiUrl || prev.google_drive_url,
        internal_player_url: googleApiUrl || prev.internal_player_url,
        video_url: otherUrls[0] || prev.video_url,
        video_urls: otherUrls.length > 0 ? otherUrls : prev.video_urls
      }));

      if (extractedTitle) {
        toast.success("Links extraídos! Buscando metadados...");
        setTmdbSearchQuery(extractedTitle);
        searchMovies(extractedTitle).then(results => {
          setSearchResults(results);
        });
      } else {
        toast.success("Links extraídos com sucesso!");
      }
    }
  };

  const shuffleEpisodes = () => {
    if (!editingContent.episodes) return;
    const shuffled = [...editingContent.episodes].sort(() => Math.random() - 0.5);
    setEditingContent(prev => ({ ...prev, episodes: shuffled }));
    toast.success("Programação embaralhada!");
  };

  const orderEpisodes2by2 = () => {
    if (!editingContent.episodes) return;
    
    // Group by title
    const groups: { [key: string]: Episode[] } = {};
    editingContent.episodes.forEach(ep => {
      // Normalize title for grouping (e.g. "Simpsons - Ep 1" -> "Simpsons")
      const baseTitle = ep.title.split(/[\-\:]/)[0].trim();
      if (!groups[baseTitle]) groups[baseTitle] = [];
      groups[baseTitle].push(ep);
    });

    const ordered: Episode[] = [];
    const titles = Object.keys(groups);
    
    // Randomize initial title order
    const shuffledTitles = [...titles].sort(() => Math.random() - 0.5);
    const tempGroups = { ...groups };

    // This loop picks a title, takes 2 episodes, then moves to next title
    // to ensure variety but keep 2-by-2 groups
    let hasContents = true;
    while (hasContents) {
      hasContents = false;
      shuffledTitles.forEach(title => {
        const group = tempGroups[title];
        if (group.length > 0) {
          const batch = group.splice(0, 2);
          ordered.push(...batch);
          hasContents = true;
        }
      });
    }

    setEditingContent(prev => ({ ...prev, episodes: ordered }));
    toast.success("Programação organizada (2 em 2)!");
  };

  const isNostalgia = editingContent.category === 'nostalgia';
  const isTV = editingContent.category === 'tv';
  const isSeries = editingContent.category === 'series';
  const isMovie = editingContent.category === 'movie';
  const isCanais24h = editingContent.category === 'canais24h';

  // --- TMDB Handlers ---
  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;

    setIsSearching(true);
    try {
      const category = editingContent.category || "movie";
      const results = (category === "movie" || category === "nostalgia") // Nostalgia can use movie search or we might want to disable it
        ? await searchMovies(tmdbSearchQuery)
        : await searchSeries(tmdbSearchQuery);

      setSearchResults(results);
      toast.success(`${results.length} resultados encontrados`);
    } catch (error) {
      toast.error("Erro ao buscar no TMDB");
    } finally {
      setIsSearching(false);
    }
  };

  const handlePlaylistImport = async () => {
    if (!playlistUrl.trim()) {
      toast.error("Insira a URL da playlist");
      return;
    }

    setIsImportingPlaylist(true);
    try {
      // Extract Playlist ID
      const playlistIdMatch = playlistUrl.match(/[?&]list=([^#\&\?]+)/);
      const playlistId = playlistIdMatch ? playlistIdMatch[1] : null;

      if (!playlistId) {
        toast.error("ID da playlist não encontrado na URL");
        return;
      }

      // Load YouTube API Key from Firebase settings
      const { getSiteSettings } = await import('@/lib/firebase');
      const settings = await getSiteSettings();
      const API_KEY = settings.youtubeApiKey || "";

      if (!API_KEY) {
        toast.error("API Key do YouTube não configurada. Configure nas Configurações do Site.");
        setIsImportingPlaylist(false);
        return;
      }

      let allItems: any[] = [];
      let nextPageToken = "";
      let hasNextPage = true;

      while (hasNextPage) {
        const tokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : "";
        const response: Response = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${API_KEY}${tokenParam}`
        );

        if (!response.ok) {
          throw new Error("Falha ao buscar playlist do YouTube");
        }

        const data = await response.json();

        if (data.items) {
          allItems = [...allItems, ...data.items];
        }

        if (data.nextPageToken) {
          nextPageToken = data.nextPageToken;
        } else {
          hasNextPage = false;
        }
      }

      if (allItems.length === 0) {
        toast.error("Nenhum vídeo encontrado na playlist");
        return;
      }

      const newEpisodes: Episode[] = allItems.map((item: any, index: number) => ({
        season: 1,
        episode: (editingContent.episodes?.length || 0) + index + 1,
        title: item.snippet.title,
        url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`,
        downloads: []
      }));

      setEditingContent(prev => ({
        ...prev,
        episodes: [...(prev.episodes || []), ...newEpisodes]
      }));

      toast.success(`${newEpisodes.length} vídeos importados da playlist!`);
      setPlaylistUrl("");

    } catch (error) {
      console.error("Erro ao importar playlist:", error);
      toast.error("Erro ao importar playlist. Verifique a API Key e a URL.");
    } finally {
      setIsImportingPlaylist(false);
    }
  };

  const fillFromTMDB = async (item: TMDBMovie | TMDBSeries) => {
    console.log("Iniciando preenchimento TMDB para:", item);
    const isTVCategory = editingContent.category === 'tv' || editingContent.category === 'series';
    const isActuallySeries = isTVCategory || !('title' in item);

    let trailerUrl = '';
    let details: any = {};

    try {
      if (!isActuallySeries) {
        console.log("Detectado como Filme. Buscando ID:", item.id);
        trailerUrl = await getMovieTrailer(item.id);
        details = await getMovieDetails(item.id);
      } else {
        console.log("Detectado como Série/TV. Buscando ID:", item.id);
        trailerUrl = await getSeriesTrailer(item.id);
        details = await getSeriesDetails(item.id);
      }
    } catch (e) {
      console.error("Erro ao buscar detalhes fundamentais:", e);
    }

    console.log("Detalhes extraídos:", details);

    const cast = details?.credits?.cast?.slice(0, 5).map((c: any) => c.name).join(', ') || '';
    const castMembers = details?.credits?.cast?.slice(0, 10).map((c: any) => ({
      name: c.name,
      character: c.character,
      profile_path: c.profile_path ? getImageUrl(c.profile_path) : null
    })) || [];

    const duration = details?.runtime ? `${Math.floor(details.runtime / 60)}h ${details.runtime % 60}m` : '';
    const genres = details?.genres?.map((g: any) => g.name) || [];
    const backdrop = details?.backdrop_path ? getImageUrl(details.backdrop_path) : getImageUrl(item.backdrop_path);
    const releaseDate = !isActuallySeries ? (item as TMDBMovie).release_date : (item as TMDBSeries).first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear() : undefined;

    let fetchedEpisodes: Episode[] = [];
    if (isActuallySeries && details?.seasons) {
      toast.info("Buscando episódios das temporadas...");
      try {
        const seasonPromises = details.seasons
          .filter((s: any) => s.season_number > 0)
          .map((s: any) => getSeasonDetails(item.id, s.season_number));

        const seasonsData = await Promise.all(seasonPromises);

        seasonsData.forEach((season: any) => {
          if (season && season.episodes) {
            const eps: Episode[] = season.episodes.map((ep: any) => ({
              season: ep.season_number,
              episode: ep.episode_number,
              title: ep.name || 'Sem título',
              url: "",
              download_url: ""
            }));
            fetchedEpisodes = [...fetchedEpisodes, ...eps];
          }
        });
      } catch (error) {
        console.error("Erro ao buscar episódios:", error);
        toast.error("Erro ao carregar episódios de todas as temporadas");
      }
    }

    // --- AutoEmbed Integration ---
    let embedVideoUrl = "";

    // --- MOVIE ---
    if (!isActuallySeries) {
      embedVideoUrl = getAutoEmbedMovie(item.id);
      if (embedVideoUrl) {
        console.log("[AutoEmbed] Generated Movie URL:", embedVideoUrl);
        toast.success("Link AutoEmbed gerado!");
      }
    }

    let finalEpisodes = fetchedEpisodes.length > 0 ? fetchedEpisodes : editingContent.episodes;

    // --- TV / SERIES ---
    if (isActuallySeries && fetchedEpisodes.length > 0) {
      toast.info(`Gerando links AutoEmbed para ${fetchedEpisodes.length} episódios...`);

      const updatedEpisodes = fetchedEpisodes.map(ep => {
        const autoUrl = getAutoEmbedEpisode(item.id, ep.season, ep.episode);
        return {
          ...ep,
          url: autoUrl,
          internal_player_url: autoUrl
        };
      });

      finalEpisodes = updatedEpisodes;
      toast.success(`${updatedEpisodes.length} episódios atualizados com links AutoEmbed!`);
    }

    // Determine final Video URLs for Movies
    let finalVideoUrls = editingContent.video_urls || (editingContent.video_url ? [editingContent.video_url] : []);

    // Logic: If AutoEmbed generates a link, we want to ensure it's in the list.
    // Use Set to avoid duplicates if user clicks multiple times.
    if (embedVideoUrl) {
      const uniqueUrls = new Set(finalVideoUrls.filter(u => u.trim() !== ""));
      uniqueUrls.add(embedVideoUrl);
      finalVideoUrls = Array.from(uniqueUrls);

      // If empty, just set it
      if (finalVideoUrls.length === 0) finalVideoUrls = [embedVideoUrl];
    }

    setEditingContent(prev => ({
      ...prev,
      title: !isActuallySeries ? (item as TMDBMovie).title : (item as TMDBSeries).name,
      description: item.overview,
      thumbnail_url: getImageUrl(item.poster_path),
      trailer_url: trailerUrl,
      language: item.original_language,
      release_date: releaseDate,
      rating: item.vote_average,
      tmdb_id: item.id,
      // New Fields
      cast,
      cast_members: castMembers,
      duration,
      year,
      genre: genres,
      backdrop_url: backdrop,
      // Update both single and list fields for compatibility
      video_url: embedVideoUrl || prev.video_url,
      video_urls: finalVideoUrls.length > 0 ? finalVideoUrls : undefined,
      episodes: finalEpisodes
    }));
    setSearchResults([]);
    toast.success("Dados preenchidos com sucesso!" +
      (trailerUrl ? " (Trailer encontrado)" : "") +
      (fetchedEpisodes.length > 0 ? ` (${fetchedEpisodes.length} episódios adicionados)` : ""));
  };

  const handleComandoPlayImport = async () => {
    if (!comandoPlayUrl.trim()) {
      toast.error("Por favor, insira a URL do Comando Play");
      return;
    }

    let url;
    try {
      url = new URL(comandoPlayUrl);
      if (!url.hostname.includes('comandoplay.com')) {
        toast.error("A URL deve ser do site comandoplay.com");
        return;
      }
    } catch (e) {
      toast.error("URL inválida");
      return;
    }

    setIsImportingComando(true);
    const loadId = toast.loading("Buscando dados no Comando Play...");

    try {
      const proxyPath = `/comandoplay${url.pathname}${url.search}`;
      const response = await fetch(proxyPath);

      if (!response.ok) throw new Error("Falha ao acessar o site (Bloqueio ou 404)");

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const episodes: Episode[] = [];

      // Selectors for various Dooplay/Streaming themes
      const episodeElements = doc.querySelectorAll('.episodios li, .les-content li, .se-a li, .se-v li, ul.lista-episodios > li');

      console.log(`Encontrados ${episodeElements.length} elementos de lista.`);

      episodeElements.forEach((el) => {
        // Try multiple selectors for Title and Number
        const titleEl = el.querySelector('.ep-t, .title, .episodiotitle a, .episodiotitle, h3, .nome');
        const numEl = el.querySelector('.ep-n, .num, .numerando, .numero, .c-ep');

        let epTitle = titleEl?.textContent?.trim() || "";
        let epNumText = numEl?.textContent?.trim() || "";

        // Fallback: Check if title contains the number (e.g. "1x1 - Pilot")
        if (!epNumText && epTitle.match(/^\d+x\d+/)) {
          epNumText = epTitle.split('-')[0].trim();
        }

        let season = 1;
        let episode = episodes.length + 1;
        let finalTitle = epTitle;

        // PARSING LOGIC
        // 1. Try parsing "Season x Episode" from number element (Classic Dooplay: "1 x 1")
        if (epNumText) {
          const sxMatch = epNumText.match(/(\d+)\s*x\s*(\d+)/i);
          if (sxMatch) {
            season = parseInt(sxMatch[1]);
            episode = parseInt(sxMatch[2]);
          } else {
            // Just an episode number?
            const eMatch = epNumText.match(/(\d+)/);
            if (eMatch) episode = parseInt(eMatch[1]);
          }
        }

        // 2. Try parsing from Title if specific format "Temporada X Episódio Y : Nome"
        const fullMatch = epTitle.match(/Temporada\s*(\d+)\s*Episódio\s*(\d+)\s*[:|-]?\s*(.*)/i);
        if (fullMatch) {
          season = parseInt(fullMatch[1]);
          episode = parseInt(fullMatch[2]);
          finalTitle = fullMatch[3].trim();
        } else {
          // Cleanup title if it starts with "1x1" or "Episódio 1"
          finalTitle = finalTitle.replace(/^(\d+)\s*x\s*(\d+)\s*[-:]?\s*/i, '')
            .replace(/^Episódio\s*\d+\s*[-:]?\s*/i, '')
            .trim();
        }

        // If title ends up empty, make a generic one
        if (!finalTitle) finalTitle = `Episódio ${episode}`;

        episodes.push({
          season,
          episode,
          title: finalTitle,
          url: "",
          download_url: ""
        });
      });

      if (episodes.length === 0) {
        // Fallback to Scripts (JSON-LD or internal JS vars)
        const scriptTags = Array.from(doc.querySelectorAll('script'));
        scriptTags.forEach(s => {
          if (s.innerHTML.includes('episodes')) {
            // Common pattern in some themes
            const matches = s.innerHTML.matchAll(/"title":"Temporada\s*(\d+)\s*Episódio\s*(\d+)\s*:\s*([^"]+)"/gi);
            for (const match of matches) {
              episodes.push({
                season: parseInt(match[1]),
                episode: parseInt(match[2]),
                title: match[3].trim(),
                url: "",
                download_url: ""
              });
            }
          }
        });
      }

      if (episodes.length > 0) {
        // Deduplicate
        const uniqueEpisodes = episodes.filter((v, i, a) => a.findIndex(t => (t.season === v.season && t.episode === v.episode)) === i);

        // Sort
        uniqueEpisodes.sort((a, b) => {
          if (a.season !== b.season) return a.season - b.season;
          return a.episode - b.episode;
        });

        setEditingContent(prev => ({
          ...prev,
          episodes: uniqueEpisodes
        }));
        toast.success(`Sucesso! ${uniqueEpisodes.length} episódios importados.`);
      } else {
        toast.error("Não foram encontrados episódios. O layout do site pode ter mudado.");
      }
    } catch (error) {
      console.error("Erro na importação ComandoPlay:", error);
      toast.error("Erro ao importar. Verifique se o link está acessível.");
    } finally {
      setIsImportingComando(false);
      toast.dismiss(loadId);
    }
  };

  // --- Episode Handlers ---
  const addEpisode = () => {
    const currentEpisodes = editingContent.episodes || [];
    const lastEpisode = currentEpisodes[currentEpisodes.length - 1];
    const nextSeason = lastEpisode?.season || 1;
    const nextEpisode = lastEpisode?.season === nextSeason ? (lastEpisode?.episode || 0) + 1 : 1;

    setEditingContent(prev => ({
      ...prev,
      episodes: [...currentEpisodes, { season: nextSeason, episode: nextEpisode, title: "", url: "", download_url: "", internal_player_url: "", subtitle_url: "" }],
    }));
  };

  const removeAllEpisodes = () => {
    if (confirm("Tem certeza que deseja remover TODOS os episódios e temporadas?")) {
      setEditingContent(prev => ({ ...prev, episodes: [] }));
      toast.success("Todos os episódios foram removidos.");
    }
  };

  const removeEpisode = (index: number) => {
    const currentEpisodes = editingContent.episodes || [];
    setEditingContent(prev => ({
      ...prev,
      episodes: currentEpisodes.filter((_, i) => i !== index),
    }));
  };

  const moveEpisodeUp = (index: number) => {
    if (index === 0) return;
    setEditingContent(prev => {
      const eps = [...(prev.episodes || [])];
      [eps[index - 1], eps[index]] = [eps[index], eps[index - 1]];
      return { ...prev, episodes: eps };
    });
  };

  const moveEpisodeDown = (index: number) => {
    setEditingContent(prev => {
      const eps = [...(prev.episodes || [])];
      if (index === eps.length - 1) return prev;
      [eps[index + 1], eps[index]] = [eps[index], eps[index + 1]];
      return { ...prev, episodes: eps };
    });
  };

  const updateEpisode = (index: number, field: keyof Episode, value: string | number) => {
    const currentEpisodes = editingContent.episodes || [];
    const updated = [...currentEpisodes];
    updated[index] = { ...updated[index], [field]: value };
    setEditingContent(prev => ({
      ...prev,
      episodes: updated,
    }));
  };

  // Apply normalization on change for video URL
  const handleVideoUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const normalizedValue = normalizeVideoUrl(rawValue);
    setEditingContent(prev => ({ ...prev, video_url: normalizedValue }));
  };

  return (
    <Card className="p-6 bg-card border-border">

      <h2 className="text-xl font-semibold text-foreground mb-4">Adicionar/Editar Conteúdo</h2>

      <div className="space-y-4">
        <div>
          <Label>Categoria *</Label>
          <Select
            value={editingContent.category}
            onValueChange={(value) => {
              setEditingContent(prev => ({ ...prev, category: value as any }));
              setSearchResults([]); // Limpa resultados de busca ao mudar a categoria
            }}
          >
            <SelectTrigger className="bg-input border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="movie">Filme</SelectItem>
              <SelectItem value="series">Série</SelectItem>
              <SelectItem value="tv">TV</SelectItem>
              <SelectItem value="nostalgia">NostalgiaTube</SelectItem>
              <SelectItem value="canais24h">Canais 24 Horas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-4 p-4 bg-secondary/30 rounded-lg border border-border">
          {/* Premium Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-full ${editingContent.isPremium ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                <Lock className={`w-5 h-5 ${editingContent.isPremium ? 'fill-current' : ''}`} />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="isPremium" className="cursor-pointer font-medium text-base">Conteúdo Premium</Label>
                <span className="text-xs text-muted-foreground">Requer assinatura ativa para assistir</span>
              </div>
            </div>
            <Switch
              id="isPremium"
              checked={editingContent.isPremium || false}
              onCheckedChange={(checked) => setEditingContent(prev => ({ ...prev, isPremium: checked }))}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          {/* New Content Toggle */}
          <div className="flex items-center justify-between border-t border-border/50 pt-4">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-full ${editingContent.is_new &&
                editingContent.new_since &&
                (new Date().getTime() - new Date(editingContent.new_since).getTime() < 86400000)
                ? 'bg-red-500/20 text-red-500'
                : 'bg-muted text-muted-foreground'
                }`}>
                <Sparkles className={`w-5 h-5 ${editingContent.is_new &&
                  editingContent.new_since &&
                  (new Date().getTime() - new Date(editingContent.new_since).getTime() < 86400000)
                  ? 'fill-current'
                  : ''
                  }`} />
              </div>
              <div className="flex flex-col">
                <Label className="cursor-pointer font-medium text-base">Conteúdo Novo</Label>
                <span className="text-xs text-muted-foreground">Destacar como novidade por 24 horas</span>
              </div>
            </div>
            <Switch
              checked={
                !!(editingContent.is_new &&
                  editingContent.new_since &&
                  (new Date().getTime() - new Date(editingContent.new_since).getTime() < 86400000))
              }
              onCheckedChange={(checked) => {
                setEditingContent(prev => ({
                  ...prev,
                  is_new: checked,
                  new_since: checked ? new Date().toISOString() : undefined
                }));
              }}
              className="data-[state=checked]:bg-red-600"
            />
          </div>

          {/* Cinema Mode Toggle */}
          <div className="flex items-center justify-between border-t border-border/50 pt-4">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-full ${editingContent.is_cinema_mode ? 'bg-amber-500/20 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                <Clapperboard className={`w-5 h-5 ${editingContent.is_cinema_mode ? 'fill-current' : ''}`} />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="cinemaMode" className="cursor-pointer font-medium text-base">Gravação de Cinema / Com Anúncios</Label>
                <span className="text-xs text-muted-foreground">Exibe aviso antes de iniciar e modal explicativo</span>
              </div>
            </div>
            <Switch
              id="cinemaMode"
              checked={editingContent.is_cinema_mode || false}
              onCheckedChange={(checked) => setEditingContent(prev => ({ ...prev, is_cinema_mode: checked }))}
              className="data-[state=checked]:bg-amber-600"
            />
          </div>

          {/* AdBlock Friendly Toggle */}
          {/* AdBlock Friendly Toggle */}
          <div className="flex items-center justify-between border-t border-border/50 pt-4">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-full ${editingContent.adBlockFriendly ? 'bg-amber-500/20 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                <ShieldCheck className={`w-5 h-5 ${editingContent.adBlockFriendly ? 'fill-current' : ''}`} />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="adBlockFriendly" className="cursor-pointer font-medium text-base">Aviso de Anúncios / Pop-ups</Label>
                <span className="text-xs text-muted-foreground">Exibe aviso sobre janelas pop-up no player</span>
              </div>
            </div>
            <Switch
              id="adBlockFriendly"
              checked={editingContent.adBlockFriendly || false}
              onCheckedChange={(checked) => setEditingContent(prev => ({ ...prev, adBlockFriendly: checked }))}
              className="data-[state=checked]:bg-amber-600"
            />
          </div>
        </div>

        {(!isTV && !isCanais24h) && (
          <div className="space-y-2">
            <Label>Buscar no TMDB</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Digite o título..."
                value={tmdbSearchQuery}
                onChange={(e) => setTmdbSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTmdbSearch()}
                className="bg-input border-border"
              />
              <Button onClick={handleTmdbSearch} disabled={isSearching}>
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-2 mt-2">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 bg-secondary rounded cursor-pointer hover:bg-secondary/80 flex items-center gap-3"
                    onClick={() => fillFromTMDB(item)}
                  >
                    <img
                      src={getImageUrl(item.poster_path)}
                      alt=""
                      className="w-12 h-16 object-cover rounded"
                    />
                    <div>
                      <p className="font-semibold text-sm">{'title' in item ? item.title : item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {'release_date' in item ? item.release_date : item.first_air_date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isSeries && (
          <div className="space-y-2 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <Label className="flex items-center gap-2 text-primary font-semibold">
              <Sparkles className="w-4 h-4" /> Importar Episódios do ComandoPlay
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Cole o link da série (ex: https://comandoplay.com/the-boys/)"
                value={comandoPlayUrl}
                onChange={(e) => setComandoPlayUrl(e.target.value)}
                className="bg-input border-border min-w-0"
              />
              <Button
                onClick={handleComandoPlayImport}
                disabled={isImportingComando}
                variant="outline"
                className="border-primary text-primary hover:bg-primary/10 whitespace-nowrap"
              >
                {isImportingComando ? "Importando..." : "Importar"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              Use esta ferramenta se o TMDB não tiver os nomes dos episódios em português.
            </p>
          </div>
        )}

        <div>
          <Label>Título *</Label>
          <Input
            value={editingContent.title || ''}
            onChange={(e) => setEditingContent(prev => ({ ...prev, title: e.target.value }))}
            className="bg-input border-border"
          />
        </div>

        <div>
          <Label>Descrição</Label>
          <Textarea
            value={editingContent.description || ''}
            onChange={(e) => setEditingContent(prev => ({ ...prev, description: e.target.value }))}
            className="bg-input border-border min-h-[100px]"
          />
        </div>

        {/* New Metadata Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Elenco</Label>
            <Input
              value={editingContent.cast || ''}
              onChange={e => setEditingContent(prev => ({ ...prev, cast: e.target.value }))}
              className="bg-input border-border"
              placeholder="Ator 1, Ator 2..."
            />
          </div>
          <div>
            <Label>Gêneros</Label>
            <Input
              value={editingContent.genre?.join(', ') || ''}
              onChange={e => setEditingContent(prev => ({ ...prev, genre: e.target.value.split(',').map(s => s.trim()) }))}
              className="bg-input border-border"
              placeholder="Ação, Drama..."
            />
          </div>
          <div>
            <Label>Duração</Label>
            <Input
              value={editingContent.duration || ''}
              onChange={e => setEditingContent(prev => ({ ...prev, duration: e.target.value }))}
              className="bg-input border-border"
              placeholder="2h 15m"
            />
          </div>
          <div>
            <Label>Ano</Label>
            <Input
              type="number"
              value={editingContent.year || ''}
              onChange={e => setEditingContent(prev => ({ ...prev, year: parseInt(e.target.value) }))}
              className="bg-input border-border"
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <Label>URL Imagem de Fundo (Backdrop)</Label>
            <Input
              value={editingContent.backdrop_url || ''}
              onChange={e => setEditingContent(prev => ({ ...prev, backdrop_url: e.target.value }))}
              className="bg-input border-border"
              placeholder="https://..."
            />
            {editingContent.backdrop_url && (
              <img src={editingContent.backdrop_url} className="mt-2 w-full h-32 object-cover rounded-md border border-white/10" />
            )}
          </div>
          {isCanais24h && (
            <div>
              <Label className="text-primary">URL da Logo do Canal (Watermark) *</Label>
              <Input
                value={editingContent.channel_logo_url || ''}
                onChange={(e) => setEditingContent(prev => ({ ...prev, channel_logo_url: e.target.value }))}
                className="bg-input border-primary/30 focus:border-primary"
                placeholder="https://... (Aparecerá no canto do player)"
              />
              {editingContent.channel_logo_url && (
                <img src={editingContent.channel_logo_url} className="mt-2 h-12 w-auto object-contain rounded bg-black/40 p-1 border border-white/10" />
              )}
            </div>
          )}
        </div>

        <div>
          <Label>URL da Imagem de Capa *</Label>
          <Input
            value={editingContent.thumbnail_url || ''}
            onChange={(e) => setEditingContent(prev => ({ ...prev, thumbnail_url: e.target.value }))}
            className="bg-input border-border"
            placeholder="https://..."
          />
          {editingContent.thumbnail_url && (
            <img src={editingContent.thumbnail_url} className="mt-2 w-24 h-36 object-cover rounded-md border border-white/10" />
          )}
        </div>

        {(isMovie || isTV) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>URLs do Vídeo {isTV ? '(TV ao Vivo)' : '(Filme)'}</Label>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const currentUrls = editingContent.video_urls || [editingContent.video_url || ''];
                  setEditingContent(prev => ({
                    ...prev,
                    video_urls: [...currentUrls, ''],
                    video_url: currentUrls[0] || '' // Keep first URL in video_url for compatibility
                  }));
                }}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar URL
              </Button>
            </div>

            <div className="space-y-2">
              {((editingContent.video_urls && editingContent.video_urls.length > 0)
                ? editingContent.video_urls
                : [editingContent.video_url || '']
              ).map((url, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <Input
                      value={url}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        const normalizedValue = normalizeVideoUrl(rawValue);
                        const currentUrls = editingContent.video_urls || [editingContent.video_url || ''];
                        const updatedUrls = [...currentUrls];
                        updatedUrls[index] = normalizedValue || '';
                        setEditingContent(prev => ({
                          ...prev,
                          video_urls: updatedUrls,
                          video_url: updatedUrls[0] || '' // Keep first URL in video_url
                        }));
                      }}
                      className="bg-input border-border"
                      placeholder={`Player ${index + 1} - https://... (se colar um iframe, extrairemos o src)`}
                    />
                  </div>
                  {((editingContent.video_urls?.length || 1) > 1) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        const currentUrls = editingContent.video_urls || [editingContent.video_url || ''];
                        const updatedUrls = currentUrls.filter((_, i) => i !== index);
                        setEditingContent(prev => ({
                          ...prev,
                          video_urls: updatedUrls.length > 0 ? updatedUrls : undefined,
                          video_url: updatedUrls[0] || ''
                        }));
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Cole URLs dos players. Se colar um iframe, extrairemos automaticamente o src. Adicione múltiplas fontes para permitir que usuários escolham entre diferentes players.
            </p>

            <div className="pt-2 border-t border-border mt-4 space-y-3">
              <Label>URL do Player Interno (m3u8, mp4, ts)</Label>
              <div className="flex gap-2">
                <Input
                  value={editingContent.internal_player_url || ''}
                  onChange={(e) => setEditingContent(prev => ({ ...prev, internal_player_url: e.target.value }))}
                  className="bg-input border-border flex-1"
                  placeholder="https://... (URL direta para arquivo m3u8, mp4, etc)"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (editingContent.internal_player_url) {
                      setPreviewUrl(editingContent.internal_player_url);
                      setShowPreview(true);
                    } else {
                      toast.error("Insira uma URL para visualizar");
                    }
                  }}
                  className="border-primary text-primary hover:bg-primary/10"
                >
                  Testar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                URL direta do arquivo de vídeo para usar o player nativo do próprio site (suporta HLS/m3u8, Google Drive, mp4, ts).
              </p>

              {showPreview && previewUrl && (
                <div className="relative rounded-lg overflow-hidden border border-border bg-black">
                  <div className="flex items-center justify-between bg-secondary/50 px-3 py-2">
                    <span className="text-xs text-muted-foreground truncate flex-1">{previewUrl}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(false)}
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="aspect-video">
                    <VideoPlayer
                      url={previewUrl}
                      title="Preview do Player"
                      poster={editingContent.thumbnail_url}
                      autoPlay={false}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-border mt-2">
                <Label>URL da Legenda (VTT)</Label>
                <Input
                  value={editingContent.subtitle_url || ''}
                  onChange={(e) => setEditingContent(prev => ({ ...prev, subtitle_url: e.target.value }))}
                  className="bg-input border-border"
                  placeholder="https://... (URL direta para arquivo .vtt)"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  URL direta do arquivo de legenda no formato WebVTT (.vtt).
                </p>
              </div>
            </div>
          </div>
        )}

        {(isSeries || isNostalgia || isCanais24h) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{isCanais24h ? "Blocos de Programação / Vídeos do Canal" : "Episódios / Temporadas"}</Label>
              <Button
                type="button"
                size="sm"
                onClick={addEpisode}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-1" />
                {isCanais24h ? "Adicionar Bloco" : "Adicionar Episódio"}
              </Button>
            </div>

            {isCanais24h && (
              <div className="flex flex-wrap gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                <p className="w-full text-xs font-bold text-primary mb-1 uppercase tracking-wider">Ferramentas de Programação:</p>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={shuffleEpisodes}
                  className="border-primary/40 text-primary hover:bg-primary/10"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Aleatório (Embaralhar)
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={orderEpisodes2by2}
                  className="border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Ordem (2 em 2 Episódios)
                </Button>
              </div>
            )}

            {isNostalgia && (
              <div className="flex gap-2 items-center mb-4 p-4 bg-red-900/10 border border-red-900/20 rounded-lg">
                <Input
                  placeholder="URL da Playlist do YouTube (Extrair vídeos automaticamente)"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  className="bg-input border-border"
                />
                <Button
                  onClick={handlePlaylistImport}
                  disabled={isImportingPlaylist}
                  className="whitespace-nowrap bg-[#FF0000] hover:bg-[#CC0000] text-white"
                >
                  {isImportingPlaylist ? "Carregando..." : "Importar Playlist"}
                </Button>
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(editingContent.episodes || []).map((episode, index) => (
                <div key={index} className="flex gap-2 items-start p-3 bg-secondary/50 rounded-lg">
                  {isCanais24h && (
                    <div className="flex flex-col gap-1 items-center justify-center pt-2">
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEpisodeUp(index)} disabled={index === 0}>
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <span className="text-xs font-mono">{index + 1}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEpisodeDown(index)} disabled={index === (editingContent.episodes || []).length - 1}>
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Temp."
                        value={episode.season || ''}
                        onChange={(e) => updateEpisode(index, 'season', parseInt(e.target.value) || 1)}
                        className={`bg-input border-border text-sm ${isCanais24h ? 'hidden' : ''}`}
                        min="1"
                      />
                      <Input
                        type="number"
                        placeholder={isCanais24h ? "Ordem" : "Ep."}
                        value={episode.episode || ''}
                        onChange={(e) => updateEpisode(index, 'episode', parseInt(e.target.value) || 1)}
                        className={`bg-input border-border text-sm ${isCanais24h ? 'col-span-2' : ''}`}
                        min="1"
                      />
                    </div>
                    <Input
                      placeholder={isCanais24h ? "Nome do Bloco de Programação / Título" : "Título do episódio"}
                      value={episode.title}
                      onChange={(e) => updateEpisode(index, 'title', e.target.value)}
                      className="bg-input border-border text-sm"
                    />
                    <Input
                      placeholder="URL do episódio (embed)"
                      value={episode.url}
                      onChange={(e) => updateEpisode(index, 'url', e.target.value)}
                      className="bg-input border-border text-sm"
                    />

                    {isNostalgia && (
                      <>
                        <Input
                          placeholder="URL API Google Drive (ex: https://www.googleapis.com/drive/v3/files/ID?alt=media&key=KEY)"
                          value={episode.google_drive_url || ''}
                          onChange={(e) => updateEpisode(index, 'google_drive_url', e.target.value)}
                          className="bg-input border-border text-sm border-blue-500/30"
                        />
                        <Input
                          placeholder="Link do TikTok (ex: https://www.tiktok.com/@user/video/ID)"
                          value={episode.tiktok_url || ''}
                          onChange={(e) => updateEpisode(index, 'tiktok_url', e.target.value)}
                          className="bg-input border-border text-sm border-pink-500/30"
                        />
                      </>
                    )}


                    {!isNostalgia && (
                      <>
                        <div className="flex gap-2">
                          <Input
                            placeholder="URL Player Interno (m3u8, mp4, ts)"
                            value={episode.internal_player_url || ''}
                            onChange={(e) => updateEpisode(index, 'internal_player_url', e.target.value)}
                            className="bg-input border-border text-sm flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (episode.internal_player_url) {
                                setPreviewUrl(episode.internal_player_url);
                                setShowPreview(true);
                              } else {
                                toast.error("Insira uma URL para visualizar");
                              }
                            }}
                            className="border-primary text-primary hover:bg-primary/10 h-10 w-10 flex-shrink-0"
                            title="Testar Player Interno"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        </div>
                        <Input
                          placeholder="URL da Legenda (VTT)"
                          value={episode.subtitle_url || ''}
                          onChange={(e) => updateEpisode(index, 'subtitle_url', e.target.value)}
                          className="bg-input border-border text-sm"
                        />
                        <Input
                          placeholder="URL de download (opcional - legado)"
                          value={episode.download_url || ''}
                          onChange={(e) => updateEpisode(index, 'download_url', e.target.value)}
                          className="bg-input border-border text-sm"
                        />
                      </>
                    )}

                    {/* Episode Download Configuration */}
                    <div className="p-3 border border-white/10 rounded-lg bg-black/20 space-y-3">
                      <Label className="text-xs font-semibold flex items-center gap-1">
                        <DownloadIcon className="w-3 h-3" /> Configuração de Downloads (Episódio)
                      </Label>

                      <div className="flex gap-4 items-center">
                        <Label className="text-xs">Modo:</Label>
                        <Select
                          value={episode.download_mode || 'direct'}
                          onValueChange={(v) => updateEpisode(index, 'download_mode', v as any)}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs bg-input border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="direct">Direto</SelectItem>
                            <SelectItem value="torrent">Torrent</SelectItem>
                            <SelectItem value="mixed">Misto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        {(episode.downloads || []).map((link, linkIdx) => (
                          <div key={linkIdx} className="flex gap-2 items-start">
                            <Input
                              value={link.label}
                              onChange={e => {
                                const currentEp = editingContent.episodes?.[index];
                                if (!currentEp) return;
                                const newLinks = [...(currentEp.downloads || [])];
                                newLinks[linkIdx] = { ...newLinks[linkIdx], label: e.target.value };
                                updateEpisode(index, 'downloads', newLinks as any);
                              }}
                              placeholder="Título"
                              className="w-1/3 bg-input border-border text-xs h-8"
                            />
                            <Input
                              value={link.url}
                              onChange={e => {
                                const currentEp = editingContent.episodes?.[index];
                                if (!currentEp) return;
                                const newLinks = [...(currentEp.downloads || [])];
                                newLinks[linkIdx] = { ...newLinks[linkIdx], url: e.target.value };
                                updateEpisode(index, 'downloads', newLinks as any);
                              }}
                              placeholder="URL"
                              className="flex-1 bg-input border-border text-xs h-8"
                            />
                            {episode.download_mode === 'mixed' && (
                              <Select
                                value={link.type || 'direct'}
                                onValueChange={v => {
                                  const currentEp = editingContent.episodes?.[index];
                                  if (!currentEp) return;
                                  const newLinks = [...(currentEp.downloads || [])];
                                  newLinks[linkIdx] = { ...newLinks[linkIdx], type: v as any };
                                  updateEpisode(index, 'downloads', newLinks as any);
                                }}
                              >
                                <SelectTrigger className="w-[80px] h-8 text-xs bg-input border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="direct">Direto</SelectItem>
                                  <SelectItem value="torrent">Torrent</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                const currentEp = editingContent.episodes?.[index];
                                if (!currentEp) return;
                                const newLinks = (currentEp.downloads || []).filter((_, i) => i !== linkIdx);
                                updateEpisode(index, 'downloads', newLinks as any);
                              }}
                            >
                              <Trash className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const currentEp = editingContent.episodes?.[index];
                            if (!currentEp) return;
                            const newLinkType = episode.download_mode === 'torrent' ? 'torrent' : 'direct';
                            const newLinks = [...(currentEp.downloads || []), { label: '', url: '', type: newLinkType }];
                            updateEpisode(index, 'downloads', newLinks as any);
                          }}
                        >
                          Adicionar Link
                        </Button>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeEpisode(index)}
                        className="h-8"
                      >
                        <Trash className="w-4 h-4 mr-2" /> {isCanais24h ? "Remover Bloco" : "Remover Episódio"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {
                (!editingContent.episodes || editingContent.episodes.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum episódio adicionado. Clique em "Adicionar Episódio" para começar.
                  </p>
                )
              }
            </div >
            <div className="flex gap-2 mb-4">
              <Button onClick={addEpisode} className="bg-primary hover:bg-primary/90 flex-1">
                <PlusCircle className="w-5 h-5 mr-2" />
                {isCanais24h ? "Adicionar Bloco" : "Adicionar Episódio"}
              </Button>
              <Button onClick={removeAllEpisodes} variant="destructive" className="bg-red-600 hover:bg-red-700" title="Apagar TUDO">
                <Trash className="w-5 h-5 mr-2" />
                Remover TUDO
              </Button>
            </div>
          </div >
        )}

        {
          !isTV && (
            <>
              <div>
                <Label>URL do Trailer</Label>
                <Input
                  value={editingContent.trailer_url || ''}
                  onChange={(e) => setEditingContent(prev => ({ ...prev, trailer_url: e.target.value }))}
                  className="bg-input border-border"
                  placeholder="https://youtube.com/... (preenchido automaticamente)"
                />
              </div>

              {isNostalgia && (
                <div className="mt-4 space-y-4">
                  <div>
                    <Label className="text-blue-400 font-bold">URL Google Drive (API Direct Link)</Label>
                    <Input
                      value={editingContent.google_drive_url || ''}
                      onChange={(e) => setEditingContent(prev => ({ ...prev, google_drive_url: e.target.value }))}
                      className="bg-input border-blue-500/30 text-blue-100 placeholder:text-blue-300/30"
                      placeholder="https://www.googleapis.com/drive/v3/files/ID?alt=media&key=KEY"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 italic leading-relaxed">
                      Use o formato da API do Google Drive para evitar bloqueios de iframe. <br />
                      <span className="text-blue-400">Ex:</span> https://www.googleapis.com/drive/v3/files/<span className="underline">FILE_ID</span>?alt=media&key=<span className="underline">API_KEY</span>
                    </p>
                  </div>

                  <div>
                    <Label className="text-pink-400 font-bold">Link do TikTok</Label>
                    <Input
                      value={editingContent.tiktok_url || ''}
                      onChange={(e) => setEditingContent(prev => ({ ...prev, tiktok_url: e.target.value }))}
                      className="bg-input border-pink-500/30 text-pink-100 placeholder:text-pink-300/30"
                      placeholder="https://www.tiktok.com/@user/video/71234567890"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 italic leading-relaxed">
                      Cole o link do vídeo do TikTok para reprodução direta no player.
                    </p>
                  </div>
                </div>
              )}
            </>
          )
        }

        {
          isMovie && (
            <div className="space-y-4 p-4 border border-white/10 rounded-lg bg-black/20">
              <h3 className="font-semibold flex items-center gap-2">
                <DownloadIcon className="w-4 h-4" /> Configuração de Downloads
              </h3>

              <div className="space-y-3">
                <Label>Modo de Download</Label>
                <RadioGroup
                  value={editingContent.download_mode || 'direct'}
                  onValueChange={(v) => setEditingContent(prev => ({ ...prev, download_mode: v as any }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="direct" id="d-direct" />
                    <Label htmlFor="d-direct">Direto (MP4/MKV)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="torrent" id="d-torrent" />
                    <Label htmlFor="d-torrent">Torrent</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mixed" id="d-mixed" />
                    <Label htmlFor="d-mixed">Misto</Label>
                  </div>
                </RadioGroup>

                {editingContent.download_mode === 'mixed' && (
                  <p className="text-xs text-yellow-500">
                    No modo Misto, você pode definir o tipo (Direto/Torrent) para cada link individualmente.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Links de Download</Label>
                {(editingContent.downloads || []).map((link, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <Input
                      value={link.label}
                      onChange={e => {
                        const newLinks = [...(editingContent.downloads || [])];
                        newLinks[idx].label = e.target.value;
                        setEditingContent(prev => ({ ...prev, downloads: newLinks }));
                      }}
                      placeholder="Título (ex: 4K Dual Audio)"
                      className="w-1/3 bg-input border-border"
                    />
                    <Input
                      value={link.url}
                      onChange={e => {
                        const newLinks = [...(editingContent.downloads || [])];
                        newLinks[idx].url = e.target.value;
                        setEditingContent(prev => ({ ...prev, downloads: newLinks }));
                      }}
                      placeholder="URL"
                      className="flex-1 bg-input border-border"
                    />
                    {editingContent.download_mode === 'mixed' && (
                      <Select
                        value={link.type || 'direct'}
                        onValueChange={v => {
                          const newLinks = [...(editingContent.downloads || [])];
                          newLinks[idx].type = v as any;
                          setEditingContent(prev => ({ ...prev, downloads: newLinks }));
                        }}
                      >
                        <SelectTrigger className="w-[100px] bg-input border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="direct">Direto</SelectItem>
                          <SelectItem value="torrent">Torrent</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        const newLinks = (editingContent.downloads || []).filter((_, i) => i !== idx);
                        setEditingContent(prev => ({ ...prev, downloads: newLinks }));
                      }}
                    >
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newLinkType: 'direct' | 'torrent' = editingContent.download_mode === 'torrent' ? 'torrent' : 'direct';
                    const newLinks = [...(editingContent.downloads || []), { label: '', url: '', type: newLinkType }];
                    setEditingContent(prev => ({ ...prev, downloads: newLinks }));
                  }}
                >
                  <PlusCircle className="w-4 h-4 mr-2" /> Adicionar Link
                </Button>
              </div>
            </div>
          )
        }

      </div>

      {/* Smart Import Section - MOVED HERE */}
      <div className="mt-8 p-6 bg-[#1a1c23] rounded-xl border border-primary/20 shadow-lg shadow-primary/5">
        <div className="flex items-center gap-2 mb-4 text-primary">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-bold text-lg">Importação Inteligente (Texto/WhatsApp)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              Cole o texto completo com Título e Links (Google Drive, APIs, Embeds).
              O sistema detectará automaticamente se é Filme ou Série e organizará os episódios.
            </p>
            <div className="bg-secondary/20 p-3 rounded-lg border border-border/50">
              <p className="text-[11px] font-bold text-primary mb-2 uppercase tracking-wider">Formato Suportado:</p>
              <div className="space-y-2 font-mono text-[10px] text-gray-500">
                <p className="text-gray-300">Temporada 1</p>
                <p>1. Nome do Episódio - URL</p>
                <p>2. Outro Episódio - URL</p>
              </div>
            </div>
          </div>

          <Textarea
            value={smartConfigText}
            onChange={e => setSmartConfigText(e.target.value)}
            placeholder={`Cole seu texto aqui...\n\nExemplo:\nTodo Mundo Em Pânico 3\nhttps://...\n\nOu:\nTemporada 1\n1. Piloto - https://...`}
            className="min-h-[160px] bg-background border-border focus:border-primary/50 font-mono text-xs"
          />
        </div>

        <Button onClick={handleSmartProcess} className="w-full h-12 gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-base shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          <Sparkles className="w-5 h-5" /> Processar e Preencher Agora
        </Button>
      </div>

      {isCanais24h && editingContent.id && (
        <div className="mt-6 p-6 bg-gradient-to-br from-zinc-900 to-black rounded-xl border border-primary/30 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-primary/20 rounded-lg">
              <MonitorPlay className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Transmissão M3U8 Profissional</h3>
              <p className="text-xs text-zinc-400">URL para reprodutores externos (VLC, Smarters, etc)</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative group">
              <Input 
                readOnly
                value={`${window.location.origin}/api/m3u8?channelId=${editingContent.id}`}
                className="bg-black/50 border-white/10 pr-24 font-mono text-xs text-primary h-11"
              />
              <Button 
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/api/m3u8?channelId=${editingContent.id}`);
                  toast.success("URL M3U8 copiada!");
                }}
                className="absolute right-1 top-1 bottom-1 bg-primary hover:bg-primary/90 text-white px-4 h-9"
              >
                Copiar
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-zinc-300">Compatível com IPTV</p>
                  <p className="text-[10px] text-zinc-500">Funciona em Smart TVs e Boxes Android.</p>
                </div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-zinc-300">Sync Automático</p>
                  <p className="text-[10px] text-zinc-500">Sempre o mesmo que passa no site.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AdminBulkUpdate />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Idioma</Label>
          <Input
            value={editingContent.language || ''}
            onChange={(e) => setEditingContent(prev => ({ ...prev, language: e.target.value }))}
            className="bg-input border-border"
          />
        </div>
        <div>
          <Label>Data de Lançamento</Label>
          <Input
            type="date"
            value={editingContent.release_date || ''}
            onChange={(e) => setEditingContent(prev => ({ ...prev, release_date: e.target.value }))}
            className="bg-input border-border"
          />
        </div>
      </div>

      {/* Notification Toggle */}
      <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-full ${sendNotification ? 'bg-blue-500/20 text-blue-500' : 'bg-muted text-muted-foreground'}`}>
            <Bell className={`w-5 h-5 ${sendNotification ? 'fill-current' : ''}`} />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="sendNotification" className="cursor-pointer font-medium text-base">Enviar Notificação aos Usuários</Label>
            <span className="text-xs text-muted-foreground">Notificar todos os usuários sobre este conteúdo</span>
          </div>
        </div>
        <Switch
          id="sendNotification"
          checked={sendNotification}
          onCheckedChange={setSendNotification}
          className="data-[state=checked]:bg-blue-600"
        />
      </div>

      <Button onClick={() => handleSave(sendNotification)} className="w-full bg-primary hover:bg-primary/90 glow-effect-hover">
        <Save className="w-4 h-4 mr-2" />
        Salvar Conteúdo
      </Button>
    </Card>
  );
};