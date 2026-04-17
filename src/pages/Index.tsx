import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Volume2, VolumeX, Play, Info, Plus, Check, Star, Tv } from "lucide-react";
import { ContentRow } from "@/components/ContentRow";
import { MarqueeContentRow } from "@/components/MarqueeContentRow";
import { CategoryNavigation } from "@/components/CategoryNavigation";
import { Content } from "@/types/content";
import { getAllContents, getMyList, addToMyList, removeFromMyList, getSliderSettings, getSiteSettings, type SliderSettings, type SiteSettings } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { MyListItem } from "@/types/user";
import { IndexHero } from "@/components/IndexHero";
import { STREAMING_PROVIDERS, getProviderConfig } from "@/lib/providers";
import { LocalContentSection } from "@/components/LocalContentSection";
import { WifiOff, Library } from 'lucide-react';

// Lazy load heavy components
const EpisodeSelector = React.lazy(() => import("@/components/EpisodeSelector").then(module => ({ default: module.EpisodeSelector })));
const ContentPlayerModal = React.lazy(() => import("@/components/ContentPlayerModal").then(module => ({ default: module.ContentPlayerModal })));
const DownloadModal = React.lazy(() => import("@/components/DownloadModal").then(module => ({ default: module.DownloadModal })));
const CinemaWarningModal = React.lazy(() => import("@/components/CinemaWarningModal").then(module => ({ default: module.CinemaWarningModal })));
const QuickViewModal = React.lazy(() => import("@/components/QuickViewModal").then(module => ({ default: module.QuickViewModal })));
const AdManager = React.lazy(() => import("@/components/AdManager").then(module => ({ default: module.AdManager })));

const ALL_CATEGORIES = ['Todos', 'Filmes', 'Séries', 'TV ao Vivo', 'Lançamentos', 'Ação', 'Terror'];

const getYouTubeId = (url: string | undefined | null) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

