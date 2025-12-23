import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Search, Save, Plus, X, Lock, Sparkles, Clapperboard, Bell } from "lucide-react";
import { toast } from "sonner";
import { searchMovies, searchSeries, getImageUrl, getMovieTrailer, getSeriesTrailer, getMovieDetails, getSeriesDetails, getSeasonDetails } from "@/lib/tmdb";
import { sendContentNotification } from "@/lib/firebase";
import { PlusCircle, Trash, Download as DownloadIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Content, Episode } from "@/types/content";
import type { TMDBMovie, TMDBSeries } from "@/lib/tmdb";

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

  const isTV = editingContent.category === 'tv';
  const isSeries = editingContent.category === 'series';
  const isMovie = editingContent.category === 'movie';

  // --- TMDB Handlers ---
  const handleTmdbSearch = async () => {
    if (!tmdbSearchQuery.trim()) return;

    setIsSearching(true);
    try {
      const category = editingContent.category || "movie";
      const results = category === "movie"
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
      episodes: fetchedEpisodes.length > 0 ? fetchedEpisodes : prev.episodes
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

      if (!response.ok) throw new Error("Falha ao acessar o site");

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const episodes: Episode[] = [];
      const episodeElements = doc.querySelectorAll('.episodios li, .les-content li');

      episodeElements.forEach((el) => {
        const titleEl = el.querySelector('.ep-t, .title');
        const numEl = el.querySelector('.ep-n, .num');

        let epTitle = titleEl?.textContent?.trim() || "";
        let epNumText = numEl?.textContent?.trim() || "";

        if (epTitle) {
          const match = epTitle.match(/Temporada\s*(\d+)\s*Episódio\s*(\d+)\s*:\s*(.*)/i);
          if (match) {
            episodes.push({
              season: parseInt(match[1]),
              episode: parseInt(match[2]),
              title: match[3].trim(),
              url: "",
              download_url: ""
            });
          } else {
            const sMatch = epNumText.match(/(\d+)x(\d+)/i) || epTitle.match(/(\d+)x(\d+)/i);
            if (sMatch) {
              episodes.push({
                season: parseInt(sMatch[1]),
                episode: parseInt(sMatch[2]),
                title: epTitle.includes(':') ? epTitle.split(':')[1].trim() : epTitle,
                url: "",
                download_url: ""
              });
            } else {
              episodes.push({
                season: 1,
                episode: episodes.length + 1,
                title: epTitle,
                url: "",
                download_url: ""
              });
            }
          }
        }
      });

      if (episodes.length === 0) {
        const scriptTags = Array.from(doc.querySelectorAll('script'));
        scriptTags.forEach(s => {
          if (s.innerHTML.includes('episodes')) {
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
        const uniqueEpisodes = episodes.filter((v, i, a) => a.findIndex(t => (t.season === v.season && t.episode === v.episode)) === i);

        setEditingContent(prev => ({
          ...prev,
          episodes: uniqueEpisodes
        }));
        toast.success(`Sucesso! ${uniqueEpisodes.length} episódios importados.`);
      } else {
        toast.error("Não foram encontrados episódios no link. Verifique se a página contém a lista de episódios.");
      }
    } catch (error) {
      console.error("Erro na importação ComandoPlay:", error);
      toast.error("Erro ao importar. Tente novamente mais tarde.");
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
      episodes: [...currentEpisodes, { season: nextSeason, episode: nextEpisode, title: "", url: "", download_url: "" }],
    }));
  };

  const removeEpisode = (index: number) => {
    const currentEpisodes = editingContent.episodes || [];
    setEditingContent(prev => ({
      ...prev,
      episodes: currentEpisodes.filter((_, i) => i !== index),
    }));
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
        </div>

        {!isTV && (
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
                className="bg-input border-border"
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
        <div className="grid grid-cols-2 gap-4">
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
          <div className="col-span-2">
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

            <div className="pt-2 border-t border-border mt-4">
              <Label>URL do Player Interno (m3u8, mp4, ts)</Label>
              <Input
                value={editingContent.internal_player_url || ''}
                onChange={(e) => setEditingContent(prev => ({ ...prev, internal_player_url: e.target.value }))}
                className="bg-input border-border mt-1"
                placeholder="https://... (URL direta para arquivo m3u8, mp4, etc)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                URL direta do arquivo de vídeo para usar o player nativo do próprio site (suporta HLS/m3u8).
              </p>
            </div>
          </div>
        )}

        {isSeries && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Episódios / Temporadas</Label>
              <Button
                type="button"
                size="sm"
                onClick={addEpisode}
                className="bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-1" />
                Adicionar Episódio
              </Button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {(editingContent.episodes || []).map((episode, index) => (
                <div key={index} className="flex gap-2 items-start p-3 bg-secondary/50 rounded-lg">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        placeholder="Temporada"
                        value={episode.season || ''}
                        onChange={(e) => updateEpisode(index, 'season', parseInt(e.target.value) || 1)}
                        className="bg-input border-border text-sm"
                        min="1"
                      />
                      <Input
                        type="number"
                        placeholder="Episódio"
                        value={episode.episode || ''}
                        onChange={(e) => updateEpisode(index, 'episode', parseInt(e.target.value) || 1)}
                        className="bg-input border-border text-sm"
                        min="1"
                      />
                    </div>
                    <Input
                      placeholder="Título do episódio"
                      value={episode.title}
                      onChange={(e) => updateEpisode(index, 'title', e.target.value)}
                      className="bg-input border-border text-sm"
                    />
                    <Input
                      placeholder="URL do episódio"
                      value={episode.url}
                      onChange={(e) => updateEpisode(index, 'url', e.target.value)}
                      className="bg-input border-border text-sm"
                    />
                    <Input
                      placeholder="URL de download (opcional - legado)"
                      value={episode.download_url || ''}
                      onChange={(e) => updateEpisode(index, 'download_url', e.target.value)}
                      className="bg-input border-border text-sm"
                    />

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
                          <PlusCircle className="w-3 h-3 mr-1" /> Add Link
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => removeEpisode(index)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {(!editingContent.episodes || editingContent.episodes.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum episódio adicionado. Clique em "Adicionar Episódio" para começar.
                </p>
              )}
            </div>
          </div>
        )}

        {!isTV && (
          <div>
            <Label>URL do Trailer</Label>
            <Input
              value={editingContent.trailer_url || ''}
              onChange={(e) => setEditingContent(prev => ({ ...prev, trailer_url: e.target.value }))}
              className="bg-input border-border"
              placeholder="https://youtube.com/... (preenchido automaticamente)"
            />
          </div>
        )}

        {isMovie && (
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
        )}

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
      </div>
    </Card >
  );
};