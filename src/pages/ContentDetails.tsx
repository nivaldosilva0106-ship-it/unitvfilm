import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { TrailerModal } from "@/components/TrailerModal";
import { ContentPlayerModal } from "@/components/ContentPlayerModal";
import { AdManager } from "@/components/AdManager";
import { Play, Download, ArrowLeft, Calendar, Globe, Star, Film, Heart } from "lucide-react";
import { getAllContents, addToMyList, removeFromMyList, getMyList } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Content } from "@/types/content";

import { DownloadModal } from "@/components/DownloadModal";

const ContentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [inMyList, setInMyList] = useState(false);
  const [myListItemId, setMyListItemId] = useState<string | null>(null);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, urls?: string[], title: string, isPremium?: boolean, image?: string, description?: string, rating?: number, episodeTitle?: string, internalUrl?: string }>({ open: false, url: '', title: '', isPremium: false });
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [relatedContents, setRelatedContents] = useState<Content[]>([]);


  useEffect(() => {
    loadContent();
  }, [id]);

  useEffect(() => {
    if (user && content) {
      checkMyList();
    }
  }, [user, content]);

  const loadContent = async () => {
    try {
      const contents = await getAllContents();
      const found = contents.find((c) => c.id === id);
      if (found) {
        setContent(found);

        // Filter related content (same category, shuffle, take 10)
        const related = contents
          .filter(c => c.id !== found.id && c.category === found.category)
          .sort(() => 0.5 - Math.random())
          .slice(0, 10);
        setRelatedContents(related);
      } else {
        toast.error("Conteúdo não encontrado");
        navigate("/");
      }
    } catch (error) {
      toast.error("Erro ao carregar conteúdo");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (url?: string) => {
    const videoUrl = url || content?.video_url;

    if (content?.category === 'series' && content.episodes && content.episodes.length > 0) {
      setShowEpisodes(true);
      return;
    }

    if ((videoUrl || content?.internal_player_url) && content) {
      setPlayerModal({ open: true, url: videoUrl || '', urls: content.video_urls, title: content.title, isPremium: content.isPremium, image: content.thumbnail_url, description: content.description, rating: content.rating, internalUrl: content.internal_player_url });
      return;
    }

    toast.error("Link de vídeo não disponível");
  };

  const handleTrailer = () => {
    if (content?.trailer_url) {
      setShowTrailerModal(true);
    } else {
      toast.error("Trailer não disponível");
    }
  };

  const handleDownload = () => {
    if (content?.download_url) {
      setShowDownloadModal(true);
    } else {
      toast.error("Link de download não disponível");
    }
  };

  const checkMyList = async () => {
    if (!user || !content) return;

    try {
      const myList = await getMyList(user.uid);
      const item = myList.find(i => i.contentId === content.id);
      if (item) {
        setInMyList(true);
        setMyListItemId(item.id);
      } else {
        setInMyList(false);
        setMyListItemId(null);
      }
    } catch (error) {
      console.error("Erro ao verificar lista:", error);
    }
  };

  const handleToggleMyList = async () => {
    if (!user) {
      toast.error("Faça login para adicionar à sua lista");
      navigate("/login");
      return;
    }

    if (!content) return;

    try {
      if (inMyList && myListItemId) {
        await removeFromMyList(user.uid, myListItemId);
        setInMyList(false);
        setMyListItemId(null);
        toast.success("Removido da sua lista");
      } else {
        const item = await addToMyList(user.uid, content);
        setInMyList(true);
        setMyListItemId(item.id);
        toast.success("Adicionado à sua lista");
      }
    } catch (error) {
      toast.error("Erro ao atualizar lista");
    }
  };

  const handleAddSuggestionToList = async (c: Content) => {
    if (!user) {
      toast.error("Faça login para adicionar à lista");
      return;
    }

    try {
      // Check if already in list (optimistic check against current list state might be incomplete if list not fully loaded in this component, but safe enough)
      // Since this is a "Watch Later" feature, we assume "Add".
      await addToMyList(user.uid, c);
      toast.success("Adicionado à sua lista");
    } catch (error) {
      // Ignore if already exists or handle error
      toast.info("Já está na sua lista ou ocorreu um erro");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!content) return null;

  const isTV = content.category === 'tv';

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 sm:px-8 pt-24 pb-16">
        {/* Content Top Ad */}
        <AdManager placement="content-top" />

        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6"
          tabIndex={0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 flex flex-col items-center lg:items-start gap-4">
            <img
              src={content.thumbnail_url || "/placeholder.svg"}
              alt={content.title}
              className="w-2/3 sm:w-1/2 lg:w-full max-w-xs rounded-lg shadow-2xl"
            />
            {/* Sidebar Ad */}
            <AdManager placement="sidebar" className="w-full max-w-xs" />
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                {content.title}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {content.release_date && !isTV && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(content.release_date).getFullYear()}
                  </div>
                )}
                {content.language && (
                  <div className="flex items-center gap-1">
                    <Globe className="w-4 h-4" />
                    {content.language.toUpperCase()}
                  </div>
                )}
                {content.rating && !isTV && (
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" />
                    {content.rating.toFixed(1)}
                  </div>
                )}
                <span className="px-3 py-1 bg-primary/20 text-primary rounded-full capitalize">
                  {content.category === 'movie' ? 'Filme' : content.category === 'series' ? 'Série' : 'TV ao Vivo'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => handlePlay()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground glow-effect-hover"
                tabIndex={0}
              >
                <Play className="w-5 h-5 mr-2" />
                {isTV ? 'Assistir Canal' : content.category === 'series' ? 'Ver Episódios' : 'Assistir Agora'}
              </Button>

              <Button
                onClick={handleToggleMyList}
                variant={inMyList ? "default" : "outline"}
                className={inMyList ? "bg-primary/20 hover:bg-primary/30" : ""}
                tabIndex={0}
              >
                <Heart className={`w-5 h-5 mr-2 ${inMyList ? 'fill-primary text-primary' : ''}`} />
                {inMyList ? 'Na Minha Lista' : 'Adicionar à Lista'}
              </Button>

              {content.trailer_url && !isTV && (
                <Button
                  onClick={handleTrailer}
                  variant="secondary"
                  tabIndex={0}
                >
                  <Film className="w-5 h-5 mr-2" />
                  Trailer
                </Button>
              )}

              {content.download_url && content.category === 'movie' && (
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  tabIndex={0}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Baixar
                </Button>
              )}
            </div>

            {content.description && (
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-3">Sinopse</h2>
                <p className="text-foreground/80 leading-relaxed">
                  {content.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Content Bottom Ad */}
        <AdManager placement="content-bottom" className="mt-8" />
      </div>

      {/* Mobile Bottom Ad */}
      <AdManager placement="mobile-bottom" className="md:hidden fixed bottom-0 left-0 right-0 z-40" />

      {content.category === 'series' && showEpisodes && content.episodes && (
        <EpisodeSelector
          open={showEpisodes}
          onClose={() => setShowEpisodes(false)}
          episodes={content.episodes}
          title={content.title}
          trailerUrl={content.trailer_url}
          onPlayEpisode={(url, episodeTitle) => setPlayerModal({ open: true, url, title: content.title, isPremium: content.isPremium, image: content.thumbnail_url, description: content.description, rating: content.rating, episodeTitle })}
        />
      )}

      {showTrailerModal && content.trailer_url && (
        <TrailerModal
          open={showTrailerModal}
          onClose={() => setShowTrailerModal(false)}
          trailerUrl={content.trailer_url}
          title={content.title}
        />
      )}

      {/* Main Player Modal */}
      <ContentPlayerModal
        open={playerModal.open}
        onClose={() => setPlayerModal({ open: false, url: '', title: '', isPremium: false })}
        videoUrl={playerModal.url}
        videoUrls={playerModal.urls}
        title={playerModal.title}
        isPremium={playerModal.isPremium}
        image={playerModal.image}
        description={playerModal.description}
        rating={playerModal.rating}
        episodeTitle={playerModal.episodeTitle}
        internalPlayerUrl={playerModal.internalUrl}
        suggestions={relatedContents}
        onPlayContent={(c) => {
          if (c.video_url || c.internal_player_url) {
            setPlayerModal({
              open: true,
              url: c.video_url || '',
              urls: c.video_urls,
              title: c.title,
              isPremium: c.isPremium,
              image: c.thumbnail_url,
              internalUrl: c.internal_player_url,
              description: c.description,
              rating: c.rating
            });
          }
        }}
        onAddToMyList={handleAddSuggestionToList}
      />

      <DownloadModal
        open={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        downloadUrl={content.download_url || ''}
        title={content.title}
        thumbnail={content.thumbnail_url}
      />
    </div>
  );
};

export default ContentDetails;