const Index = () => {
  const navigate = useNavigate();
  const { user, currentProfile, loading: authLoading } = useAuth();
  const { isLiteMode, enableVideoHero, maxCardsInRow } = useAppConfig();
  const isOnline = useOnlineStatus();

  const [allContentData, setAllContentData] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [randomContent, setRandomContent] = useState<Content[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, urls?: string[], title: string, isPremium?: boolean, image?: string, description?: string, rating?: number, episodeTitle?: string, internalUrl?: string, nextEpisode?: any }>({ open: false, url: '', title: '', isPremium: false });
  const [downloadModal, setDownloadModal] = useState<{ open: boolean, url: string, downloads?: { label: string; url: string; type?: 'direct' | 'torrent' }[], download_mode?: 'direct' | 'torrent' | 'mixed', title: string, thumbnail: string }>({ open: false, url: '', title: '', thumbnail: '' });
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [quickViewContent, setQuickViewContent] = useState<Content | null>(null);
  const [showCinemaModal, setShowCinemaModal] = useState(false);
  const [pendingPlayerState, setPendingPlayerState] = useState<any>(null);

  const [trailerContents, setTrailerContents] = useState<Content[]>([]);
  const [currentTrailerIndex, setCurrentTrailerIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [heroTextVisible, setHeroTextVisible] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const [myList, setMyList] = useState<MyListItem[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [networkFailed, setNetworkFailed] = useState(!navigator.onLine);

  useEffect(() => {
    if (!authLoading && user && !currentProfile) {
      navigate('/profiles');
    }
  }, [user, currentProfile, authLoading, navigate]);

  // CRITICAL: When isOnline changes to false, immediately mark network as failed
  useEffect(() => {
    if (!isOnline) {
      setNetworkFailed(true);
      setLoading(false);
    }
  }, [isOnline]);

  // SAFETY NET: If still loading after 10 seconds, force-stop
  useEffect(() => {
    const safety = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('[UniTvFilm] Safety timeout — forcing loading to false');
          setNetworkFailed(true);
          return false;
        }
        return prev;
      });
    }, 10000);
    return () => clearTimeout(safety);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [user, currentProfile]);

  // Helper: race a promise against a timeout
  const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))
    ]);
  };

  const loadInitialData = async () => {
    // If we know we're offline, skip everything immediately
    if (!navigator.onLine || !isOnline || networkFailed) {
      setLoading(false);
      setNetworkFailed(true);
      return;
    }

    await loadContent();

    // Try to get site settings with a tight timeout (non-critical)
    try {
      const settings = await withTimeout(getSiteSettings(), 6000, null);
      if (settings) setSiteSettings(settings);
    } catch {
      // Non-critical, ignore
    }
    
    if (user && currentProfile) {
      loadMyList();
    }
  };

  useEffect(() => {
    // Hide "Bem-vindo" text after 4 seconds
    const timer = setTimeout(() => {
      setHeroTextVisible(false);
    }, 4000);
    // Delay hero video load for 8s to allow the page to render first (perf optimization for weaker devices)
    const videoTimer = setTimeout(() => {
      if (enableVideoHero) {
        setShowVideo(true);
      }
    }, 8000);
    return () => { clearTimeout(timer); clearTimeout(videoTimer); };
  }, []);

  const loadContent = async () => {
    try {
      setLoading(true);

      // Race against an 8-second timeout — if Firebase doesn't respond, assume offline
      const data = await withTimeout(getAllContents(), 8000, [] as Content[]);

      // If we got zero results and we might be offline, treat as network failure
      if (data.length === 0) {
        setNetworkFailed(true);
        setLoading(false);
        return;
      }

      setAllContentData(data);

      const settings = await withTimeout(getSliderSettings(), 5000, { mode: 'random' as const, selectedContentIds: [] });

      // Daily Random Seed
      const today = new Date().toISOString().slice(0, 10);
      let seed = 0;
      for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i);

      if (settings.mode === 'manual' && settings.selectedContentIds?.length > 0) {
        const selected = data.filter(c => settings.selectedContentIds.includes(c.id));
        const shuffledManual = [...selected].sort(() => 0.5 - Math.random());
        setTrailerContents(shuffledManual.length > 0 ? shuffledManual : data.slice(0, 5));
      } else {
        const featuredCandidates = data.filter(c => c.backdrop_url && c.category !== 'tv');
        setTrailerContents([...featuredCandidates].sort(() => 0.5 - Math.random()).slice(0, 5));
      }

      setRandomContent([...data].sort(() => 0.5 - Math.random()));
      setNetworkFailed(false);
    } catch (error) {
      console.error("Error loading content:", error);
      setNetworkFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMyList = async () => {
    if (!currentProfile) return;
    try {
      const list = await getMyList(currentProfile.id);
      setMyList(list);
    } catch (error) {
      console.error("Error loading My List:", error);
    }
  };

  const categorizedContent = useMemo(() => {
    // Featured section shows random mix of new or high rated content for variety
    const featuredPool = allContentData.filter(c => c.is_new || (c.rating && c.rating >= 7));
    const featured = [...featuredPool].sort(() => 0.5 - Math.random()).slice(0, 10);
    const topRated = allContentData.filter(c => c.rating && c.rating >= 8).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 10);
    const movies = allContentData.filter(c => c.category === 'movie' || c.category === 'Filme');
    const series = allContentData.filter(c => c.category === 'series' || c.category === 'Série');
    const tvChannels = allContentData.filter(c => c.category === 'tv');
    const nostalgia = allContentData.filter(c => c.category === 'nostalgia');
    const canais24h = allContentData.filter(c => c.category === 'canais24h');

    // Additional filtered categories for the UI
    const actionAdventure = allContentData.filter(c => c.genre?.some(g => g.toLowerCase().includes('ação') || g.toLowerCase().includes('aventura')));
    const comedyHorror = allContentData.filter(c => c.genre?.some(g => g.toLowerCase().includes('comédia') || g.toLowerCase().includes('terror')));

    const recentReleases = allContentData.filter(c => {
      const releaseYear = c.year || (c.release_date ? new Date(c.release_date).getFullYear() : 0);
      const currentYear = new Date().getFullYear();
      return releaseYear === currentYear;
    });

    const dramaCrime = allContentData.filter(c => c.genre?.some(g => ['drama', 'crime'].includes(g.toLowerCase())));
    const comedyRomance = allContentData.filter(c => c.genre?.some(g => ['comédia', 'romance'].includes(g.toLowerCase())));

    let singleRow: Content[] | null = null;
    let singleRowTitle = '';

    if (selectedCategory !== 'Todos') {
      if (selectedCategory === 'Filmes') {
        singleRow = movies;
        singleRowTitle = 'Filmes';
      } else if (selectedCategory === 'Séries') {
        singleRow = series;
        singleRowTitle = 'Séries';
      } else if (selectedCategory === 'TV ao Vivo') {
        singleRow = tvChannels;
        singleRowTitle = 'Canais de TV';
      } else {
        singleRow = allContentData.filter(c => c.genre?.includes(selectedCategory) || c.category === selectedCategory);
        singleRowTitle = selectedCategory;
      }
    }

    return { featured, topRated, movies, series, tvChannels, nostalgia, canais24h, actionAdventure, comedyHorror, recentReleases, dramaCrime, comedyRomance, singleRow, singleRowTitle };
  }, [allContentData, selectedCategory, siteSettings]);

  const randomSections = useMemo(() => {
    if (selectedCategory !== 'Todos') return [];

    const featuredSection = {
      id: 'featured',
      type: 'marquee',
      title: 'Em Destaque',
      data: categorizedContent.featured,
      showNumbers: true
    };

    const shufflableSections = [
      { id: 'recent', type: 'row', title: 'Lançamentos Recentes', data: [...categorizedContent.recentReleases].sort(() => Math.random() - 0.5), showNumbers: false },
      { id: 'trending', type: 'row', title: 'Em Alta', data: [...categorizedContent.topRated].sort((a, b) => (b.rating || 0) - (a.rating || 0)), showNumbers: false },
      { id: 'topRated', type: 'row', title: 'Mais Assistidos', data: [...categorizedContent.topRated].sort(() => Math.random() - 0.5), showNumbers: false },
      { id: 'movies', type: 'row', title: 'Filmes', data: [...categorizedContent.movies].sort(() => Math.random() - 0.5), showNumbers: false },
      { id: 'series', type: 'row', title: 'Séries', data: [...categorizedContent.series].sort(() => Math.random() - 0.5), showNumbers: false },
      { id: 'nostalgia', type: 'row', title: 'Nostalgia', data: [...categorizedContent.nostalgia].sort(() => Math.random() - 0.5), showNumbers: false },
      { id: 'action', type: 'row', title: 'Ação e Aventura', data: [...categorizedContent.actionAdventure].sort(() => Math.random() - 0.5), showNumbers: false },
      { id: 'dramaCrime', type: 'row', title: 'Drama & Crime', data: [...categorizedContent.dramaCrime].sort(() => Math.random() - 0.5), showNumbers: false },
      { id: 'comedyRomance', type: 'row', title: 'Comédia & Romance', data: [...categorizedContent.comedyRomance].sort(() => Math.random() - 0.5), showNumbers: false },
      { id: 'comedy', type: 'row', title: 'Comédia e Terror', data: [...categorizedContent.comedyHorror].sort(() => Math.random() - 0.5), showNumbers: false },
    ].filter(s => s.data.length > 0);

    // Shuffle only the non-featured sections
    const shuffled = shufflableSections.sort(() => Math.random() - 0.5);

    const tvSection = {
      id: 'tv',
      type: 'row',
      title: 'TV ao Vivo',
      data: [...categorizedContent.tvChannels].sort(() => Math.random() - 0.5),
      showNumbers: false
    };

    const canais24hSection = {
      id: 'canais24h',
      type: 'channels',
      title: 'Transmissão 24 Horas',
      data: [...categorizedContent.canais24h].sort(() => Math.random() - 0.5),
      showNumbers: false
    };

    // Return Featured first + Shuffled sections + Canais 24h + TV ALWAYS LAST
    const finalSections = [featuredSection, ...shuffled];
    
    // Apply item limits for Lite mode
    if (isLiteMode) {
      finalSections.forEach(s => {
        if (s.data.length > maxCardsInRow) {
          s.data = s.data.slice(0, maxCardsInRow);
        }
      });
    }

    if (canais24hSection.data.length > 0) {
      finalSections.push(canais24hSection);
    }
    if (tvSection.data.length > 0) {
      finalSections.push(tvSection);
    }

    return finalSections;
  }, [categorizedContent, selectedCategory]);

  const currentTrailer = trailerContents[currentTrailerIndex] || null;

  /* AGGRESSIVE UNMUTE Logic */
  useEffect(() => {
    setIsMuted(false);
  }, [currentTrailerIndex, playerModal.open]);

  useEffect(() => {
    if (trailerContents.length > 0 && !playerModal.open) {
      const interval = setInterval(() => {
        if (isLiteMode) return; // Don't auto-transition hero in Lite mode
        setIsTransitioning(true);
        setTimeout(() => {
          setCurrentTrailerIndex((prev) => (prev + 1) % trailerContents.length);
          setTimeout(() => {
            setIsTransitioning(false);
          }, 500);
        }, 1000);
      }, 90000);
      return () => clearInterval(interval);
    }
  }, [trailerContents, playerModal.open]);

  const toggleAudio = () => setIsMuted(!isMuted);

  const handlePlayContent = useCallback((content: Content) => {
    if (content.category === 'canais24h') {
      navigate(`/canais24h?channelId=${content.id}`);
      return;
    }

    if (content.category === 'nostalgia') {
      navigate(`/nostalgia/${content.id}`);
      return;
    }

    if (content.category === 'series') {
      setSelectedSeries(content);
      return;
    }

    if (content.category === 'tv') {
      navigate(`/tv?channelId=${content.id}`);
      return;
    }

    if (content.is_cinema_mode) {
      setPendingPlayerState({ ...content, contentId: content.id });
      setShowCinemaModal(true);
    } else {
      navigate(`/watch/${content.id}`);
    }
  }, [navigate]);

  const handleInfoContent = useCallback((content: Content) => {
    setQuickViewContent(content);
  }, []);

  // When clicking the card itself (not the play button)
  const handleDetailsContent = useCallback((content: Content) => {
    if (content.category === 'canais24h') {
      navigate(`/canais24h?channelId=${content.id}`);
      return;
    }
    if (content.category === 'nostalgia') {
      navigate(`/nostalgia/${content.main_video_id || content.id}`);
      return;
    }
    if (content.category === 'tv') {
      navigate(`/tv?channelId=${content.id}`);
      return;
    }
    navigate(`/content/${content.id}`);
  }, [navigate]);

  const handleDownloadContent = useCallback((content: Content) => {
    setDownloadModal({
      open: true,
      url: content.video_url || '',
      downloads: content.downloads,
      download_mode: content.download_mode,
      title: content.title,
      thumbnail: content.thumbnail_url
    });
  }, []);

  const handleToggleMyList = useCallback(async (content: Content) => {
    if (!currentProfile) {
      toast.error("Faça login para salvar na lista");
      return;
    }

    const itemInList = myList.find(item => item.contentId === content.id);
    try {
      if (itemInList) {
        await removeFromMyList(currentProfile.id, itemInList.id);
        setMyList(prev => prev.filter(i => i.id !== itemInList.id));
        toast.success("Removido da Minha Lista");
      } else {
        const newItem = await addToMyList(currentProfile.id, content);
        setMyList(prev => [...prev, newItem]);
        toast.success("Adicionado à Minha Lista");
      }
    } catch (error) {
      toast.error("Erro ao atualizar lista");
    }
  }, [currentProfile, myList]);

  const getNextEpisode = (series: Content, currentSeason: number, currentEpisodeNum: number) => {
    if (!series.episodes) return null;
    const episodes = series.episodes;

    // Try next episode in same season
    let next = episodes.find(e => e.season === currentSeason && e.episode === currentEpisodeNum + 1);
    if (next) return next;

    // Try first episode of next season
    next = episodes.find(e => e.season === currentSeason + 1 && e.episode === 1);
    return next || null;
  };

  const isInList = (contentId: string) => myList.some(item => item.contentId === contentId);

  // OFFLINE MODE: When offline OR network failed, show local library immediately
  // This MUST come before the loading gate to prevent infinite loading spinner
  const isEffectivelyOffline = !isOnline || networkFailed;

  // Honor profile preference for local library
  const canShowLocalLib = currentProfile?.showLocalLibrary !== false;

  if (isEffectivelyOffline && allContentData.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        {/* Offline Banner */}
        <div className="bg-gradient-to-r from-red-900/80 to-orange-900/80 border-b border-red-500/30 px-4 py-3 text-center mt-16 sm:mt-20">
          <div className="flex items-center justify-center gap-2 text-white">
            <WifiOff className="w-5 h-5" />
            <span className="font-bold text-sm">Modo Offline</span>
            <span className="text-white/70 text-sm hidden sm:inline">— Exibindo apenas conteúdo da Biblioteca Local</span>
          </div>
        </div>
        <div className="pt-8 flex-1 flex flex-col">
          {canShowLocalLib ? (
            <LocalContentSection fullPage={true} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <WifiOff className="w-12 h-12 text-zinc-600 mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Sem Conexão</h2>
              <p className="text-zinc-500 max-w-xs">A biblioteca local está desativada para este perfil. Verifique sua conexão ou ative-a nas configurações de perfil.</p>
            </div>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  // If we are strictly offline, ignore authLoading and show what we can
  const shouldWaitAuth = authLoading && !isEffectivelyOffline;

  if ((loading || shouldWaitAuth) && !isEffectivelyOffline) return <LoadingScreen />;

  const showAllRows = selectedCategory === 'Todos';
  // Ensure we have a single row content OR we are in a selected state (which might be empty, but we'll handle the UI)
  const showSingleRow = (selectedCategory !== 'Todos');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <AdManager placement="header" className="container mx-auto px-4 pt-20" />

      <IndexHero
        currentTrailer={currentTrailer}
        showVideo={showVideo}
        getYouTubeId={getYouTubeId}
        isTransitioning={isTransitioning}
        isMuted={isMuted}
        heroTextVisible={heroTextVisible}
        activeContent={currentTrailer}
        allContentData={allContentData}
        currentImageIndex={currentImageIndex}
        playerModalOpen={playerModal.open}
        quickViewContentOpen={!!quickViewContent}
        selectedSeriesOpen={!!selectedSeries}
        isInList={currentTrailer ? isInList(currentTrailer.id) : false}
        toggleAudio={toggleAudio}
        handlePlayContent={handlePlayContent}
        handleInfoContent={handleInfoContent}
        handleToggleMyList={currentTrailer ? () => handleToggleMyList(currentTrailer) : () => { }}
        providerLogos={siteSettings?.providerLogos}
      />

      <div className="pt-4 pb-16">
        {/* Seção Biblioteca Local (If profile allows) */}
        {(!selectedCategory || selectedCategory === 'Todos') && canShowLocalLib && (
          <LocalContentSection />
        )}

        {/* Streaming Providers Section - ALWAYS FIRST as requested */}
        {selectedCategory === 'Todos' && (
          <div className="mb-12 px-4 sm:px-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-8 bg-primary rounded-full" />
              <h2 className="text-2xl font-bold text-foreground uppercase tracking-tighter italic">Provedores de Streaming</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 sm:grid sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 sm:gap-4 sm:overflow-visible">
              {STREAMING_PROVIDERS.map((provider) => (
                <div
                  key={provider.id}
                  onClick={() => {
                    navigate(`/provider/${provider.id}`);
                  }}
                  className="flex-shrink-0 w-[72px] h-[72px] sm:w-auto sm:h-auto sm:aspect-square bg-zinc-900/50 rounded-2xl border border-white/5 p-3 flex items-center justify-center cursor-pointer hover:bg-zinc-800 hover:border-primary/50 hover:scale-105 transition-all duration-300 shadow-lg group"
                >
                  <img
                    src={siteSettings?.providerLogos?.[provider.id] || provider.logo}
                    alt={provider.name}
                    className="w-full h-full object-contain filter group-hover:brightness-110"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Local Content Section - New */}
        <LocalContentSection />

        {showAllRows && (
          <>
            {randomSections.map((section, index) => (
              <React.Fragment key={section.id}>
                {section.type === 'marquee' ? (
                  <MarqueeContentRow
                    title={section.title}
                    contents={section.data}
                    onPlayContent={handlePlayContent}
                    onInfoContent={handleInfoContent}
                    onDetailsContent={handleDetailsContent}
                    onDownloadContent={handleDownloadContent}
                    showNumbers={section.showNumbers}
                    hideDownloadIcon={true}
                    providerLogos={siteSettings?.providerLogos}
                  />
                ) : section.type === 'channels' ? (
                  <div className="mb-12">
                    <div className="flex items-center gap-3 mb-6 px-4 sm:px-8">
                      <Tv className="w-6 h-6 text-primary" />
                      <h2 className="text-2xl font-bold text-foreground uppercase tracking-tighter italic">{section.title}</h2>
                    </div>
                    <div className="relative group/row">
                      <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-8 py-2">
                        {section.data.map((channel: Content) => (
                          <div
                            key={channel.id}
                            className="flex-shrink-0 w-[160px] sm:w-[200px] aspect-[4/3] rounded-xl overflow-hidden cursor-pointer group relative border border-zinc-800/50 hover:border-primary transition-all duration-300"
                            onClick={() => navigate(`/canais24h?channelId=${channel.id}`)}
                          >
                            <img
                              src={channel.thumbnail_url}
                              alt={channel.title}
                              className="w-full h-full object-contain bg-zinc-900 p-4 group-hover:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent flex flex-col justify-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span className="text-xs font-black text-white truncate uppercase italic">{channel.title}</span>
                              <div className="flex items-center gap-1 mt-1">
                                <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                <span className="text-[10px] font-bold text-primary italic uppercase">Direto</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <ContentRow
                    title={section.title}
                    contents={section.data}
                    onPlayContent={handlePlayContent}
                    onInfoContent={handleInfoContent}
                    onDetailsContent={handleDetailsContent}
                    onDownloadContent={handleDownloadContent}
                    hideDownloadIcon={true}
                    providerLogos={siteSettings?.providerLogos}
                  />
                )}
                {/* Insert Ad after the 2nd item (index 1) */}
                {index === 1 && (
                  <AdManager placement="between-content" className="container mx-auto px-4" />
                )}
              </React.Fragment>
            ))}
          </>
        )}

        {showSingleRow && (
          <div className="px-4 sm:px-8">
            <MarqueeContentRow
                title={categorizedContent.singleRowTitle || 'Conteúdo Filtrado'}
                contents={categorizedContent.singleRow || []}
                onPlayContent={handlePlayContent}
                onInfoContent={handleInfoContent}
                onDownloadContent={handleDownloadContent}
                providerLogos={siteSettings?.providerLogos}
              />
          </div>
        )}
      </div>

      <AdManager placement="footer" className="container mx-auto px-4 pb-8" />
      <AdManager placement="mobile-bottom" className="md:hidden fixed bottom-0 left-0 right-0 z-40" />
      <Footer />

      {selectedSeries && (
        <EpisodeSelector
          open={!!selectedSeries}
          onClose={() => setSelectedSeries(null)}
          episodes={selectedSeries.episodes || []}
          title={selectedSeries.title}
          trailerUrl={selectedSeries.trailer_url}
          onPlayEpisode={(url, episodeTitle) => {
            const foundEp = selectedSeries.episodes?.find(e => e.url === url);
            if (foundEp) {
              const watchUrl = `/watch/${selectedSeries.id}?season=${foundEp.season}&episode=${foundEp.episode}`;
              if (selectedSeries.is_cinema_mode) {
                setPendingPlayerState({ contentId: selectedSeries.id, season: foundEp.season, episode: foundEp.episode });
                setShowCinemaModal(true);
              } else {
                navigate(watchUrl);
              }
            }
          }}
        />
      )}

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
        nextEpisode={playerModal.nextEpisode}
        isLastEpisode={false}
        onPlayNext={() => { }}
        onPlayContent={handlePlayContent}
        onAddToMyList={handleToggleMyList}
      />

      <DownloadModal
        open={downloadModal.open}
        onClose={() => setDownloadModal(prev => ({ ...prev, open: false }))}
        downloadUrl={downloadModal.url}
        downloads={downloadModal.downloads}
        download_mode={downloadModal.download_mode}
        title={downloadModal.title}
        thumbnail={downloadModal.thumbnail}
      />

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
            let watchUrl = '';
            if (pendingPlayerState.season && pendingPlayerState.episode) {
              watchUrl = `/watch/${pendingPlayerState.contentId}?season=${pendingPlayerState.season}&episode=${pendingPlayerState.episode}`;
            } else if (pendingPlayerState.contentId) {
              watchUrl = `/watch/${pendingPlayerState.contentId}`;
            } else {
              setPlayerModal(pendingPlayerState);
              setPendingPlayerState(null);
              setShowCinemaModal(false);
              return;
            }
            navigate(watchUrl);
            setPendingPlayerState(null);
            setShowCinemaModal(false);
          }
        }}
      />
    </div>
  );
};

export default Index;
