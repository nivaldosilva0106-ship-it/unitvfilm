import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Search, Trash2, Save, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addContent, getAllContents, deleteContent, updateContent } from "@/lib/firebase";
import { searchMovies, searchSeries, getImageUrl, getMovieTrailer, getSeriesTrailer } from "@/lib/tmdb";
import type { Content, Episode } from "@/types/content";
import type { TMDBMovie, TMDBSeries } from "@/lib/tmdb";

const Admin = () => {
  const [allContents, setAllContents] = useState<Content[]>([]); // Lista completa
  const [filteredContents, setFilteredContents] = useState<Content[]>([]); // Lista filtrada para exibição
  const [listSearchQuery, setListSearchQuery] = useState(""); // Query para busca na lista
  
  const [tmdbSearchQuery, setTmdbSearchQuery] = useState(""); // Query para busca no TMDB
  const [searchResults, setSearchResults] = useState<(TMDBMovie | TMDBSeries)[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [editingContent, setEditingContent] = useState<Partial<Content>>({
    title: "",
    category: "movie",
    description: "",
    thumbnail_url: "",
    video_url: "",
    episodes: [],
    download_url: "",
    trailer_url: "",
    language: "pt-BR",
    release_date: "",
  });

  useEffect(() => {
    loadContents();
  }, []);

  useEffect(() => {
    // Filtra a lista de conteúdos cadastrados sempre que a query de busca ou a lista completa mudar
    if (listSearchQuery.trim() === "") {
      setFilteredContents(allContents);
    } else {
      const lowerCaseQuery = listSearchQuery.toLowerCase();
      const filtered = allContents.filter(content =>
        content.title.toLowerCase().includes(lowerCaseQuery) ||
        content.category.toLowerCase().includes(lowerCaseQuery)
      );
      setFilteredContents(filtered);
    }
  }, [listSearchQuery, allContents]);

  const loadContents = async () => {
    try {
      const data = await getAllContents();
      setAllContents(data);
    } catch (error) {
      toast.error("Erro ao carregar conteúdos");
    }
  };

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
    
    // Buscar trailer automaticamente
    let trailerUrl = '';
    try {
      trailerUrl = isMovie 
        ? await getMovieTrailer(item.id)
        : await getSeriesTrailer(item.id);
    } catch (error) {
      console.error('Erro ao buscar trailer:', error);
    }
    
    setEditingContent({
      ...editingContent,
      title: isMovie ? item.title : item.name,
      description: item.overview,
      thumbnail_url: getImageUrl(item.poster_path),
      trailer_url: trailerUrl,
      language: item.original_language,
      release_date: isMovie ? item.release_date : item.first_air_date,
      rating: item.vote_average,
      tmdb_id: item.id,
    });
    setSearchResults([]);
    toast.success("Dados preenchidos com sucesso!" + (trailerUrl ? " (Trailer encontrado)" : ""));
  };

  const addEpisode = () => {
    const currentEpisodes = editingContent.episodes || [];
    const lastEpisode = currentEpisodes[currentEpisodes.length - 1];
    const nextSeason = lastEpisode?.season || 1;
    const nextEpisode = lastEpisode?.season === nextSeason ? (lastEpisode?.episode || 0) + 1 : 1;
    
    setEditingContent({
      ...editingContent,
      episodes: [...currentEpisodes, { season: nextSeason, episode: nextEpisode, title: "", url: "", download_url: "" }],
    });
  };

  const removeEpisode = (index: number) => {
    const currentEpisodes = editingContent.episodes || [];
    setEditingContent({
      ...editingContent,
      episodes: currentEpisodes.filter((_, i) => i !== index),
    });
  };

  const updateEpisode = (index: number, field: keyof Episode, value: string | number) => {
    const currentEpisodes = editingContent.episodes || [];
    const updated = [...currentEpisodes];
    updated[index] = { ...updated[index], [field]: value };
    setEditingContent({
      ...editingContent,
      episodes: updated,
    });
  };

  const handleSave = async () => {
    if (!editingContent.title || !editingContent.category || !editingContent.thumbnail_url) {
      toast.error("Preencha os campos obrigatórios (Título, Categoria, URL da Imagem)");
      return;
    }
    
    // Limpar campos irrelevantes dependendo da categoria antes de salvar
    const contentToSave: Partial<Content> = { ...editingContent };
    
    if (contentToSave.category === 'movie') {
      contentToSave.episodes = undefined;
    } else if (contentToSave.category === 'tv') {
      contentToSave.episodes = undefined;
      contentToSave.download_url = undefined;
      contentToSave.trailer_url = undefined;
      // video_url é usado para o iframe/stream
    } else if (contentToSave.category === 'series') {
      contentToSave.download_url = undefined;
      contentToSave.video_url = undefined; // O vídeo é acessado via episódios
    }


    try {
      if (editingContent.id) {
        await updateContent(editingContent.id, contentToSave);
        toast.success("Conteúdo atualizado!");
      } else {
        await addContent(contentToSave as Omit<Content, 'id'>);
        toast.success("Conteúdo adicionado!");
      }
      
      setEditingContent({
        title: "",
        category: "movie",
        description: "",
        thumbnail_url: "",
        video_url: "",
        episodes: [],
        download_url: "",
        trailer_url: "",
        language: "pt-BR",
        release_date: "",
      });
      loadContents();
    } catch (error) {
      toast.error("Erro ao salvar conteúdo");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteContent(id);
      toast.success("Conteúdo removido!");
      loadContents();
    } catch (error) {
      toast.error("Erro ao remover conteúdo");
    }
  };

  const isTV = editingContent.category === 'tv';
  const isSeries = editingContent.category === 'series';
  const isMovie = editingContent.category === 'movie';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-8 pt-24 pb-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Painel Administrativo</h1>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Adicionar/Editar Conteúdo</h2>
            
            <div className="space-y-4">
              <div>
                <Label>Categoria *</Label>
                <Select 
                  value={editingContent.category} 
                  onValueChange={(value) => setEditingContent({...editingContent, category: value as any})}
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
                  value={editingContent.title}
                  onChange={(e) => setEditingContent({...editingContent, title: e.target.value})}
                  className="bg-input border-border"
                />
              </div>

              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={editingContent.description}
                  onChange={(e) => setEditingContent({...editingContent, description: e.target.value})}
                  className="bg-input border-border min-h-[100px]"
                />
              </div>

              <div>
                <Label>URL da Imagem *</Label>
                <Input
                  value={editingContent.thumbnail_url}
                  onChange={(e) => setEditingContent({...editingContent, thumbnail_url: e.target.value})}
                  className="bg-input border-border"
                  placeholder="https://..."
                />
              </div>

              {/* Campo de URL de Vídeo/Iframe Condicional */}
              {(isMovie || isTV) && (
                <div>
                  <Label>URL do Vídeo / Iframe (para {isTV ? 'TV ao Vivo' : 'Filme'})</Label>
                  <Input
                    value={editingContent.video_url}
                    onChange={(e) => setEditingContent({...editingContent, video_url: e.target.value})}
                    className="bg-input border-border"
                    placeholder="https://..."
                  />
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
                    value={editingContent.trailer_url}
                    onChange={(e) => setEditingContent({...editingContent, trailer_url: e.target.value})}
                    className="bg-input border-border"
                    placeholder="https://youtube.com/... (preenchido automaticamente)"
                  />
                </div>
              )}

              {isMovie && (
                <div>
                  <Label>URL de Download (Filme)</Label>
                  <Input
                    value={editingContent.download_url}
                    onChange={(e) => setEditingContent({...editingContent, download_url: e.target.value})}
                    className="bg-input border-border"
                    placeholder="https://..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Idioma</Label>
                  <Input
                    value={editingContent.language}
                    onChange={(e) => setEditingContent({...editingContent, language: e.target.value})}
                    className="bg-input border-border"
                  />
                </div>
                <div>
                  <Label>Data de Lançamento</Label>
                  <Input
                    type="date"
                    value={editingContent.release_date}
                    onChange={(e) => setEditingContent({...editingContent, release_date: e.target.value})}
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

          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold text-foreground mb-4">Conteúdos Cadastrados</h2>
            
            {/* Search Input for Content List */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título ou categoria..."
                value={listSearchQuery}
                onChange={(e) => setListSearchQuery(e.target.value)}
                className="pl-10 bg-input border-border"
              />
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {filteredContents.map((content) => (
                <div key={content.id} className="flex items-center gap-4 p-3 bg-secondary rounded-lg">
                  <img 
                    src={content.thumbnail_url || "/placeholder.svg"} 
                    alt={content.title}
                    className="w-16 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{content.title}</h3>
                    <p className="text-sm text-muted-foreground capitalize">{content.category}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingContent(content)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(content.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filteredContents.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  {listSearchQuery ? "Nenhum resultado encontrado para sua busca." : "Nenhum conteúdo cadastrado"}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Admin;