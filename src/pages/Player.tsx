import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { getAllContents, incrementDailyUsage } from "@/lib/firebase";
import { Content } from "@/types/content";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft, Film, Maximize, Minimize, List, Star, ChevronRight, Crown, Play } from "lucide-react";
import ReactPlayerComponent from 'react-player';
import { AdManager } from "@/components/AdManager";
import { useContentProtection } from "@/hooks/useContentProtection";
import { toast } from "sonner";

const ReactPlayer = ReactPlayerComponent as any;

const Player = () => {
    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { profile, isAdmin, checkAccess, plan } = useAuth();

    const [content, setContent] = useState<Content | null>(null);
    const [loading, setLoading] = useState(true);
    const [videoUrl, setVideoUrl] = useState<string>("");
    const [currentTitle, setCurrentTitle] = useState<string>("");
    const [nextEpisode, setNextEpisode] = useState<any>(null);
    const [accessState, setAccessState] = useState<{ granted: boolean; reason?: string | null }>({ granted: false }); // Default false until checked

    // Player state
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const [showSourceMenu, setShowSourceMenu] = useState(false);
    const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showWatchingCard, setShowWatchingCard] = useState(false);
    const [cardProgress, setCardProgress] = useState(100);
    const [showIntro, setShowIntro] = useState(true);
    const [suggestions, setSuggestions] = useState<Content[]>([]);
    const [showSuggestionsCard, setShowSuggestionsCard] = useState(false);
    const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false); // Sidebar toggle state

    const watchingCardTimerRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const hasIncrementedRef = useRef(false);

    const seasonParam = searchParams.get('season');
    const episodeParam = searchParams.get('episode');

    useContentProtection(true);

    // 1. Load Content
    // 1. Load Content & Intro Timer
    useEffect(() => {
        const fetchContent = async () => {
            try {
                const contents = await getAllContents();
                const found = contents.find((c) => c.id === id);
                if (found) {
                    setContent(found);

                    // Fetch Suggestions (Random 3, excluding current)
                    const otherContents = contents.filter(c => c.id !== found.id);
                    const randomSuggestions = otherContents.sort(() => 0.5 - Math.random()).slice(0, 3);
                    setSuggestions(randomSuggestions);

                } else {
                    toast.error("Conteúdo não encontrado");
                    navigate("/");
                }
            } catch (error) {
                console.error("Erro ao carregar conteúdo:", error);
                toast.error("Erro ao carregar conteúdo");
            } finally {
                setLoading(false);
            }
        };
        fetchContent();

        // Intro Animation Timer
        const introTimer = setTimeout(() => {
            setShowIntro(false);
        }, 2500);

        // Suggestions Card Timer (5s after intro/load)
        const suggestionsTimer = setTimeout(() => {
            setShowSuggestionsCard(true);
        }, 7500);

        return () => {
            clearTimeout(introTimer);
            clearTimeout(suggestionsTimer);
        };
    }, [id, navigate]);

    // 2. Determine Video & Access
    useEffect(() => {
        if (!content) return;

        let url = "";
        let title = content.title;
        let nextEp = null;
        let isEpisode = false;

        if (content.category === 'series' && seasonParam && episodeParam) {
            const s = parseInt(seasonParam);
            const e = parseInt(episodeParam);
            const episodeData = content.episodes?.find(ep => ep.season === s && ep.episode === e);

            if (episodeData) {
                url = episodeData.url;
                title = `${content.title} - T${s}E${e}: ${episodeData.title}`;
                isEpisode = true;

                // Calculate next episode
                const sortedEpisodes = [...(content.episodes || [])].sort((a, b) => (a.season - b.season) || (a.episode - b.episode));
                const currentIndex = sortedEpisodes.findIndex(ep => ep.season === s && ep.episode === e);
                if (currentIndex >= 0 && currentIndex < sortedEpisodes.length - 1) {
                    nextEp = sortedEpisodes[currentIndex + 1];
                }
            }
        } else {
            url = content.video_url || "";
        }

        setVideoUrl(url);
        setCurrentTitle(title);
        setNextEpisode(nextEp);

        // Check Access
        const accessMock = {
            isPremium: content.isPremium,
            category: content.category || (isEpisode ? 'series' : 'movie')
        };
        const access = checkAccess(accessMock as any);

        if (access.allowed) {
            setAccessState({ granted: true });

            // Increment usage if not already done for this session/load
            if (profile && !isAdmin && !hasIncrementedRef.current) {
                incrementDailyUsage(profile.id, accessMock.category === 'series' ? 'episode' : 'movie');
                hasIncrementedRef.current = true;
            }
        } else {
            setAccessState({ granted: false, reason: access.reason });
        }

    }, [content, seasonParam, episodeParam, checkAccess, isAdmin, profile]);


    // 3. Sources Logic
    const allSources = useMemo(() => {
        if (!content) return [];

        const sources = [];

        // For series specifically, we might want to handle multiple sources per episode if the data structure supports it.
        // However, usually `video_urls` on the main object are for the movie.
        // If it's an episode, we strictly use the episode URL found above (videoUrl).
        // If we want multiple sources for episodes, the `Episode` type needs to support it. 
        // Assuming simple mapping for now:

        if (content.internal_player_url && !seasonParam) { // Internal player usually for movies
            sources.push({ name: 'Player Interno', url: content.internal_player_url, type: 'internal' });
        }

        const currentUrls = (content.video_urls && content.video_urls.length > 0 && !seasonParam)
            ? content.video_urls
            : [videoUrl]; // Fallback to the single resolved URL

        currentUrls.forEach((u, index) => {
            if (u) sources.push({ name: `Player ${index + 1}`, url: u, type: 'embed' });
        });

        return sources;
    }, [content, videoUrl, seasonParam]);

    const currentSource = allSources[currentSourceIndex] || allSources[0];

    const secureVideoUrl = useMemo(() => {
        if (!currentSource || currentSource.type !== 'embed') return '';
        const url = currentSource.url;
        const separator = url.includes('?') ? '&' : '?';
        // Auto-play and Auto-click simulaton params
        return `${url}${separator}autoplay=1&mute=0&controls=1`;
    }, [currentSource]);

    // 4. Watching Card Effect
    useEffect(() => {
        if (!loading && accessState.granted) {
            const showWatchingCardCycle = () => {
                setShowWatchingCard(true);
                setCardProgress(100);

                const duration = 5000;
                const intervalTime = 50;
                const decrementAmount = (100 / duration) * intervalTime;

                progressIntervalRef.current = setInterval(() => {
                    setCardProgress(prev => {
                        const newProgress = prev - decrementAmount;
                        if (newProgress <= 0) {
                            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                            return 0;
                        }
                        return newProgress;
                    });
                }, intervalTime);

                watchingCardTimerRef.current = setTimeout(() => {
                    setShowWatchingCard(false);
                    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                    watchingCardTimerRef.current = setTimeout(showWatchingCardCycle, 1800000);
                }, duration);
            };

            const initialTimer = setTimeout(showWatchingCardCycle, 2000);

            return () => {
                clearTimeout(initialTimer);
                if (watchingCardTimerRef.current) clearTimeout(watchingCardTimerRef.current);
                if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            }
        }
    }, [loading, accessState.granted]);

    // Fullscreen
    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await playerContainerRef.current?.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    };

    const handleNextEpisode = () => {
        if (nextEpisode) {
            setSearchParams({ season: nextEpisode.season, episode: nextEpisode.episode });
            // Reset states for new episode
            setShowSuggestionsCard(false);
            setTimeout(() => setShowSuggestionsCard(true), 7500);
        }
    };

    // Auto-click simulation (programmatic focus)
    useEffect(() => {
        if (!loading && !showIntro && iframeRef.current) {
            iframeRef.current.focus();
            // We can't click inside an iframe, but we can ensure it's active
        }
    }, [loading, showIntro]);

    if (loading || showIntro) {
        return (
            <div className="w-screen h-screen bg-[#0a0a0a] flex flex-col items-center justify-center z-[100] fixed inset-0">
                <div className="flex flex-col items-center animate-pulse">
                    <div className="bg-primary p-4 rounded-2xl shadow-[0_0_30px_rgba(220,38,38,0.5)] mb-6 transform scale-110">
                        <Film className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2 tracking-tight">
                        Uni<span className="text-primary">Tv</span>Film
                    </h1>
                    <p className="text-gray-400 text-sm tracking-widest uppercase">Carregando Player</p>
                </div>
                <div className="mt-12 w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!accessState.granted) {
        return (
            <div className="w-screen h-screen bg-black flex items-center justify-center">
                <div className="text-center max-w-md px-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/20 border-2 border-primary mb-6">
                        <Crown className="w-12 h-12 text-primary" />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Acesso Bloqueado
                    </h2>
                    <p className="text-gray-400 mb-8 text-lg">
                        {accessState.reason === 'premium_content' ? 'Conteúdo exclusivo para Premium.' : 'Você atingiu seu limite ou não tem permissão.'} <br />
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button size="lg" className="w-full" onClick={() => navigate('/profiles')}>Voltar</Button>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentSource) return <div className="w-screen h-screen bg-black text-white flex items-center justify-center">Vídeo indisponível</div>;

    return (
        <div className="w-screen h-screen bg-black overflow-hidden relative">
            <AdManager placement="player" className="absolute top-20 left-1/2 -translate-x-1/2 z-40" />

            {/* Controls Container */}
            <div ref={playerContainerRef} className="relative w-full h-full group">

                {/* Header Controls (Close, Title, etc) */}
                <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-50 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100">
                    <div className="pointer-events-auto flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="w-12 h-12 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </Button>

                        <div className="px-4 py-2 bg-black/50 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-3">
                            {/* Logo */}
                            <div className="flex items-center gap-2 border-r border-white/20 pr-3 mr-1">
                                <div className="bg-primary p-1 rounded">
                                    <Film className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-white font-bold text-sm hidden sm:inline">Uni<span className="text-primary">Tv</span>Film</span>
                            </div>

                            {/* Circular Poster */}
                            {content?.thumbnail_url && (
                                <img
                                    src={content.thumbnail_url}
                                    className="w-8 h-8 rounded-full object-cover border border-white/20 shadow-sm"
                                    alt="Poster"
                                />
                            )}

                            {/* Title */}
                            <span className="text-white font-bold text-sm sm:text-base">{currentTitle}</span>
                        </div>
                    </div>

                    <div className="pointer-events-auto flex items-center gap-4">
                        {allSources.length > 1 && (
                            <div className="relative">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setShowSourceMenu(!showSourceMenu)}
                                    className="w-12 h-12 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20"
                                >
                                    <List className="w-6 h-6" />
                                </Button>
                                {showSourceMenu && (
                                    <div className="absolute top-14 right-0 bg-black/90 backdrop-blur-md rounded-lg shadow-xl border border-white/20 overflow-hidden min-w-[150px]">
                                        {allSources.map((source, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    setCurrentSourceIndex(index);
                                                    setShowSourceMenu(false);
                                                }}
                                                className={`w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center justify-between ${currentSourceIndex === index ? 'bg-primary/20' : ''}`}
                                            >
                                                <span>{source.name}</span>
                                                {currentSourceIndex === index && <span className="text-primary">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleFullscreen}
                            className="w-12 h-12 rounded-full bg-black/50 text-white hover:bg-white/20 backdrop-blur-md border border-white/20"
                        >
                            {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                        </Button>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/')}
                            className="w-12 h-12 rounded-full bg-black/50 text-white hover:bg-red-600 backdrop-blur-md border border-white/20"
                        >
                            <X className="w-6 h-6" />
                        </Button>
                    </div>
                </div>

                {/* NEXT EPISODE BUTTON - CENTER RIGHT */}
                {nextEpisode && (
                    <div className={`absolute top-1/2 right-4 -translate-y-1/2 z-50 transition-opacity duration-300 ${isFullscreen ? 'opacity-0 group-hover:opacity-100' : ''}`}>
                        <Button
                            onClick={handleNextEpisode}
                            variant="ghost"
                            size="icon"
                            className="w-16 h-16 rounded-full bg-black/60 hover:bg-primary text-white backdrop-blur-md border border-white/20 shadow-2xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
                            title={`Próximo: ${nextEpisode.title}`}
                        >
                            <ChevronRight className="w-10 h-10 ml-1" />
                        </Button>
                        <div className="mt-2 text-center bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-xs text-white uppercase font-bold tracking-wider">Próximo Episódio</span>
                        </div>
                    </div>
                )}

                {/* WATCHING CARD */}
                <div className={`absolute bottom-24 left-6 z-50 max-w-sm bg-black/80 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 overflow-hidden transition-all duration-500 ease-out ${showWatchingCard ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}>
                    <div className="p-4">
                        <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">Você está assistindo</p>
                        <div className="flex gap-3">
                            {content.thumbnail_url && <img src={content.thumbnail_url} className="w-20 h-28 object-cover rounded-lg flex-shrink-0" alt="Capa" />}
                            <div className="flex flex-col gap-1 min-w-0">
                                <h3 className="text-white font-bold text-sm line-clamp-1">{currentTitle}</h3>
                                {/* Description Added */}
                                <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed opacity-90">{content.description}</p>
                                {content.rating && (
                                    <div className="flex items-center gap-1 mt-1">
                                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                                        <span className="text-yellow-500 text-xs font-medium">{content.rating.toFixed(1)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                        <div className="h-full bg-primary transition-all duration-75 ease-linear" style={{ width: `${cardProgress}%` }} />
                    </div>
                </div>

                {/* SUGGESTIONS SIDEBAR (Left Center) */}
                {showSuggestionsCard && suggestions.length > 0 && (
                    <div className="absolute top-1/2 -translate-y-1/2 left-4 z-50 flex items-center">
                        {/* Trigger (Collapsed) */}
                        <div
                            onClick={() => setIsSuggestionsOpen(!isSuggestionsOpen)}
                            className={`relative z-20 flex flex-row items-center gap-2 bg-black/60 backdrop-blur-md px-2 py-3 rounded-full border border-white/20 cursor-pointer shadow-xl transition-all duration-300 hover:bg-primary/90 hover:scale-110 ${isSuggestionsOpen ? 'bg-primary border-primary' : ''}`}
                        >
                            <span className="writing-vertical-rl text-[10px] font-bold text-white uppercase tracking-widest opacity-90 transition-opacity">
                                {isSuggestionsOpen ? 'Fechar' : 'Sugestões'}
                            </span>
                            <div className="flex flex-col gap-0.5">
                                <div className="w-0.5 h-0.5 rounded-full bg-white animate-pulse" />
                                <div className="w-0.5 h-0.5 rounded-full bg-white animate-pulse delay-75" />
                                <div className="w-0.5 h-0.5 rounded-full bg-white animate-pulse delay-150" />
                            </div>
                        </div>

                        {/* Suggestions Panel (Expands to Right) */}
                        <div className={`absolute left-full ml-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 transition-all duration-500 ease-out bg-black/80 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-2xl min-w-[180px] ${isSuggestionsOpen ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 -translate-x-10 pointer-events-none'}`}>
                            <p className="text-white text-xs font-bold uppercase tracking-wider mb-2 border-b border-white/10 pb-2">Recomendados</p>
                            {suggestions.map((suggestion) => (
                                <div
                                    key={suggestion.id}
                                    onClick={() => navigate(`/watch/${suggestion.id}`)}
                                    className="relative flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group/item"
                                >
                                    <img
                                        src={suggestion.thumbnail_url}
                                        alt={suggestion.title}
                                        className="w-12 h-16 object-cover rounded-md shadow-md group-hover/item:scale-105 transition-transform"
                                    />
                                    <div className="flex flex-col min-w-0">
                                        <h4 className="text-white text-xs font-bold line-clamp-2 leading-tight group-hover/item:text-primary transition-colors">{suggestion.title}</h4>
                                        {suggestion.rating && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
                                                <span className="text-yellow-500 text-[10px] font-medium">{suggestion.rating.toFixed(1)}</span>
                                            </div>
                                        )}
                                    </div>
                                    <Play className="w-4 h-4 text-primary opacity-0 group-hover/item:opacity-100 absolute right-2 transition-opacity" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* VIDEO PLAYER */}
                {currentSource.type === 'internal' ? (
                    <div className="absolute inset-0 w-full h-full bg-black">
                        <ReactPlayer
                            key={currentSource.url}
                            url={currentSource.url}
                            width="100%"
                            height="100%"
                            controls
                            playing
                        />
                    </div>
                ) : (
                    <iframe
                        key={secureVideoUrl}
                        ref={iframeRef}
                        src={secureVideoUrl}
                        title={`Player - ${currentTitle}`}
                        className="absolute inset-0 w-full h-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        tabIndex={0}
                        sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                    />
                )}
            </div>
        </div>
    );
};

export default Player;
