import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Header } from "@/components/Header";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Button } from "@/components/ui/button";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { TrailerModal } from "@/components/TrailerModal";
import { ContentRow } from "@/components/ContentRow";

import { AdManager } from "@/components/AdManager";
import { Play, Download, ArrowLeft, Calendar, Globe, Star, Film, Heart, Clock, Users, AlertTriangle } from "lucide-react";
import { getAllContents, addToMyList, removeFromMyList, getMyList, getSiteSettings, type SiteSettings } from "@/lib/firebase";
import { getProviderConfig } from "@/lib/providers";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Content } from "@/types/content";
import { isContentAllowedForProfile } from "@/lib/utils";

import { DownloadModal } from "@/components/DownloadModal";
import { CinemaWarningModal } from "@/components/CinemaWarningModal";
import { CommentsSection } from "@/components/CommentsSection";
import { useSpatialNavigation, FOCUSABLE_CLASS } from "@/hooks/useSpatialNavigation";

const ContentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, currentProfile } = useAuth();
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [inMyList, setInMyList] = useState(false);
  const [myListItemId, setMyListItemId] = useState<string | null>(null);

  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [showCinemaModal, setShowCinemaModal] = useState(false);
  const [pendingPlayerState, setPendingPlayerState] = useState<any>(null);
  const [relatedContents, setRelatedContents] = useState<Content[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);

  useSpatialNavigation({
    enabled: true,
    onBack: () => {
      if (showEpisodes) {
        setShowEpisodes(false);
      } else if (showTrailerModal) {
        setShowTrailerModal(false);
      } else if (showDownloadModal) {
        setShowDownloadModal(false);
      } else if (showCinemaModal) {
        setShowCinemaModal(false);
      } else {
        navigate("/");
      }
    },
    onEnter: (el) => {
      el.click();
    }
  });

  useEffect(() => {
    loadContent();
  }, [id]);

  useEffect(() => {
    if (user && content) {
      checkMyList();
    }
  }, [user, content]);

  // Auto-open episode or selector from URL params
  useEffect(() => {
    if (!content || loading) return;

    if (searchParams.get('showEpisodes') === 'true') {
      setShowEpisodes(true);
      // Clear param after opening
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        newParams.delete('showEpisodes');
        return newParams;
      });
      return;
    }

    if (!content.episodes) return;

    const seasonParam = searchParams.get('season');
    const episodeParam = searchParams.get('episode');

    if (seasonParam && episodeParam) {
      const season = parseInt(seasonParam, 10);
      const episode = parseInt(episodeParam, 10);

      const foundEpisode = content.episodes.find(
        e => e.season === season && e.episode === episode
      );

      if (foundEpisode) {
        requestPlay(season, episode);
        // Clear params after opening
        setSearchParams({});
      }
    }
  }, [content, loading, searchParams]);

  const loadContent = async () => {
    try {
      const [contents, settings] = await Promise.all([
        getAllContents(),
        getSiteSettings()
      ]);
      setSiteSettings(settings);
      
      const found = contents.find((c) => c.id === id);
      if (found) {
        if (found.category === 'nostalgia') {
          navigate(`/nostalgia/${found.id}`);
          return;
        }
        setContent(found);
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

  const getNextEpisode = (content: Content, currentSeason: number, currentEpisode: number) => {
    if (!content.episodes) return undefined;

    // Sort episodes just in case
    const sortedEpisodes = [...content.episodes].sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
    const currentIndex = sortedEpisodes.findIndex(e => e.season === currentSeason && e.episode === currentEpisode);

    if (currentIndex >= 0 && currentIndex < sortedEpisodes.length - 1) {
      const next = sortedEpisodes[currentIndex + 1];
      return {
        title: next.title,
        season: next.season,
        episode: next.episode,
        url: next.url
      };
    }
    return undefined;
  };

  const requestPlay = (season?: number, episode?: number) => {
    if (!content) return;

    if (!isContentAllowedForProfile(content.classification, currentProfile?.isKids || false)) {
      toast.error("Acesso Restrito: Este conteúdo não é permitido para perfis Kids.");
      return;
    }

    if (content?.is_cinema_mode) {
      setPendingPlayerState({ season, episode });
      setShowCinemaModal(true);
    } else {
      let url = `/watch/${content?.id}`;
      if (season && episode) {
        url += `?season=${season}&episode=${episode}`;
      }
      navigate(url);
    }
  };

  const handlePlay = (url?: string) => {
    const videoUrl = url || content?.video_url;

    if (content?.category === 'nostalgia') {
      navigate(`/nostalgia/${content.id}`);
      return;
    }

    const isSeries = content?.category?.toLowerCase() === 'series' || 
                    content?.category?.toLowerCase() === 'série' || 
                    content?.category?.toLowerCase() === 'serie' ||
                    (content?.episodes && content.episodes.length > 0);

    if (isSeries) {
      setShowEpisodes(true);
      return;
    }

    if ((videoUrl || content?.internal_player_url) && content) {
      requestPlay();
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
      await addToMyList(user.uid, c);
      toast.success("Adicionado à sua lista");
    } catch (error) {
      toast.info("Já está na sua lista ou ocorreu um erro");
    }
  };

  if (loading) {
    return <LoadingScreen />;
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
            className={`mb-6 ${FOCUSABLE_CLASS}`}
            tabIndex={0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-center lg:items-start gap-4">
              <div className="relative group w-48 sm:w-64 lg:w-full">
                <img
                  src={content.thumbnail_url || "/placeholder.svg"}
                  alt={content.title}
                  className="w-full rounded-lg shadow-2xl"
                />
                
                {content.watch_provider && getProviderConfig(content.watch_provider, siteSettings?.providerLogos) && (
                  <div className="absolute top-3 left-3 z-10 bg-black/40 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-2xl">
                    <img 
                      src={getProviderConfig(content.watch_provider, siteSettings?.providerLogos)?.logo} 
                      alt="" 
                      className="h-10 w-auto object-contain" 
                    />
                  </div>
                )}

                {/* Classification Badge on Poster */}
                {content.classification && (
                  <div className={`absolute ${content.watch_provider ? 'top-[62px]' : 'top-3'} left-3 z-10 px-2 py-1 rounded text-xs font-bold text-white shadow-lg
                    ${content.classification === 'L' ? 'bg-green-500' :
                    content.classification === '10' ? 'bg-blue-400' :
                    content.classification === '12' ? 'bg-yellow-400' :
                    content.classification === '14' ? 'bg-orange-400' :
                    content.classification === '16' ? 'bg-red-500' :
                    content.classification === '18' ? 'bg-black' : 'bg-zinc-500'
                  }`}>
                    {content.classification}
                  </div>
                )}
              </div>
              {/* Sidebar Ad */}
              <AdManager placement="sidebar" className="w-full max-w-xs" />
            </div>

            <div className="lg:col-span-3 space-y-6">
              <div className="text-center lg:text-left">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-3">
                  {content.title}
                </h1>
                <div className="flex flex-wrap justify-center lg:justify-start gap-3 sm:gap-4 text-sm text-muted-foreground">
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
                  <span className="px-3 py-1 bg-primary/20 text-primary rounded-full capitalize text-xs font-semibold">
                    {content.category === 'movie' ? 'Filme' : content.category === 'series' ? 'Série' : 'TV ao Vivo'}
                  </span>
                </div>
              </div>

              {/* Backdrop Logic */}
              {content.backdrop_url && (
                <div className="fixed inset-0 -z-10">
                  <div className="absolute inset-0 bg-background/90" />
                  <img src={content.backdrop_url} className="w-full h-full object-cover opacity-20" />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
                {isContentAllowedForProfile(content.classification, currentProfile?.isKids || false) ? (
                  <Button
                    onClick={() => handlePlay()}
                    className={`bg-primary hover:bg-primary/90 text-primary-foreground glow-effect-hover flex-1 sm:flex-none py-6 ${FOCUSABLE_CLASS}`}
                    tabIndex={0}
                  >
                    <Play className="w-5 h-5 mr-2" />
                    {isTV ? 'Assistir' : content.category === 'series' ? 'Episódios' : 'Assistir'}
                  </Button>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium w-full lg:w-auto">
                    <AlertTriangle className="w-4 h-4" />
                    Conteúdo Restrito (Kids)
                  </div>
                )}

                <Button
                  onClick={handleToggleMyList}
                  variant={inMyList ? "default" : "outline"}
                  className={`flex-1 sm:flex-none py-6 ${inMyList ? "bg-primary/20 hover:bg-primary/30" : ""} ${FOCUSABLE_CLASS}`}
                  tabIndex={0}
                >
                  <Heart className={`w-5 h-5 mr-2 ${inMyList ? 'fill-primary text-primary' : ''}`} />
                  {inMyList ? 'Na Lista' : 'Lista'}
                </Button>

                {content.trailer_url && !isTV && (
                  <Button
                    onClick={handleTrailer}
                    variant="secondary"
                    className={`flex-1 sm:flex-none py-6 ${FOCUSABLE_CLASS}`}
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
                    className={`flex-1 sm:flex-none py-6 ${FOCUSABLE_CLASS}`}
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

              {/* Extended Metadata */}
              <div className="flex flex-col gap-4 mt-6 border-t border-white/10 pt-6">
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

              {/* Related Content / "Assista Também" */}
              {relatedContents.length > 0 && (
                <div className="mt-12 border-t border-white/10 pt-8">
                  <ContentRow
                    title="Assista Também"
                    contents={relatedContents}
                    onPlayContent={(c) => navigate(`/watch/${c.id}`)}
                    onInfoContent={(c) => navigate(`/content/${c.id}`)}
                    onDetailsContent={(c) => navigate(`/content/${c.id}`)}
                    providerLogos={siteSettings?.providerLogos}
                  />
                </div>
              )}
            </div>
          </div>

          <AdManager placement="content-bottom" className="mt-8" />
        </div>

        <AdManager placement="mobile-bottom" className="md:hidden fixed bottom-0 left-0 right-0 z-40" />

        {
          content.category === 'series' && showEpisodes && content.episodes && (
            <EpisodeSelector
              open={showEpisodes}
              onClose={() => setShowEpisodes(false)}
              episodes={content.episodes}
              title={content.title}
              trailerUrl={content.trailer_url}
              thumbnail={content.thumbnail_url}
              onPlayEpisode={(ep) => {
                requestPlay(ep.season, ep.episode);
              }}
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

        {/* ContentPlayerModal Removed */}

        <DownloadModal
          open={showDownloadModal}
          onClose={() => setShowDownloadModal(false)}
          downloadUrl={content.download_url || ''}
          downloads={content.downloads}
          download_mode={content.download_mode}
          title={content.title}
          thumbnail={content.thumbnail_url}
          contentId={content.id}
        />

        <CinemaWarningModal
          open={showCinemaModal}
          onClose={() => setShowCinemaModal(false)}
          onConfirm={() => {
            if (pendingPlayerState) {
              const { season, episode } = pendingPlayerState;
              let url = `/watch/${content?.id}`;
              if (season && episode) {
                url += `?season=${season}&episode=${episode}`;
              }
              navigate(url);
              setPendingPlayerState(null);
            }
          }}
        />
      </div>
    </div>
  );
};

export default ContentDetails;
