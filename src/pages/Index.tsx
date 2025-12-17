import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Volume2, VolumeX, Play, Info, Plus, Check, Star } from "lucide-react";
import { ContentRow } from "@/components/ContentRow";
import { MarqueeContentRow } from "@/components/MarqueeContentRow";
import { EpisodeSelector } from "@/components/EpisodeSelector";
import { ContentPlayerModal } from "@/components/ContentPlayerModal";
import { CategoryNavigation } from "@/components/CategoryNavigation";
import { DownloadModal } from "@/components/DownloadModal";
import { CinemaWarningModal } from "@/components/CinemaWarningModal";
import { QuickViewModal } from "@/components/QuickViewModal";
import { AdManager } from "@/components/AdManager";
import { Content } from "@/types/content";
import { getAllContents, getMyList, addToMyList, removeFromMyList, getSliderSettings, type SliderSettings } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { MyListItem } from "@/types/user";

const ALL_CATEGORIES = ['Todos', 'Filmes', 'Séries', 'TV ao Vivo', 'Lançamentos', 'Ação', 'Terror'];

const Index = () => {
  const navigate = useNavigate();
  const { user, currentProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user && !currentProfile) {
      navigate('/profiles');
    }
  }, [user, currentProfile, authLoading, navigate]);
  const [allContentData, setAllContentData] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [randomContent, setRandomContent] = useState<Content[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, urls?: string[], title: string, isPremium?: boolean, image?: string, description?: string, rating?: number, episodeTitle?: string, internalUrl?: string }>({ open: false, url: '', title: '', isPremium: false });
  const [downloadModal, setDownloadModal] = useState<{ open: boolean, url: string, title: string, thumbnail: string }>({ open: false, url: '', title: '', thumbnail: '' });
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  /* New State for Quick View */
  const [quickViewContent, setQuickViewContent] = useState<Content | null>(null);
  const [showCinemaModal, setShowCinemaModal] = useState(false);
  const [pendingPlayerState, setPendingPlayerState] = useState<any>(null);

  /* New State for Video Slider */
  const [trailerContents, setTrailerContents] = useState<Content[]>([]);
  const [currentTrailerIndex, setCurrentTrailerIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [heroTextVisible, setHeroTextVisible] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /* My List State */
  const [myList, setMyList] = useState<MyListItem[]>([]);

  /* Helper to extract YouTube ID - Robust Version */
  const getYouTubeId = (url: string | undefined | null) => {
    if (!url || typeof url !== 'string') return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    loadContent();
  }, []);

  /* Load User's List */
  useEffect(() => {
    if (user) {
      loadMyList();
    }
  }, [user]);

  const loadMyList = async () => {
    if (user) {
      try {
        const list = await getMyList(user.uid);
        setMyList(list);
      } catch (error) {
        console.error("Error loading my list:", error);
      }
    }
  };

  // Hero Text Fade-Out Timer (5 seconds)
  useEffect(() => {
    const textTimer = setTimeout(() => {
      setHeroTextVisible(false);
    }, 5000);

    return () => clearTimeout(textTimer);
  }, []);

  // Show video after 15 seconds delay
  useEffect(() => {
    const videoTimer = setTimeout(() => {
      setShowVideo(true);
    }, 15000);

    return () => clearTimeout(videoTimer);
  }, [currentTrailerIndex]);

  /* Filter and Shuffle Trailers based on Slider Settings */
  useEffect(() => {
    const loadTrailers = async () => {
      if (allContentData.length > 0) {
        try {
          const sliderSettings = await getSliderSettings();
          let filtered: Content[] = [];

          if (sliderSettings.mode === 'manual' && sliderSettings.selectedContentIds.length > 0) {
            // Manual mode: only show selected content
            filtered = allContentData.filter(c =>
              c.trailer_url &&
              getYouTubeId(c.trailer_url) &&
              sliderSettings.selectedContentIds.includes(c.id)
            );
          } else {
            // Random mode: show all content with trailers
            filtered = allContentData.filter(c => c.trailer_url && getYouTubeId(c.trailer_url));
          }

          if (filtered.length > 0) {
            const shuffled = [...filtered].sort(() => 0.5 - Math.random());
            setTrailerContents(shuffled);
          } else {
            setTrailerContents([]);
          }
        } catch (error) {
          console.error('Error loading slider settings:', error);
          // Fallback to all trailers if settings fail to load
          const withTrailers = allContentData.filter(c => c.trailer_url && getYouTubeId(c.trailer_url));
          if (withTrailers.length > 0) {
            const shuffled = [...withTrailers].sort(() => 0.5 - Math.random());
            setTrailerContents(shuffled);
          }
        }
      }
    };

    loadTrailers();
  }, [allContentData]);

  /* Image Slider Interval (Fallback) */
  useEffect(() => {
    if (allContentData.length > 0 && trailerContents.length === 0) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % allContentData.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [allContentData, trailerContents]);

  /* Video Slider Interval (90s) - Only run if player modal is CLOSED */
  useEffect(() => {
    if (trailerContents.length > 0 && !playerModal.open) {
      const interval = setInterval(() => {
        setShowVideo(false); // Reset video display for next trailer
        setCurrentTrailerIndex((prev) => (prev + 1) % trailerContents.length);
      }, 90000); // 90 seconds

      return () => clearInterval(interval);
    }
  }, [trailerContents, playerModal.open]);

  /* AGGRESSIVE UNMUTE Logic */
  useEffect(() => {
    /* Always set muted to FALSE when invalidating index or mounting */
    setIsMuted(false);

    /* Force unmute command to YouTube API after a small delay to ensure player is ready */
    const timer = setTimeout(() => {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "unMute", args: [] }),
          "*"
        );
      }
    }, 1500); /* 1.5s delay */

    return () => clearTimeout(timer);
  }, [currentTrailerIndex, playerModal.open]);

  /* Auto-advance slider when returning from player modal */
  useEffect(() => {
    if (!playerModal.open && trailerContents.length > 0) {
      /* When modal closes, advance to next trailer */
      setCurrentTrailerIndex((prev) => (prev + 1) % trailerContents.length);
    }
  }, [playerModal.open]);

  const loadContent = async () => {
    try {
      const allData = await getAllContents();
      // TEMP: Inject classification for testing
      if (allData.length > 0) allData[0].classification = '16';
      setAllContentData(allData);

      const shuffled = [...allData].sort(() => 0.5 - Math.random());
      setRandomContent(shuffled.slice(0, 10));
    } catch (error) {
      toast.error("Erro ao carregar conteúdos");
    } finally {
      setLoading(false);
    }
  };

  const toggleAudio = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      const action = isMuted ? "unMute" : "mute";
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ event: "command", func: action, args: [] }),
        "*"
      );
      setIsMuted(!isMuted);
    }
  };

  const handleToggleMyList = async (content: Content) => {
    if (!user) {
      toast.error("Faça login para adicionar à sua lista");
      navigate("/login");
      return;
    }

    const existingItem = myList.find(item => item.contentId === content.id);

    try {
      if (existingItem) {
        await removeFromMyList(user.uid, existingItem.id);
        setMyList(prev => prev.filter(item => item.id !== existingItem.id));
        toast.success("Removido da lista");
      } else {
        const newItem = await addToMyList(user.uid, content);
        setMyList(prev => [...prev, newItem]);
        toast.success("Adicionado à lista");
      }
    } catch (error) {
      toast.error("Erro ao atualizar lista");
    }
  };

  // Mapeamento e filtragem de conteúdo por categoria
  const categorizedContent = useMemo(() => {
    const data = allContentData;

    if (selectedCategory === 'Todos') {
      const topRated = data.filter(c =>
        (c.category === 'movie' || c.category === 'series') &&
        c.rating &&
        c.rating >= 7.0
      ).sort(() => 0.5 - Math.random()).slice(0, 15); // Random Top Rated

      // Helper for random shuffle
      const shuffle = (array: Content[]) => [...array].sort(() => 0.5 - Math.random());

      return {
        movies: shuffle(data.filter(c => c.category === 'movie')),
        series: shuffle(data.filter(c => c.category === 'series')),
        tvChannels: shuffle(data.filter(c => c.category === 'tv')),
        featured: randomContent, // Already shuffled
        topRated: topRated,
      };
    }

    let filtered: Content[] = [];
    let title = selectedCategory;

    switch (selectedCategory) {
      case 'Filmes':
        filtered = data.filter(c => c.category === 'movie');
        break;
      case 'Séries':
        filtered = data.filter(c => c.category === 'series');
        break;
      case 'TV ao Vivo':
        filtered = data.filter(c => c.category === 'tv');
        break;
      case 'Lançamentos':
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        filtered = data.filter(c => c.release_date && new Date(c.release_date) > threeMonthsAgo);
        break;
      case 'Ação':
      case 'Terror':
        const keyword = selectedCategory.toLowerCase();
        filtered = data.filter(c =>
          c.title.toLowerCase().includes(keyword) ||
          c.description?.toLowerCase().includes(keyword)
        );
        break;
      default:
        filtered = [];
    }

    return {
      singleRow: filtered,
      singleRowTitle: title,
    };
  }, [allContentData, selectedCategory, randomContent]);


  const handlePlayContent = (content: Content) => {
    // Guest Limit Check
    if (user?.isAnonymous) {
      const watched = parseInt(sessionStorage.getItem('guest_watched_count') || '0');
      if (watched >= 1) {
        toast.error("Visitante só pode assistir 1 conteúdo. Crie uma conta para continuar.");
        navigate('/signup');
        return;
      }
      // Increment on play intent (simple enforcement)
      sessionStorage.setItem('guest_watched_count', (watched + 1).toString());
    }

    if (content.category === 'series' && content.episodes && content.episodes.length > 0) {
      setSelectedSeries(content);
    } else if (content.video_url) {
      /* VIDEO SLIDER PAUSE Logic: handled by !playerModal.open check in render */
      const playerState = {
        open: true,
        url: content.video_url,
        urls: content.video_urls,
        title: content.title,
        isPremium: content.isPremium,
        image: content.thumbnail_url,
        description: content.description,
        rating: content.rating
      };

      if (content.is_cinema_mode) {
        setPendingPlayerState(playerState);
        setShowCinemaModal(true);
      } else {
        setPlayerModal(playerState);
      }
    } else {
      toast.error("Link de vídeo não disponível");
    }
  };

  const handleInfoContent = (content: Content) => {
    // Quick View Modal
    setQuickViewContent(content);
  };

  const handleDetailsContent = (content: Content) => {
    // Navigate to Details Page
    navigate(`/content/${content.id}`);
  };

  const handleDownloadContent = (content: Content) => {
    if (!user) {
      toast.error("Faça login para baixar conteúdo");
      navigate("/login");
      return;
    }
    if (content.download_url) {
      setDownloadModal({
        open: true,
        url: content.download_url,
        title: content.title,
        thumbnail: content.thumbnail_url
      });
    } else {
      toast.error("Link de download não disponível");
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

  const showAllRows = selectedCategory === 'Todos';
  const showSingleRow = !showAllRows && categorizedContent.singleRow && categorizedContent.singleRow.length > 0;

  const currentTrailer = trailerContents.length > 0 ? trailerContents[currentTrailerIndex] : null;

  /* Determine Active Content for Info Card */
  const activeContent = (currentTrailer && currentTrailer.trailer_url)
    ? currentTrailer
    : (allContentData.length > 0 ? allContentData[currentImageIndex] : null);

  const isInList = activeContent ? myList.some(item => item.contentId === activeContent.id) : false;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      {/* Header Ad */}
      <AdManager placement="header" className="container mx-auto px-4 pt-20" />

      {/* Hero Section */}
      <div className="relative py-12 flex items-center justify-center overflow-hidden min-h-[500px] w-full">
        {/* Hero Background: Image first (15s), then Video */}
        {!playerModal.open && currentTrailer && currentTrailer.trailer_url && showVideo && getYouTubeId(currentTrailer.trailer_url) ? (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div className="relative w-full h-full">
              <iframe
                ref={iframeRef}
                key={currentTrailer.id}
                className="absolute top-1/2 left-1/2 w-[150%] h-[150%] -translate-x-1/2 -translate-y-1/2 opacity-60"
                src={`https://www.youtube.com/embed/${getYouTubeId(currentTrailer.trailer_url)}?autoplay=1&mute=0&controls=0&enablejsapi=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&end=90`}
                title="Hero Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                style={{ pointerEvents: 'auto' }}
              />
            </div>
          </div>
        ) : (
          /* Show Image (either during 15s delay or as fallback) */
          <div className="absolute inset-0 z-0">
            {currentTrailer ? (
              <>
                <img
                  src={currentTrailer.thumbnail_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/95" />
              </>
            ) : (
              /* Fallback to all content images if no trailers */
              allContentData.length > 0 && (
                <>
                  {allContentData.map((content, index) => (
                    <div
                      key={content.id}
                      className={`absolute inset-0 transition-opacity duration-1000 ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                        }`}
                    >
                      <img
                        src={content.thumbnail_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/95" />
                </>
              )
            )}
          </div>
        )}

        {/* Audio Toggle Button - Only show if video is active AND open */}
        {!playerModal.open && currentTrailer && currentTrailer.trailer_url && (
          <div className="absolute right-8 bottom-32 z-50 hidden md:block">
            <button
              onClick={toggleAudio}
              className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all backdrop-blur-md shadow-lg"
              aria-label={isMuted ? "Ativar som" : "Mudo"}
            >
              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </button>
          </div>
        )}

        <div className={`relative z-20 text-center px-4 max-w-5xl mx-auto w-full flex flex-col items-center transition-opacity duration-1000 ${heroTextVisible ? 'opacity-100' : 'opacity-0'
          }`}>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-3 drop-shadow-lg pt-8">
            Bem-vindo ao Uni<span className="text-primary glow-effect">Tv</span>Film
          </h1>
          <p className="text-lg text-foreground/90 drop-shadow-md mb-8">
            Sua plataforma de streaming com os melhores filmes, séries e canais de TV
          </p>

          {/* Category Navigation */}
          <div className="w-full flex justify-center mb-10">
            <CategoryNavigation
              categories={ALL_CATEGORIES}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>

          {/* INFO CARD - MEDIUM SIZE */}
          {activeContent && (
            <div className="w-full max-w-3xl mx-auto z-50 relative animate-in fade-in zoom-in duration-700">
              <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-4 md:p-5 flex flex-col md:flex-row items-start gap-5 shadow-2xl hover:bg-black/80 transition-all">
                <div className="relative group shrink-0 mx-auto md:mx-0">
                  <img
                    src={activeContent.thumbnail_url}
                    alt={activeContent.title}
                    className="w-24 h-36 md:w-28 md:h-42 object-cover rounded-lg shadow-xl group-hover:scale-105 transition-transform duration-300 ring-1 ring-white/10"
                  />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between h-full w-full text-left">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="bg-primary/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        Assista agora
                      </span>
                      {/* TMDB Rating */}
                      <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-500 text-xs font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        {activeContent.rating ? activeContent.rating.toFixed(1) : "N/A"}
                      </div>
                      <span className="text-[10px] text-gray-300 uppercase border border-white/20 px-1.5 py-0.5 rounded font-medium bg-white/5">
                        {activeContent.category === 'movie' ? 'Filme' : activeContent.category === 'series' ? 'Série' : 'TV'}
                      </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-bold text-white mb-2 truncate leading-tight">
                      {activeContent.title}
                    </h3>
                    <p className="text-sm text-gray-300 line-clamp-2 mb-4 leading-relaxed">
                      {activeContent.description || "Sem descrição disponível."}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2.5 mt-auto">
                    <Button
                      onClick={() => handlePlayContent(activeContent)}
                      className="bg-primary hover:bg-primary/90 text-white font-semibold h-9 px-5 rounded-md transition-all hover:scale-105 shadow-lg shadow-primary/20 text-sm"
                    >
                      <Play className="w-4 h-4 mr-1.5 fill-current" /> Assistir
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleInfoContent(activeContent)}
                      className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:border-white/40 h-9 px-4 rounded-md backdrop-blur-sm transition-all text-sm"
                    >
                      <Info className="w-4 h-4 mr-1.5" /> Detalhes
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => handleToggleMyList(activeContent)}
                      className="text-white hover:bg-white/10 h-9 w-9 rounded-full border border-white/10"
                      title={isInList ? "Remover da lista" : "Adicionar à lista"}
                    >
                      {isInList ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                      <span className="sr-only">Minha Lista</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content Sections */}
      <div className="pt-4 pb-16">
        {showAllRows && (
          <>
            {/* Featured Random Content - Always First */}
            {categorizedContent.featured.length > 0 && (
              <MarqueeContentRow
                title="Em Destaque"
                contents={categorizedContent.featured}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent}
                onDetailsContent={handleDetailsContent}
                onDownloadContent={handleDownloadContent}
                showNumbers={true}
              />
            )}

            {/* Top Rated Content - Static Row */}
            {categorizedContent.topRated && categorizedContent.topRated.length > 0 && (
              <ContentRow
                title="Mais Assistidos"
                contents={categorizedContent.topRated}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent} // For QuickView
                onDetailsContent={handleDetailsContent}
                onDownloadContent={handleDownloadContent}
              // @ts-ignore - ContentRow needs update for onDetails prop, but passing it wont hurt if ignored for now, 
              // we need to update ContentRow to pass it to Card. 
              // Better approach: verify ContentRow passes props.
              />
            )}

            {categorizedContent.movies.length > 0 && (
              <ContentRow
                title="Filmes"
                contents={categorizedContent.movies}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent}
                onDownloadContent={handleDownloadContent}
              />
            )}

            {/* Between Content Ad */}
            <AdManager placement="between-content" className="container mx-auto px-4" />

            {categorizedContent.series.length > 0 && (
              <ContentRow
                title="Séries"
                contents={categorizedContent.series}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent}
                onDownloadContent={handleDownloadContent}
              />
            )}

            {categorizedContent.tvChannels.length > 0 && (
              <ContentRow
                title="TV ao Vivo"
                contents={categorizedContent.tvChannels}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent}
                onDownloadContent={handleDownloadContent}
              />
            )}
          </>
        )}

        {showSingleRow && (
          <MarqueeContentRow
            title={categorizedContent.singleRowTitle || 'Conteúdo Filtrado'}
            contents={categorizedContent.singleRow || []}
            onPlayContent={handlePlayContent}
            onInfoContent={handleInfoContent}
            onDownloadContent={handleDownloadContent}
          />
        )}

        {!showAllRows && categorizedContent.singleRow && categorizedContent.singleRow.length === 0 && (
          <div className="text-center py-16 px-4">
            <p className="text-xl text-muted-foreground">
              Nenhum conteúdo encontrado na categoria "{selectedCategory}".
            </p>
          </div>
        )}

        {allContentData.length === 0 && (
          <div className="text-center py-16 px-4">
            <p className="text-xl text-muted-foreground">
              Nenhum conteúdo disponível ainda. Acesse o painel admin para adicionar!
            </p>
          </div>
        )}
      </div>

      {/* Footer Ad */}
      <AdManager placement="footer" className="container mx-auto px-4 pb-8" />

      {/* Mobile Bottom Ad */}
      <AdManager placement="mobile-bottom" className="md:hidden fixed bottom-0 left-0 right-0 z-40" />

      {/* Episode Selector Modal */}
      {selectedSeries && (
        <EpisodeSelector
          open={!!selectedSeries}
          onClose={() => setSelectedSeries(null)}
          episodes={selectedSeries.episodes || []}
          title={selectedSeries.title}
          trailerUrl={selectedSeries.trailer_url}
          onPlayEpisode={(url, episodeTitle) => {
            const playerState = { open: true, url, title: selectedSeries.title, isPremium: selectedSeries.isPremium, image: selectedSeries.thumbnail_url, description: selectedSeries.description, rating: selectedSeries.rating, episodeTitle };
            if (selectedSeries.is_cinema_mode) {
              setPendingPlayerState(playerState);
              setShowCinemaModal(true);
            } else {
              setPlayerModal(playerState);
            }
          }}
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
        suggestions={randomContent}
        onPlayContent={(content) => {
          if (content.video_url || content.internal_player_url) {
            const playerState = {
              open: true,
              url: content.video_url || '',
              urls: content.video_urls,
              title: content.title,
              isPremium: content.isPremium,
              image: content.thumbnail_url,
              internalUrl: content.internal_player_url,
              description: content.description,
              rating: content.rating
            };

            if (content.is_cinema_mode) {
              setPendingPlayerState(playerState);
              setShowCinemaModal(true);
            } else {
              setPlayerModal(playerState);
            }
          }
        }}
        onAddToMyList={handleToggleMyList}
      />

      {/* Download Modal */}
      <DownloadModal
        open={downloadModal.open}
        onClose={() => setDownloadModal(prev => ({ ...prev, open: false }))}
        downloadUrl={downloadModal.url}
        title={downloadModal.title}
        thumbnail={downloadModal.thumbnail}
      />

      {/* Quick View Modal */}
      <QuickViewModal
        open={!!quickViewContent}
        content={quickViewContent}
        onClose={() => setQuickViewContent(null)}
        onPlay={handlePlayContent}
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
  );
};

export default Index;
