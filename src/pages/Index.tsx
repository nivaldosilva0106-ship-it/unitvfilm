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
import { WifiOff, Library, Globe } from 'lucide-react';
import { ConnectivityChoiceModal } from "@/components/ConnectivityChoiceModal";

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


import { useSpatialNavigation, FOCUSABLE_CLASS } from "@/hooks/useSpatialNavigation";

const Index = () => {
  const navigate = useNavigate();
  useSpatialNavigation({ enabled: true });
  const { user, currentProfile, loading: authLoading } = useAuth();
  const { isLiteMode, enableVideoHero, maxCardsInRow, maxSectionsPerPage } = useAppConfig();
  const isOnline = useOnlineStatus();

  const [allContentData, setAllContentData] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [heroReady, setHeroReady] = useState(false);
  const [randomContent, setRandomContent] = useState<Content[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedSeries, setSelectedSeries] = useState<Content | null>(null);
  const [playerModal, setPlayerModal] = useState<{ open: boolean, url: string, urls?: string[], title: string, isPremium?: boolean, image?: string, description?: string, rating?: number, episodeTitle?: string, internalUrl?: string, nextEpisode?: any }>({ open: false, url: '', title: '', isPremium: false });
  const [downloadModal, setDownloadModal] = useState<{ open: boolean, url: string, downloads?: { label: string; url: string; type?: 'direct' | 'torrent' }[], download_mode?: 'direct' | 'torrent' | 'mixed', title: string, thumbnail: string, contentId?: string }>({ open: false, url: '', title: '', thumbnail: '' });
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
  const [showConnectivityModal, setShowConnectivityModal] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasChosenOnline, setHasChosenOnline] = useState(false);

  useEffect(() => {
    if (!authLoading && user && !currentProfile) {
      navigate('/profiles');
    }
  }, [user, currentProfile, authLoading, navigate]);

  // CRITICAL: When isOnline changes to false, immediately mark network as failed
  useEffect(() => {
    if (!isOnline) {
      if (!hasChosenOnline) {
        setNetworkFailed(true);
        setLoading(false);
      }
    }
  }, [isOnline, hasChosenOnline]);

  // SAFETY NET: If still loading after 12 seconds, trigger connectivity choice instead of force-fail
  useEffect(() => {
    const safety = setTimeout(() => {
      setLoading(prev => {
        if (prev && !hasChosenOnline && retryCount >= 10) {
          console.warn('[UniTvFilm] Safety timeout — triggering connectivity choice');
          setShowConnectivityModal(true);
          return prev; 
        }
        return prev;
      });
    }, 12000); 
    return () => clearTimeout(safety);
  }, [hasChosenOnline, retryCount]);

  // SAFETY NET: If hero doesn't load/play after 5 seconds of database data loading, proceed anyway
  useEffect(() => {
    if (!loading) {
      const timeout = setTimeout(() => {
        setHeroReady(true);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

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
    if (!navigator.onLine || !isOnline) {
      if (!hasChosenOnline) {
        setLoading(false);
        setNetworkFailed(true);
        return;
      }
    }
    
    // If choice modal is active, don't try to load yet to save resources
    if (showConnectivityModal) return;

    // Parallelize content and settings loading for speed
    await Promise.allSettled([
      loadContent(),
      (async () => {
        try {
          const settings = await withTimeout(getSiteSettings(), 5000, null);
          if (settings) setSiteSettings(settings);
        } catch {}
      })(),
      (async () => {
        if (user && currentProfile) {
          await loadMyList();
        }
      })()
    ]);
  };

  useEffect(() => {
    // Hide "Bem-vindo" text after 4 seconds
    const timer = setTimeout(() => {
      setHeroTextVisible(false);
    }, 4000);
    // Delay hero video load for 2s to allow the page to render first (perf optimization for weaker devices)
    const videoTimer = setTimeout(() => {
      if (enableVideoHero) {
        setShowVideo(true);
      }
    }, 2000);
    return () => { clearTimeout(timer); clearTimeout(videoTimer); };
  }, []);

  const loadContent = async () => {
    let hasCache = false;
    try {
      // 1. Instant Cache Load
      const cached = localStorage.getItem('cached_contents');
      if (cached) {
        try {
          const cachedData = JSON.parse(cached);
          if (Array.isArray(cachedData) && cachedData.length > 0) {
            setAllContentData(cachedData);
            hasCache = true;

            // Instantly load slider from cache to avoid flicker on initial render
            const featuredCandidates = cachedData.filter((c: any) => c.backdrop_url && c.category !== 'tv');
            const shuffledFeatured = [...featuredCandidates].sort(() => Math.random() - 0.5);
            setTrailerContents(shuffledFeatured.slice(0, 5));
          }
        } catch (e) {}
      }

      // Only show loading screen if we have no data at all
      if (!hasCache && allContentData.length === 0) {
        setLoading(true);
      }

      // 2. Network Fetch with optimized timeout
      const data = await withTimeout(getAllContents(), 5000, [] as Content[]);

      if (data.length > 0) {
        setAllContentData(prev => {
          if (prev.length === data.length) return prev;
          return data;
        });
        try {
          localStorage.setItem('cached_contents', JSON.stringify(data));
        } catch (storageError) {
          console.warn("[UniTvFilm] Failed to save contents to localStorage:", storageError);
        }
      } else {
        // 3. Fallback/Retry logic if no data (network failed and no cache)
        if (allContentData.length === 0) {
          if (!hasChosenOnline) {
            if (retryCount < 2) {
              setRetryCount(prev => prev + 1);
              setTimeout(() => loadContent(), 1000);
              return;
            }
            setShowConnectivityModal(true);
            setLoading(false);
          } else {
            setNetworkFailed(true);
            setLoading(false);
          }
          return;
        }
      }

      const activeContents = data.length > 0 ? data : allContentData;
      const settings = await withTimeout(getSliderSettings(), 5000, { mode: 'random' as const, selectedContentIds: [] });

      let activeTrailers: Content[] = [];
      if (settings.mode === 'manual' && settings.selectedContentIds?.length > 0) {
        const selected = activeContents.filter((c: any) => settings.selectedContentIds.includes(c.id));
        if (selected.length > 0) {
          const shuffledManual = [...selected].sort(() => Math.random() - 0.5);
          activeTrailers = shuffledManual;
        } else {
          const featuredCandidates = activeContents.filter((c: any) => c.backdrop_url && c.category !== 'tv');
          activeTrailers = [...featuredCandidates].sort(() => Math.random() - 0.5).slice(0, 5);
        }
      } else {
        const featuredCandidates = activeContents.filter((c: any) => c.backdrop_url && c.category !== 'tv');
        activeTrailers = [...featuredCandidates].sort(() => Math.random() - 0.5).slice(0, 5);
      }
      
      setTrailerContents(prev => {
        if (settings.mode === 'manual') return activeTrailers;
        if (prev.length > 0) return prev;
        return activeTrailers;
      });

      setRandomContent(prev => {
        if (prev.length > 0) return prev;
        return [...activeContents.filter(c => c.status === 'active')].sort(() => Math.random() - 0.5);
      });
      setNetworkFailed(false);
      setRetryCount(0); // Success, reset retries

      // Preload images for smooth hero display
      const urlsToPreload = activeTrailers.map((c: any) => c.backdrop_url || c.thumbnail_url).filter(Boolean);
      if (urlsToPreload.length > 0) {
        let loadedCount = 0;
        let finished = false;
        const targetToLoad = Math.min(urlsToPreload.length, 2);
        
        const finishLoading = () => {
          if (!finished) {
            finished = true;
            setLoading(false);
          }
        };
        
        // Safety timeout of 3.5s
        const safetyTimeout = setTimeout(finishLoading, 3500);

        const onImageLoad = () => {
          loadedCount++;
          if (loadedCount >= targetToLoad) {
            clearTimeout(safetyTimeout);
            finishLoading();
          }
        };

        urlsToPreload.slice(0, targetToLoad).forEach((url: string) => {
          const img = new Image();
          img.src = url;
          img.onload = onImageLoad;
          img.onerror = onImageLoad;
        });
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading content:", error);
      if (retryCount < 10) {
        console.log(`[UniTvFilm] Error attempt ${retryCount + 1}/10, retrying...`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => loadContent(), 2000);
      } else {
        setNetworkFailed(true);
        setShowConnectivityModal(true);
        setLoading(false); // TOTAL FAILURE
      }
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
    const homeConfig = siteSettings?.homePageConfig;
    const itemsPerSection = homeConfig?.itemsPerSection || 20;
    const shouldShuffle = homeConfig?.enableRandomOrder !== false;

    const shuffle = <T,>(arr: T[]): T[] => shouldShuffle ? [...arr].sort(() => Math.random() - 0.5) : [...arr];

    const featuredPool = shuffle(allContentData.filter(c => c.is_new || (c.rating && c.rating >= 7)));
    const featured = featuredPool.slice(0, itemsPerSection);
    const topRated = shuffle(allContentData.filter(c => c.rating && c.rating >= 8));
    const movies = shuffle(allContentData.filter(c => c.category === 'movie' || (c.category as string) === 'Filme'));
    const series = shuffle(allContentData.filter(c => {
      const cat = c.category?.toLowerCase();
      return cat === 'series' || cat === 'série' || cat === 'serie' || (c.episodes && c.episodes.length > 0 && c.category !== 'canais24h' && c.category !== 'nostalgia');
    }));
    const tvChannels = shuffle(allContentData.filter(c => c.category === 'tv'));
    const nostalgia = shuffle(allContentData.filter(c => c.category === 'nostalgia'));
    const canais24h = shuffle(allContentData.filter(c => c.category === 'canais24h'));

    const actionAdventure = shuffle(allContentData.filter(c => c.genre?.some(g => g.toLowerCase().includes('ação') || g.toLowerCase().includes('aventura'))));
    const comedyHorror = shuffle(allContentData.filter(c => c.genre?.some(g => g.toLowerCase().includes('comédia') || g.toLowerCase().includes('terror'))));

    const recentReleases = allContentData
      .filter(c => {
        const releaseYear = c.year || (c.release_date ? new Date(c.release_date).getFullYear() : 0);
        const currentYear = new Date().getFullYear();
        return releaseYear === currentYear;
      })
      .sort((a, b) => new Date(b.release_date || b.created_at || 0).getTime() - new Date(a.release_date || a.created_at || 0).getTime());

    const dramaCrime = shuffle(allContentData.filter(c => c.genre?.some(g => ['drama', 'crime'].includes(g.toLowerCase()))));
    const comedyRomance = shuffle(allContentData.filter(c => c.genre?.some(g => ['comédia', 'romance'].includes(g.toLowerCase()))));

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
        singleRowTitle = 'TV ao Vivo';
      } else {
        singleRow = shuffle(allContentData.filter(c => c.genre?.includes(selectedCategory) || c.category === selectedCategory));
        singleRowTitle = selectedCategory;
      }
    }

    const getSectionLimit = (sectionId: string) => {
      const sectionConfig = homeConfig?.sections?.find(s => s.id === sectionId);
      return sectionConfig?.maxItems || itemsPerSection;
    };

    return {
      featured: featured.slice(0, getSectionLimit('featured')),
      topRated: topRated.slice(0, getSectionLimit('topRated')),
      movies: movies.slice(0, getSectionLimit('movies')),
      series: series.slice(0, getSectionLimit('series')),
      tvChannels: tvChannels.slice(0, getSectionLimit('canais24h')),
      nostalgia: nostalgia.slice(0, getSectionLimit('nostalgia')),
      canais24h: canais24h.slice(0, getSectionLimit('canais24h')),
      actionAdventure: actionAdventure.slice(0, getSectionLimit('action')),
      comedyHorror: comedyHorror.slice(0, getSectionLimit('comedy')),
      recentReleases: recentReleases.slice(0, getSectionLimit('recent')),
      dramaCrime: dramaCrime.slice(0, getSectionLimit('dramaCrime')),
      comedyRomance: comedyRomance.slice(0, getSectionLimit('comedyRomance')),
      singleRow: singleRow?.slice(0, itemsPerSection) || null,
      singleRowTitle
    };
  }, [allContentData, selectedCategory, siteSettings]);

  const randomSections = useMemo(() => {
    if (selectedCategory !== 'Todos') return [];

    const homeConfig = siteSettings?.homePageConfig;
    const enabledSections = homeConfig?.sections?.filter(s => s.enabled) || [];
    const enabledIds = new Set(enabledSections.map(s => s.id));
    const maxVisible = homeConfig?.maxSectionsVisible || (isLiteMode ? maxSectionsPerPage : 20);
    const showRecent = homeConfig?.enableRecentSection !== false;

    const sectionMap: Record<string, { id: string; type: string; title: string; data: Content[]; showNumbers: boolean; category: string }> = {
      featured: {
        id: 'featured',
        type: 'marquee',
        title: 'Em Destaque',
        data: categorizedContent.featured,
        showNumbers: true,
        category: 'Lançamentos'
      },
      recent: {
        id: 'recent',
        type: 'row',
        title: 'Lançamentos Recentes',
        data: categorizedContent.recentReleases,
        showNumbers: false,
        category: 'Lançamentos'
      },
      topRated: {
        id: 'topRated',
        type: 'row',
        title: 'Mais Assistidos',
        data: categorizedContent.topRated,
        showNumbers: false,
        category: 'Todos'
      },
      movies: {
        id: 'movies',
        type: 'row',
        title: 'Filmes',
        data: categorizedContent.movies,
        showNumbers: false,
        category: 'Filmes'
      },
      series: {
        id: 'series',
        type: 'row',
        title: 'Séries',
        data: categorizedContent.series,
        showNumbers: false,
        category: 'Séries'
      },
      nostalgia: {
        id: 'nostalgia',
        type: 'row',
        title: 'Nostalgia',
        data: categorizedContent.nostalgia,
        showNumbers: false,
        category: 'Nostalgia'
      },
      action: {
        id: 'action',
        type: 'row',
        title: 'Ação e Aventura',
        data: categorizedContent.actionAdventure,
        showNumbers: false,
        category: 'Ação'
      },
      dramaCrime: {
        id: 'dramaCrime',
        type: 'row',
        title: 'Drama & Crime',
        data: categorizedContent.dramaCrime,
        showNumbers: false,
        category: 'Drama'
      },
      comedyRomance: {
        id: 'comedyRomance',
        type: 'row',
        title: 'Comédia & Romance',
        data: categorizedContent.comedyRomance,
        showNumbers: false,
        category: 'Romance'
      },
      comedy: {
        id: 'comedy',
        type: 'row',
        title: 'Comédia e Terror',
        data: categorizedContent.comedyHorror,
        showNumbers: false,
        category: 'Terror'
      },
      canais24h: {
        id: 'canais24h',
        type: 'channels',
        title: 'Transmissão 24 Horas',
        data: categorizedContent.canais24h,
        showNumbers: false,
        category: 'Canais 24h'
      }
    };

    const orderedSections = enabledSections
      .map(s => sectionMap[s.id])
      .filter(s => s && s.data.length > 0);

    let finalSections = orderedSections;

    if (showRecent && sectionMap.recent.data.length > 0) {
      const recentIdx = finalSections.findIndex(s => s.id === 'recent');
      if (recentIdx === -1) {
        finalSections = [finalSections[0], sectionMap.recent, ...finalSections.slice(1)].filter(Boolean);
      }
    }

    finalSections = finalSections.slice(0, maxVisible);

    return finalSections;
  }, [categorizedContent, selectedCategory, siteSettings, isLiteMode, maxSectionsPerPage]);

  const currentTrailer = trailerContents[currentTrailerIndex] || null;

  const trailerContentsRef = useRef(trailerContents);
  useEffect(() => {
    trailerContentsRef.current = trailerContents;
  }, [trailerContents]);

  /* AGGRESSIVE UNMUTE Logic */
  useEffect(() => {
    setIsMuted(false);
  }, [currentTrailerIndex, playerModal.open]);

  useEffect(() => {
    if (isLiteMode) return;
    
    const interval = setInterval(() => {
      if (trailerContentsRef.current.length === 0 || playerModal.open) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentTrailerIndex((prev) => (prev + 1) % trailerContentsRef.current.length);
        setTimeout(() => {
          setIsTransitioning(false);
        }, 1000);
      }, 1500);
    }, 15000);
    return () => clearInterval(interval);
  }, [playerModal.open, isLiteMode]);

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

    const isSeries = content.category?.toLowerCase() === 'series' || 
                    content.category?.toLowerCase() === 'série' || 
                    content.category?.toLowerCase() === 'serie' ||
                    (content.episodes && content.episodes.length > 0);

    if (isSeries) {
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
    if (isLiteMode) {
      handlePlayContent(content);
      return;
    }
    
    if (content.category === 'canais24h') {
      navigate(`/canais24h?channelId=${content.id}`);
      return;
    }
    if (content.category === 'nostalgia') {
      navigate(`/nostalgia/${content.main_video_id || content.id}`);
      return;
    }
    const isSeries = content.category?.toLowerCase() === 'series' || 
                    content.category?.toLowerCase() === 'série' || 
                    content.category?.toLowerCase() === 'serie' ||
                    (content.episodes && content.episodes.length > 0);

    if (isSeries) {
       setSelectedSeries(content);
       return;
    }
    if (content.category === 'tv') {
      navigate(`/tv?channelId=${content.id}`);
      return;
    }
    navigate(`/content/${content.id}`);
  }, [navigate, isLiteMode, handlePlayContent]);

  const handleDownloadContent = useCallback((content: Content) => {
    setDownloadModal({
      open: true,
      url: content.video_url || '',
      downloads: content.downloads,
      download_mode: content.download_mode,
      title: content.title,
      thumbnail: content.thumbnail_url,
      contentId: content.id
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
  // If user chose to stay online, we only show offline UI if they specifically chose it later
  const isEffectivelyOffline = (!isOnline && !hasChosenOnline) || networkFailed;

  // Honor profile preference for local library — disabled by default in lite mode (Smart TV)
  const canShowLocalLib = isLiteMode ? false : ((currentProfile as any)?.showLocalLibrary !== false);

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

    if (loading && !isEffectivelyOffline) return <LoadingScreen />;

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
        onReady={() => setHeroReady(true)}
      />

      <div className="pt-4 pb-16">

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
                  className={`flex-shrink-0 w-[72px] h-[72px] sm:w-auto sm:h-auto sm:aspect-square bg-zinc-900/50 rounded-2xl border border-white/5 p-3 flex items-center justify-center cursor-pointer hover:bg-zinc-800 hover:border-primary/50 hover:scale-105 transition-all duration-300 shadow-lg group ${FOCUSABLE_CLASS}`}
                  tabIndex={0}
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

        {/* Local Content Section - Respects profile settings */}
        {(!selectedCategory || selectedCategory === 'Todos') && canShowLocalLib && (
          <LocalContentSection />
        )}

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
                    onViewMore={() => navigate(`/categories?filter=${encodeURIComponent(section.category || '')}`)}
                  />
                ) : section.type === 'channels' ? (
                  <div className="mb-12">
                    <div className="flex items-center justify-between mb-6 px-4 sm:px-8">
                      <div className="flex items-center gap-3">
                        <Tv className="w-6 h-6 text-primary" />
                        <h2 className="text-2xl font-bold text-foreground uppercase tracking-tighter italic">{section.title}</h2>
                      </div>
                      <button
                        onClick={() => navigate(`/categories?filter=${encodeURIComponent(section.category || '')}`)}
                        className={`text-sm text-primary hover:text-primary/80 font-semibold transition-colors ${FOCUSABLE_CLASS}`}
                        tabIndex={0}
                      >
                        Ver mais
                      </button>
                    </div>
                    <div className="relative group/row">
                      <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-8 py-2">
                        {section.data.map((channel: Content) => (
                          <div
                            key={channel.id}
                            className={`flex-shrink-0 w-[160px] sm:w-[200px] aspect-[4/3] rounded-xl overflow-hidden cursor-pointer group relative border border-zinc-800/50 hover:border-primary transition-all duration-300 ${FOCUSABLE_CLASS}`}
                            onClick={() => navigate(`/canais24h?channelId=${channel.id}`)}
                            tabIndex={0}
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
                    onViewMore={() => navigate(`/categories?filter=${encodeURIComponent(section.category || '')}`)}
                  />
                )}
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
          thumbnail={selectedSeries.thumbnail_url}
          onPlayEpisode={(ep) => {
            const watchUrl = `/watch/${selectedSeries.id}?season=${ep.season}&episode=${ep.episode}`;
            if (selectedSeries.is_cinema_mode) {
              setPendingPlayerState({ contentId: selectedSeries.id, season: ep.season, episode: ep.episode });
              setShowCinemaModal(true);
            } else {
              navigate(watchUrl);
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
        contentId={downloadModal.contentId || downloadModal.title}
      />

      <QuickViewModal
        open={!!quickViewContent}
        content={quickViewContent}
        onClose={() => setQuickViewContent(null)}
        onPlay={handlePlayContent}
      />

      <ConnectivityChoiceModal
        open={showConnectivityModal}
        onStayOnline={() => {
          setShowConnectivityModal(false);
          setHasChosenOnline(true);
          setNetworkFailed(false);
          setLoading(true);
          // Retry loading
          loadContent();
        }}
        onGoOffline={() => {
          setShowConnectivityModal(false);
          setNetworkFailed(true);
          setLoading(false);
        }}
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
