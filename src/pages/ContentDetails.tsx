import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { TrailerModal } from "@/components/TrailerModal";
import { ContentPlayerModal } from "@/components/ContentPlayerModal";
import { AdManager } from "@/components/AdManager";
import { Play, Download, ArrowLeft, Calendar, Globe, Star, Film, Heart, Clock, Users } from "lucide-react";
import { getAllContents, addToMyList, removeFromMyList, getMyList } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Content } from "@/types/content";

import { DownloadModal } from "@/components/DownloadModal";
import { CinemaWarningModal } from "@/components/CinemaWarningModal";
import { CommentsSection } from "@/components/CommentsSection";

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
  const [showCinemaModal, setShowCinemaModal] = useState(false);
  const [pendingPlayerState, setPendingPlayerState] = useState<any>(null);
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

  const requestPlay = (playerState: any) => {
    if (content?.is_cinema_mode) {
      setPendingPlayerState(playerState);
      setShowCinemaModal(true);
    } else {
      setPlayerModal(playerState);
    }
  };

  const handlePlay = (url?: string) => {
    const videoUrl = url || content?.video_url;

    if (content?.category === 'series' && content.episodes && content.episodes.length > 0) {
      setShowEpisodes(true);
      return;
    }

    if ((videoUrl || content?.internal_player_url) && content) {
      requestPlay({ open: true, url: videoUrl || '', urls: content.video_urls, title: content.title, isPremium: content.isPremium, image: content.thumbnail_url, description: content.description, rating: content.rating, internalUrl: content.internal_player_url });
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
    <div className="min-h-screen bg-background relative">
      {/* Backdrop Image with Dark Green Overlay */}
      {content.backdrop_url && (
        <>
          <div
            className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${content.backdrop_url})` }}
          />
          <div className="fixed inset-0 z-0 bg-green-950/70" />
        </>
      )}

      <div className="relative z-10">
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

              {/* Moved Metadata from here to below description */}

              {/* Backdrop Logic (Optional: Apply as page background?) */}
              {content.backdrop_url && (
                <div className="fixed inset-0 -z-10">
                  <div className="absolute inset-0 bg-background/90" />
                  <img src={content.backdrop_url} className="w-full h-full object-cover opacity-20" />
                </div>
              )}

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

                {(content.category === 'movie') && ((content.download_url) || (content.downloads && content.downloads.length > 0)) && (
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

              {/* Extended Metadata - Now Below Description */}
              <div className="flex flex-col gap-4 mt-6 border-t border-white/10 pt-6">
                {/* Quick Info */}
                <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                  {content.duration && (
                    <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{content.duration}</span>
                    </div>
                  )}
                  {content.genre && content.genre.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                      <Film className="w-3.5 h-3.5 text-blue-500" />
                      <span>{content.genre.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Cast Grid */}
                {content.cast_members && content.cast_members.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" /> Elenco Principal
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                      {content.cast_members.map((actor, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1.5 min-w-[70px] max-w-[70px]">
                          <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/10 shadow-lg">
                            <img
                              src={actor.profile_path || '/placeholder-user.jpg'}
                              alt={actor.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(actor.name) + '&background=random'; }}
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-semibold text-white line-clamp-1" title={actor.name}>{actor.name}</p>
                            <p className="text-[9px] text-gray-400 line-clamp-1" title={actor.character}>{actor.character}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  content.cast && (
                    <div className="flex items-start gap-2 text-sm text-gray-400 bg-white/5 p-4 rounded-lg">
                      <Users className="w-4 h-4 text-gray-500 mt-1" />
                      <div>
                        <span className="text-white font-medium">Elenco:</span>
                        <p className="line-clamp-2">{content.cast}</p>
                      </div>
                    </div>
                  )
                )}
              </div>

              <CommentsSection contentId={content.id} />
            </div>
          </div>

          {/* Content Bottom Ad */}
          <AdManager placement="content-bottom" className="mt-8" />
        </div>

        {/* Mobile Bottom Ad */}
        <AdManager placement="mobile-bottom" className="md:hidden fixed bottom-0 left-0 right-0 z-40" />

        {
          content.category === 'series' && showEpisodes && content.episodes && (
            <EpisodeSelector
              open={showEpisodes}
              onClose={() => setShowEpisodes(false)}
              episodes={content.episodes}
              title={content.title}
              trailerUrl={content.trailer_url}
              onPlayEpisode={(url, episodeTitle) => requestPlay({ open: true, url, title: content.title, isPremium: content.isPremium, image: content.thumbnail_url, description: content.description, rating: content.rating, episodeTitle })}
            />
          )
        }

        {
          showTrailerModal && content.trailer_url && (
            <TrailerModal
              open={showTrailerModal}
              onClose={() => setShowTrailerModal(false)}
              trailerUrl={content.trailer_url}
              title={content.title}
            />
          )
        }

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
              // Check cinema mode for suggestions too? The user said "in other pages where play is available".
              // If suggestion is part of content list, it might have 'is_cinema_mode'. 
              // Ideally 'requestPlay' logic should be used here too if we want to support it for suggestions.
              // But 'c' is from 'relatedContents', which is 'Content'.
              const playCall = () => setPlayerModal({
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

              if (c.is_cinema_mode) {
                setPendingPlayerState({
                  open: true,
                  url: c.video_url || '',
                  urls: c.video_urls,
                  title: c.title,
                  isPremium: c.isPremium,
                  image: c.thumbnail_url,
                  internalUrl: c.internal_player_url,
                  description: c.description,
                  rating: c.rating
                }); // We need to update this to work generically.
                // Actually current 'requestPlay' uses 'content' scope.
                // We should probably just setCinemaModal(true) and change pending state.
                setShowCinemaModal(true);
              } else {
                playCall();
              }
            }
          }}
          onAddToMyList={handleAddSuggestionToList}
        />

        <DownloadModal
          open={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          downloadUrl={content.download_url || ''}
          downloads={content.downloads}
          downloadMode={content.download_mode}
          title={content.title}
          thumbnail={content.thumbnail_url}
        />

        <CinemaWarningModal
          open={showCinemaModal}
          onClose={() => setShowCinemaModal(false)}
          onConfirm={() => {
            if (pendingPlayerState) {
              setPlayerModal(pendingPlayerState);
              setPendingPlayerState(null);
            }
          }}
        />
      </div>
    </div>
    </div >
  );
};

export default ContentDetails;