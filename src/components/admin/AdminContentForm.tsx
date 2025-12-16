import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Search, Save, Plus, X, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { searchMovies, searchSeries, getImageUrl, getMovieTrailer, getSeriesTrailer } from "@/lib/tmdb";
import type { Content, Episode } from "@/types/content";
import type { TMDBMovie, TMDBSeries } from "@/lib/tmdb";

interface AdminContentFormProps {
  editingContent: Partial<Content>;
  setEditingContent: React.Dispatch<React.SetStateAction<Partial<Content>>>;
  handleSave: () => Promise<void>;
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
    const isMovie = 'title' in item;

    let trailerUrl = '';
    try {
      trailerUrl = isMovie
        ? await getMovieTrailer(item.id)
        : await getSeriesTrailer(item.id);
    } catch (error) {
      console.error('Erro ao buscar trailer:', error);
    }

    setEditingContent(prev => ({
      ...prev,
      title: isMovie ? item.title : item.name,
      description: item.overview,
      thumbnail_url: getImageUrl(item.poster_path),
      trailer_url: trailerUrl,
      language: item.original_language,
      release_date: isMovie ? item.release_date : item.first_air_date,
      rating: item.vote_average,
      tmdb_id: item.id,
    }));
    setSearchResults([]);
    toast.success("Dados preenchidos com sucesso!" + (trailerUrl ? " (Trailer encontrado)" : ""));
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

        <div>
          <Label>URL da Imagem *</Label>
          <Input
            value={editingContent.thumbnail_url || ''}
            onChange={(e) => setEditingContent(prev => ({ ...prev, thumbnail_url: e.target.value }))}
            className="bg-input border-border"
            placeholder="https://..."
          />
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
                      placeholder="URL de download (opcional)"
                      value={episode.download_url || ''}
                      onChange={(e) => updateEpisode(index, 'download_url', e.target.value)}
                      className="bg-input border-border text-sm"
                    />
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
          <div>
            <Label>URL de Download (Filme)</Label>
            <Input
              value={editingContent.download_url || ''}
              onChange={(e) => setEditingContent(prev => ({ ...prev, download_url: e.target.value }))}
              className="bg-input border-border"
              placeholder="https://..."
            />
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

        <Button onClick={handleSave} className="w-full bg-primary hover:bg-primary/90 glow-effect-hover">
          <Save className="w-4 h-4 mr-2" />
          Salvar Conteúdo
        </Button>
      </div>
    </Card>
  );
};