import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAllContents, saveUserProgress, getUserProgress } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content } from "@/types/content";
import { Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, ChevronRight, Settings, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

// Declare YouTube IFrame API types
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

export default function NostalgiaTube(): JSX.Element {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, currentProfile } = useAuth();
    const [contents, setContents] = useState<Content[]>([]);
    const [currentContent, setCurrentContent] = useState<Content | null>(null);
    const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    // YouTube Player State
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const episodesScrollRef = useRef<HTMLDivElement>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const centerPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [player, setPlayer] = useState<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [apiReady, setApiReady] = useState(false);
    const [playerReady, setPlayerReady] = useState(false);
    const [showControls, setShowControls] = useState(false);
    const [showCenterPlay, setShowCenterPlay] = useState(false);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isLoadingVideo, setIsLoadingVideo] = useState(true);
    const [videoEnded, setVideoEnded] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);
    const [availableQualities, setAvailableQualities] = useState<string[]>([]);
    const [currentQuality, setCurrentQuality] = useState<string>('default');
    const [countdown, setCountdown] = useState(10);
    const [showCountdown, setShowCountdown] = useState(false);
    const [userInteracted, setUserInteracted] = useState(false);

    // Load YouTube IFrame API
    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                setApiReady(true);
            };
        } else {
            setApiReady(true);
        }
    }, []);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const all = await getAllContents();
                const nostalgiaItems = all.filter(c => c.category === 'nostalgia');
                setContents(nostalgiaItems);

                if (id) {
                    const found = nostalgiaItems.find(c => c.id === id);
                    if (found) {
                        setCurrentContent(found);
                        setCurrentEpisodeIndex(0);
                        setUserInteracted(true);
                    }
                }
            } catch (error) {
                console.error("Error fetching nostalgia content:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [id, navigate]);

    // Check scroll position for arrows
    const checkScroll = () => {
        if (episodesScrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = episodesScrollRef.current;
            setCanScrollLeft(scrollLeft > 0);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    useEffect(() => {
        checkScroll();
        const scrollEl = episodesScrollRef.current;
        if (scrollEl) {
            scrollEl.addEventListener('scroll', checkScroll);
            return () => scrollEl.removeEventListener('scroll', checkScroll);
        }
    }, [currentContent]);

    const scrollEpisodes = (direction: 'left' | 'right') => {
        if (episodesScrollRef.current) {
            const scrollAmount = 300;
            episodesScrollRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    // Helper to extract YouTube ID
    const getYoutubeId = (url?: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const currentEpisode = currentContent?.episodes?.[currentEpisodeIndex];
    const videoUrl = currentEpisode?.url || currentContent?.video_url;
    const youtubeId = getYoutubeId(videoUrl);

    // Get poster image
    const getPosterImage = () => {
        return currentContent?.thumbnail_url || '';
    };

    // Save progress periodically
    const startProgressTracking = () => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }

        progressIntervalRef.current = setInterval(() => {
            if (player && playerReady && currentProfile && currentContent) {
                try {
                    const time = player.getCurrentTime();
                    const dur = player.getDuration();

                    if (time && dur && time > 5) {
                        saveUserProgress({
                            profileId: currentProfile.id,
                            contentId: currentContent.id,
                            season: currentEpisode?.season,
                            episode: currentEpisode?.episode,
                            currentTime: time,
                            duration: dur,
                            completed: time / dur > 0.9
                        });
                    }
                } catch (e) {
                    console.error("Error saving progress:", e);
                }
            }
        }, 10000);
    };

    // Load saved progress
    const loadSavedProgress = async () => {
        if (currentProfile && currentContent && player && playerReady) {
            try {
                const progress = await getUserProgress(
                    currentProfile.id,
                    currentContent.id,
                    currentEpisode?.season,
                    currentEpisode?.episode
                );

                if (progress && progress.currentTime && !progress.completed) {
                    const randomChoice = Math.random();
                    if (randomChoice < 0.5) {
                        player.seekTo(progress.currentTime, true);
                    } else if (randomChoice < 0.75) {
                        player.seekTo(0, true);
                    } else {
                        const randomTime = Math.random() * progress.duration;
                        player.seekTo(randomTime, true);
                    }
                } else {
                    if (Math.random() > 0.5 && duration > 0) {
                        const randomTime = Math.random() * duration;
                        player.seekTo(randomTime, true);
                    }
                }
            } catch (e) {
                console.error("Error loading progress:", e);
            }
        }
    };

    // Play next episode
    const playNextEpisode = () => {
        if (currentContent?.episodes && currentEpisodeIndex < currentContent.episodes.length - 1) {
            setCurrentEpisodeIndex(prev => prev + 1);
            setVideoEnded(false);
        } else {
            setVideoEnded(true);
        }
    };

    // Initialize or update YouTube Player
    useEffect(() => {
        if (!apiReady || !youtubeId) return;

        setIsLoadingVideo(true);
        setVideoEnded(false);

        if (player) {
            try {
                if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                }
                player.destroy();
            } catch (e) {
                console.error("Error destroying player:", e);
            }
            setPlayer(null);
            setPlayerReady(false);
        }

        const newPlayer = new window.YT.Player('youtube-player', {
            videoId: youtubeId,
            playerVars: {
                autoplay: 1,
                controls: 0,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                iv_load_policy: 3,
                fs: 0,
                enablejsapi: 1,
                disablekb: 0,
                cc_load_policy: 0,
                playsinline: 1
            },
            events: {
                onReady: (event: any) => {
                    setPlayerReady(true);
                    setPlayer(event.target);
                    setDuration(event.target.getDuration());

                    // Get available quality levels
                    try {
                        const qualities = event.target.getAvailableQualityLevels();
                        if (qualities && qualities.length > 0) {
                            setAvailableQualities(['auto', ...qualities]);
                        } else {
                            setAvailableQualities(['auto', 'hd1080', 'hd720', 'large', 'medium', 'small']);
                        }
                        const currentQ = event.target.getPlaybackQuality();
                        setCurrentQuality(currentQ || 'default');
                    } catch (e) {
                        console.error("Error getting quality levels:", e);
                        setAvailableQualities(['auto', 'hd1080', 'hd720', 'large', 'medium', 'small']);
                    }

                    setTimeout(() => loadSavedProgress(), 500);
                },
                onStateChange: (event: any) => {
                    const playing = event.data === window.YT.PlayerState.PLAYING;
                    const ended = event.data === window.YT.PlayerState.ENDED;

                    setIsPlaying(playing);

                    if (playing) {
                        setIsLoadingVideo(false);
                        startProgressTracking();
                    } else if (progressIntervalRef.current) {
                        clearInterval(progressIntervalRef.current);
                    }

                    if (ended) {
                        playNextEpisode();
                    }
                }
            }
        });

        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            if (newPlayer) {
                try {
                    newPlayer.destroy();
                } catch (e) {
                    console.error("Error in cleanup:", e);
                }
            }
        };
    }, [apiReady, youtubeId]);

    useEffect(() => {
        if (!player || !playerReady || !isPlaying) return;

        const interval = setInterval(() => {
            try {
                const time = player.getCurrentTime();
                setCurrentTime(time);
            } catch (e) {
                console.error("Error getting current time:", e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [player, playerReady, isPlaying]);

    const togglePlay = () => {
        if (player && playerReady) {
            try {
                if (isPlaying) {
                    player.pauseVideo();
                } else {
                    player.playVideo();
                }

                setShowCenterPlay(true);
                if (centerPlayTimeoutRef.current) {
                    clearTimeout(centerPlayTimeoutRef.current);
                }
                centerPlayTimeoutRef.current = setTimeout(() => {
                    setShowCenterPlay(false);
                }, 800);
            } catch (e) {
                console.error("Error toggling play:", e);
            }
        }
    };

    const toggleMute = () => {
        if (player && playerReady) {
            try {
                if (isMuted) {
                    player.unMute();
                    setIsMuted(false);
                } else {
                    player.mute();
                    setIsMuted(true);
                }
            } catch (e) {
                console.error("Error toggling mute:", e);
            }
        }
    };

    const toggleFullscreen = async () => {
        const container = playerContainerRef.current;
        if (!container) return;

        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock();
                }
            } else {
                // Try different fullscreen methods for cross-browser compatibility
                if (container.requestFullscreen) {
                    await container.requestFullscreen();
                    // Attempt to lock orientation on mobile
                    if (screen.orientation && (screen.orientation as any).lock) {
                        try {
                            await (screen.orientation as any).lock('landscape');
                        } catch (e) {
                            console.log("Orientation lock failed or not supported:", e);
                        }
                    }
                } else if ((container as any).webkitRequestFullscreen) {
                    (container as any).webkitRequestFullscreen();
                } else if ((container as any).mozRequestFullScreen) {
                    (container as any).mozRequestFullScreen();
                } else if ((container as any).msRequestFullscreen) {
                    (container as any).msRequestFullscreen();
                }
            }
        } catch (err) {
            console.error("Error toggling fullscreen:", err);
        }
    };

    const refreshPlayer = () => {
        if (player && playerReady && youtubeId) {
            try {
                const currentT = player.getCurrentTime();
                player.loadVideoById(youtubeId);
                setTimeout(() => {
                    if (currentT > 0) {
                        player.seekTo(currentT, true);
                    }
                    player.playVideo();
                }, 500);
            } catch (e) {
                console.error("Error refreshing player:", e);
            }
        }
    };

    const changeQuality = (quality: string) => {
        if (player && playerReady) {
            try {
                player.setPlaybackQuality(quality);
                setCurrentQuality(quality);
                setShowQualityMenu(false);

                // Force quality update feedback if possible
                const actualQuality = player.getPlaybackQuality();
                if (actualQuality !== quality && quality !== 'default') {
                    console.log(`Requested ${quality}, got ${actualQuality}`);
                }

                toast.success(`Qualidade alterada para ${qualityLabels[quality] || quality}`);
            } catch (e) {
                console.error("Error changing quality:", e);
            }
        }
    };

    const handlePostClick = (content: Content) => {
        setUserInteracted(true);
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
        setCurrentContent(content);
        setCurrentEpisodeIndex(0);
        navigate(`/nostalgia/${content.id}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleEpisodeClick = (index: number) => {
        setUserInteracted(true);
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
        setCurrentEpisodeIndex(index);
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!player || !playerReady || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const seekTime = pos * duration;

        try {
            player.seekTo(seekTime, true);
            setCurrentTime(seekTime);
        } catch (e) {
            console.error("Error seeking:", e);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#141414] text-white">
                <Header />
                <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
                </div>
            </div>
        )
    }

    const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

    const qualityLabels: Record<string, string> = {
        'auto': 'Auto',
        'highres': '4K',
        'hd1080': '1080p',
        'hd720': '720p',
        'large': '480p',
        'medium': '360p',
        'small': '240p',
        'tiny': '144p',
        'default': 'Auto'
    };

    return (
        <div className="min-h-screen bg-[#141414] text-white font-sans">
            <Header />

            <main className="pt-16 pb-10">
                <div
                    className="w-full bg-black mb-6 group relative"
                    ref={playerContainerRef}
                    onMouseEnter={() => setShowControls(true)}
                    onMouseLeave={() => setShowControls(false)}
                >
                    <div className="relative w-full pb-[65%] md:pb-[42%] [&:fullscreen]:pb-0 [&:fullscreen]:h-screen [&:fullscreen]:w-screen">
                        {youtubeId ? (
                            <>
                                {/* Scaled YouTube Player - 130% */}
                                <div className="absolute inset-0 w-full h-full overflow-hidden">
                                    <div
                                        id="youtube-player"
                                        className="absolute"
                                        style={{
                                            width: '130%',
                                            height: '130%',
                                            left: '-15%',
                                            top: '-15%'
                                        }}
                                    ></div>
                                </div>

                                {/* Loading/Ended Overlay with Poster Image */}
                                <div className={`absolute inset-0 w-full h-full z-30 flex items-center justify-center bg-black transition-opacity duration-700 ${(isLoadingVideo || videoEnded) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                    <div className="absolute inset-0 w-full h-full overflow-hidden">
                                        <img
                                            src={getPosterImage()}
                                            alt="Poster"
                                            className="absolute w-full h-full object-cover grayscale"
                                            style={{ objectPosition: '50% 20%' }}
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-black/60"></div>
                                    <div className="relative z-10">
                                        {isLoadingVideo && (
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary"></div>
                                                <p className="text-white text-lg font-medium">Carregando...</p>
                                            </div>
                                        )}
                                        {videoEnded && (
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="text-center">
                                                    <p className="text-white text-2xl font-bold mb-2">Episódio Finalizado</p>
                                                    <p className="text-gray-300">Não há mais episódios disponíveis</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Center Play/Pause Button */}
                                <div
                                    className={`absolute inset-0 flex items-center justify-center z-[16] pointer-events-none transition-opacity duration-500 ${showCenterPlay ? 'opacity-100' : 'opacity-0'}`}
                                >
                                    <div className="bg-black/70 rounded-full p-6">
                                        {isPlaying ? (
                                            <Pause className="w-16 h-16 text-white fill-current" />
                                        ) : (
                                            <Play className="w-16 h-16 text-white fill-current" />
                                        )}
                                    </div>
                                </div>

                                {/* Click blocker overlay */}
                                <div className="absolute inset-0 w-full h-full z-[15] pointer-events-auto"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        togglePlay();
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleFullscreen();
                                    }}
                                ></div>

                                {/* Custom Controls Overlay */}
                                <div className={`absolute bottom-0 left-0 right-0 p-2 md:p-4 bg-gradient-to-t from-black via-black/90 to-transparent transition-opacity duration-300 z-20 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                                    <div className="flex items-center gap-2 md:gap-3 w-full pointer-events-auto">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9"
                                            onClick={togglePlay}
                                        >
                                            {isPlaying ? (
                                                <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                                            ) : (
                                                <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                                            )}
                                        </Button>

                                        {/* Live Indicator */}
                                        <div className="hidden sm:flex items-center gap-1.5 ml-1 md:ml-2">
                                            <div className="relative">
                                                <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                                                <div className="absolute inset-0 w-2 h-2 bg-red-600 rounded-full animate-ping"></div>
                                            </div>
                                            <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">Live</span>
                                        </div>

                                        <div className="flex-1" onClick={handleSeek}>
                                            <div className="h-1 bg-white/30 rounded-full overflow-hidden cursor-pointer">
                                                <div
                                                    className="h-full bg-primary transition-all duration-100"
                                                    style={{ width: `${progressPercentage}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {/* Quality Selector */}
                                        <div className="relative">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9"
                                                onClick={() => setShowQualityMenu(!showQualityMenu)}
                                            >
                                                <Settings className="w-4 h-4 md:w-5 md:h-5" />
                                            </Button>
                                            {showQualityMenu && (
                                                <div className="absolute bottom-full right-0 mb-2 bg-black/95 border border-white/10 rounded-lg overflow-hidden min-w-[100px] md:min-w-[120px] max-h-[300px] overflow-y-auto">
                                                    <div className="p-2 border-b border-white/10 text-xs text-gray-400">Qualidade</div>
                                                    {availableQualities.map((quality) => (
                                                        <button
                                                            key={quality}
                                                            onClick={() => changeQuality(quality)}
                                                            className={`w-full text-left px-3 py-2 text-xs md:text-sm hover:bg-white/10 transition-colors ${currentQuality === quality ? 'text-primary bg-white/5' : 'text-white'}`}
                                                        >
                                                            {qualityLabels[quality] || quality}
                                                            {currentQuality === quality && <span className="ml-2">✓</span>}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Refresh Button */}
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9"
                                            onClick={refreshPlayer}
                                        >
                                            <RotateCw className="w-4 h-4 md:w-5 md:h-5" />
                                        </Button>

                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9"
                                            onClick={toggleMute}
                                        >
                                            {isMuted ? (
                                                <VolumeX className="w-4 h-4 md:w-5 md:h-5" />
                                            ) : (
                                                <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-white hover:bg-white/20 h-8 w-8 md:h-9 md:w-9"
                                            onClick={toggleFullscreen}
                                        >
                                            <Maximize className="w-4 h-4 md:w-5 md:h-5" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 border border-white/5">
                                <div className="text-center p-6">
                                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                                        <Play className="w-8 h-8 text-white/50" />
                                    </div>
                                    <p className="text-white font-medium text-lg mb-2">NostalgiaTube</p>
                                    <p className="text-gray-500 text-sm max-w-xs mx-auto">Escolha uma série nostálgica na lista abaixo para começar a assistir</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="container mx-auto px-4">
                    {/* Info Section */}
                    {currentContent && (
                        <div className="mb-8 p-4 md:p-6 bg-[#1a1a1a] rounded-xl border border-white/5">
                            <h2 className="text-xl md:text-3xl font-bold mb-2 text-primary">{currentContent.title}</h2>
                            {currentEpisode && (
                                <h3 className="text-lg md:text-xl text-gray-300 mb-4">{currentEpisode.title}</h3>
                            )}

                            <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-gray-400 mb-4">
                                {currentContent.year && <span>{currentContent.year}</span>}
                                {currentContent.duration && <span>{currentContent.duration}</span>}
                                {currentContent.genre && currentContent.genre.map((g, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-white/10 rounded-full text-xs">{g}</span>
                                ))}
                            </div>

                            <p className="text-sm md:text-base text-gray-300 leading-relaxed mb-6">
                                {currentContent.description}
                            </p>

                            {currentContent.episodes && currentContent.episodes.length > 1 && (
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-white mb-2">Episódios</h3>
                                    <div className="relative">
                                        {canScrollLeft && (
                                            <button
                                                onClick={() => scrollEpisodes('left')}
                                                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black/90 text-white p-1.5 md:p-2 rounded-full transition-all"
                                            >
                                                <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
                                            </button>
                                        )}

                                        <div
                                            ref={episodesScrollRef}
                                            className="flex overflow-x-auto gap-3 md:gap-4 pb-4 scrollbar-none"
                                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                        >
                                            {currentContent.episodes.map((ep, idx) => {
                                                const epVideoId = getYoutubeId(ep.url);
                                                const epThumb = epVideoId
                                                    ? `https://img.youtube.com/vi/${epVideoId}/mqdefault.jpg`
                                                    : currentContent.thumbnail_url;

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => handleEpisodeClick(idx)}
                                                        className={`flex-none w-48 md:w-60 group relative rounded-lg overflow-hidden border transition-all ${currentEpisodeIndex === idx
                                                            ? 'border-primary ring-1 ring-primary'
                                                            : 'border-white/10 hover:border-white/30'
                                                            }`}
                                                    >
                                                        <div className="aspect-video w-full relative bg-zinc-900">
                                                            <img
                                                                src={epThumb}
                                                                alt={ep.title}
                                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                            />
                                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Play className="w-6 h-6 md:w-8 md:h-8 text-white fill-current drop-shadow-lg" />
                                                            </div>
                                                            <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">
                                                                Ep {idx + 1}
                                                            </div>
                                                        </div>
                                                        <div className={`p-2 text-left w-full truncate text-xs md:text-sm font-medium ${currentEpisodeIndex === idx ? 'bg-primary/10 text-primary' : 'bg-[#222] text-gray-300'}`}>
                                                            {ep.title || `Episódio ${idx + 1}`}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {canScrollRight && (
                                            <button
                                                onClick={() => scrollEpisodes('right')}
                                                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/80 hover:bg-black/90 text-white p-1.5 md:p-2 rounded-full transition-all"
                                            >
                                                <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* "Nostalgia" Section - Posts */}
                    <div className="mt-12">
                        <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 flex items-center gap-2">
                            <span className="text-primary">NOSTALGIA</span>
                        </h2>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-6">
                            {contents.map((item) => (
                                <div
                                    key={item.id}
                                    className="group relative cursor-pointer"
                                    onClick={() => handlePostClick(item)}
                                >
                                    <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/20">
                                        <img
                                            src={item.thumbnail_url}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Play className="w-10 h-10 md:w-12 md:h-12 text-white fill-current drop-shadow-lg scale-0 group-hover:scale-100 transition-transform duration-300 delay-75" />
                                        </div>
                                    </div>
                                    <h3 className="mt-2 md:mt-3 text-xs md:text-sm font-medium leading-tight text-white group-hover:text-primary transition-colors line-clamp-2">
                                        {item.title}
                                    </h3>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
