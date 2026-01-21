// NostalgiaTube page - cache bust 2026-01-10
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAllContents, saveUserProgress, getUserProgress } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content } from "@/types/content";
import { Play, Pause, Volume2, VolumeX, Maximize, ChevronLeft, ChevronRight, ChevronDown, Settings, RotateCw, ThumbsUp, ThumbsDown, Download, Check, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { DownloadModal } from "@/components/DownloadModal";
import { voteContent, getUserVote } from "@/lib/firebase";

const formatTime = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

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
    const { user, currentProfile, checkAccess } = useAuth(); // Added checkAccess
    const [contents, setContents] = useState<Content[]>([]);
    const [currentContent, setCurrentContent] = useState<Content | null>(null);
    const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    // YouTube Player State
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const customVideoRef = useRef<HTMLVideoElement>(null);
    const episodesScrollRef = useRef<HTMLDivElement>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const centerPlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [player, setPlayer] = useState<any>(null);
    const [hasQuotaError, setHasQuotaError] = useState(false);
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
    const [liked, setLiked] = useState(false);
    const [disliked, setDisliked] = useState(false);
    const [userVote, setUserVote] = useState<'like' | 'dislike' | null>(null);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const [hasStartedPlaying, setHasStartedPlaying] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false); // Track fullscreen state locally
    const [waitingForSelection, setWaitingForSelection] = useState(false); // New state for prompt
    const [lastProgress, setLastProgress] = useState<any>(null); // Last watched episode progress

    // Quality labels mapping - MUST be before any conditional returns
    const qualityLabels: { [key: string]: string } = useMemo(() => ({
        'highres': '4K+',
        'hd2160': '4K',
        'hd1440': '1440p',
        'hd1080': '1080p',
        'hd720': '720p',
        'large': '480p',
        'medium': '360p',
        'small': '240p',
        'tiny': '144p',
        'auto': 'Auto'
    }), []);

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
            if (contents.length > 0 && !id) return; // Already loaded root

            setLoading(true);
            try {
                const all = await getAllContents();
                const nostalgiaItems = all.filter(c => c.category === 'nostalgia');

                // Randomize content only if not already loaded or searching for specific id
                if (contents.length === 0) {
                    const shuffled = [...nostalgiaItems].sort(() => 0.5 - Math.random());
                    setContents(shuffled);
                }

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
    }, [id]); // Remove navigate from deps if not strictly needed for fetch

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

    // Handle Fullscreen Changes from Browser interactions (ESC key, etc)
    useEffect(() => {
        const handleFullscreenCheck = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenCheck);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenCheck);
    }, []);

    // Check Access & Load Vote when content changes
    useEffect(() => {
        if (currentContent && user) {
            const checkContentAccess = () => {
                const access = checkAccess({
                    isPremium: currentContent.isPremium,
                    category: 'nostalgia' // Treat as nostalgia/series
                } as any);

                if (!access.allowed) {
                    toast.error("Conteúdo exclusivo para Premium. Atualize seu plano!");
                    // If blocked, maybe clear content or redirect?
                    // For now, let's just stop it from playing or showing properly?
                    // But the user might be on the page seeing the poster.
                    // We'll enforce it on Play.
                }
            };
            checkContentAccess();

            getUserVote(user.uid, currentContent.id).then(vote => {
                setUserVote(vote);
            });
        }
    }, [currentContent, user, checkAccess]);

    const handleVote = async (e: React.MouseEvent | null, vote: 'like' | 'dislike') => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        if (!user || !currentContent) return;

        const newVote = userVote === vote ? null : vote;
        setUserVote(newVote); // Optimistic UI

        // Update local content counters for display
        const updatedContent = { ...currentContent };
        if (!updatedContent.likes) updatedContent.likes = 0;
        if (!updatedContent.dislikes) updatedContent.dislikes = 0;

        // Undo previous
        if (userVote === 'like') updatedContent.likes--;
        if (userVote === 'dislike') updatedContent.dislikes--;

        // Apply new
        if (newVote === 'like') updatedContent.likes++;
        if (newVote === 'dislike') updatedContent.dislikes++;

        setCurrentContent(updatedContent);

        try {
            await voteContent(user.uid, currentContent.id, newVote);
        } catch (error) {
            console.error("Error voting:", error);
            toast.error("Erro ao salvar voto");
            // Revert state if needed, but usually fine
        }
    };

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
    const googleDriveUrl = currentEpisode?.google_drive_url || currentContent?.google_drive_url;

    // Safety check for Google Drive API URL
    const isGoogleDriveApi = googleDriveUrl?.includes('googleapis.com/drive/v3/files');
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
            if (player && playerReady && currentProfile && currentContent && user) {
                try {
                    const time = player.getCurrentTime();
                    const dur = player.getDuration();

                    if (time && dur && time > 5) {
                        saveUserProgress({
                            userId: user.uid,
                            profileId: currentProfile.id,
                            contentId: currentContent.id,
                            season: currentEpisode?.season,
                            episode: currentEpisode?.episode,
                            lastPositionSeconds: time,
                            durationSeconds: dur
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

                if (progress && progress.lastPositionSeconds && progress.durationSeconds && progress.lastPositionSeconds / progress.durationSeconds < 0.9) {
                    player.seekTo(progress.lastPositionSeconds, true);
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
            setHasQuotaError(false); // Reset error on change
        } else {
            setVideoEnded(true);
        }
    };

    // Custom Video Sync Methods
    const handleVideoPlay = () => setIsPlaying(true);
    const handleVideoPause = () => setIsPlaying(false);
    const handleVideoEnded = () => playNextEpisode();
    const handleVideoTimeUpdate = () => {
        if (customVideoRef.current) {
            setCurrentTime(customVideoRef.current.currentTime);
        }
    };
    const handleVideoMetadata = () => {
        if (customVideoRef.current) {
            setDuration(customVideoRef.current.duration);
            setIsLoadingVideo(false);
            setHasStartedPlaying(true);
        }
    };
    const handleVideoError = (e: any) => {
        console.error("Custom Video Error:", e);
        // Detect 403 or loading failure which often indicates quota
        setHasQuotaError(true);
        setIsLoadingVideo(false);
        toast.error("Erro ao carregar vídeo do Google Drive");
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
                playsinline: 1,
                origin: window.location.origin
            },
            events: {
                onReady: (event: any) => {
                    setPlayerReady(true);
                    setPlayer(event.target);
                    setIsLoadingVideo(false);
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

                    // Force call loadSavedProgress with the new player instance
                    // We need to define loadSavedProgress inside useEffect or pass player to it.
                    // Since loadSavedProgress depends on 'player' state which is async, 
                    // we should use event.target directly here.
                    const restoreProgress = async () => {
                        if (currentProfile && currentContent) { // Ensure context exists
                            try {
                                const progress = await getUserProgress(
                                    currentProfile.id,
                                    currentContent.id,
                                    currentContent.episodes?.[currentEpisodeIndex]?.season,
                                    currentContent.episodes?.[currentEpisodeIndex]?.episode
                                );
                                if (progress && progress.lastPositionSeconds && progress.durationSeconds && progress.lastPositionSeconds / progress.durationSeconds < 0.9) {
                                    event.target.seekTo(progress.lastPositionSeconds, true);
                                    toast.success(`Resumindo de ${formatTime(progress.lastPositionSeconds)}`);
                                }
                            } catch (e) {
                                console.error("Error loading progress:", e);
                            }
                        }
                    };
                    restoreProgress();
                },
                onStateChange: (event: any) => {
                    const playing = event.data === window.YT.PlayerState.PLAYING;
                    const ended = event.data === window.YT.PlayerState.ENDED;
                    const buffering = event.data === window.YT.PlayerState.BUFFERING;

                    setIsPlaying(playing);
                    setIsLoadingVideo(buffering);

                    if (playing) {
                        setIsLoadingVideo(false);
                        setHasStartedPlaying(true); // Poster logic
                        setHasQuotaError(false);
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
        if (isGoogleDriveApi && customVideoRef.current) {
            if (isPlaying) {
                customVideoRef.current.pause();
            } else {
                customVideoRef.current.play();
            }
        } else if (player && playerReady) {
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
        if (isGoogleDriveApi && customVideoRef.current) {
            customVideoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        } else if (player && playerReady) {
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
                setIsFullscreen(false);
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock();
                }
            } else {
                // Try different fullscreen methods for cross-browser compatibility
                if (container.requestFullscreen) {
                    await container.requestFullscreen();
                    // State will be updated by listener
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
        if (isGoogleDriveApi) {
            // Google Drive API URL is a single file, quality change is not supported directly
            toast.info("A qualidade é gerenciada automaticamente pelo Google Drive.");
            setShowQualityMenu(false);
            return;
        }

        if (player && playerReady) {
            try {
                // Note: YouTube's IFrame API deprecated setPlaybackQuality for embeds
                // It may not work reliably. We try but also show a fallback message.
                player.setPlaybackQuality(quality);
                setCurrentQuality(quality);
                setShowQualityMenu(false);

                // Verify the quality change
                setTimeout(() => {
                    const actualQuality = player.getPlaybackQuality();
                    if (actualQuality && actualQuality !== quality && quality !== 'auto') {
                        // Quality change may not have worked - YouTube restricts this in embeds
                        toast.info(`Qualidade solicitada: ${qualityLabels[quality] || quality}. O YouTube pode limitar alterações de qualidade em players embutidos.`);
                    } else {
                        toast.success(`Qualidade: ${qualityLabels[quality] || quality}`);
                    }
                    setCurrentQuality(actualQuality || quality);
                }, 500);
            } catch (e) {
                console.error("Error changing quality:", e);
                toast.error("Erro ao alterar qualidade");
            }
        }
    };

    const handlePostClick = (e: React.MouseEvent, content: Content) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        const access = checkAccess({
            isPremium: content.isPremium,
            category: 'nostalgia'
        } as any);

        if (!access.allowed) {
            toast.error("Conteúdo exclusivo para Premium.");
            return;
        }

        setUserInteracted(true);
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }

        // First reset episode index to -1 BEFORE setting new content
        // This ensures clicking episode 0 will trigger a state change
        setCurrentEpisodeIndex(-1);
        setCurrentContent(content);

        // UX: Stop playing, show prompt
        setHasStartedPlaying(false);
        setIsLoadingVideo(false);
        setVideoEnded(false);
        setWaitingForSelection(true);

        navigate(`/nostalgia/${content.id}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Fetch progress for all episodes to find the last watched one
        if (currentProfile) {
            import("@/lib/firebase").then(({ getUserAllProgress }) => {
                getUserAllProgress(currentProfile.id).then(allProgress => {
                    const contentProgress = allProgress
                        .filter(p => p.contentId === content.id)
                        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                    if (contentProgress.length > 0) {
                        setLastProgress(contentProgress[0]);
                    } else {
                        setLastProgress(null);
                    }
                });
            });
        }
    };

    const handleEpisodeClick = (e: React.MouseEvent, index: number) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        setUserInteracted(true);
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
        }
        setWaitingForSelection(false); // Clear prompt, start loading
        setIsLoadingVideo(true); // Show loading immediately

        // Always set the episode index - since we reset to -1 on post click,
        // clicking episode 0 will now trigger a proper state change
        // For same episode click (re-click), force player to restart
        if (index === currentEpisodeIndex && player && playerReady) {
            try {
                player.seekTo(0, true);
                player.playVideo();
            } catch (e) {
                console.error("Error restarting episode:", e);
            }
        } else {
            setCurrentEpisodeIndex(index);
            setHasStartedPlaying(false); // Reset to trigger new player load
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const seekTime = pos * duration;

        if (isGoogleDriveApi && customVideoRef.current) {
            customVideoRef.current.currentTime = seekTime;
            setCurrentTime(seekTime);
        } else if (player && playerReady) {
            try {
                player.seekTo(seekTime, true);
                setCurrentTime(seekTime);
            } catch (e) {
                console.error("Error seeking:", e);
            }
        }
    };

    // Idle Controls Logic - MUST be before any conditional returns
    useEffect(() => {
        let timeout: NodeJS.Timeout;

        const resetTimer = () => {
            setShowControls(true);
            if (timeout) clearTimeout(timeout);
            if (isPlaying) {
                timeout = setTimeout(() => setShowControls(false), 3000);
            }
        };

        const onMouseMove = () => resetTimer();
        const onTouchStart = () => resetTimer();

        // Initial set
        resetTimer();

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchstart', onTouchStart);
        window.addEventListener('click', resetTimer);

        return () => {
            if (timeout) clearTimeout(timeout);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('click', resetTimer);
        };
    }, [isPlaying]);

    // Initial Resume Logic when entering content
    useEffect(() => {
        const checkSavedProgress = async () => {
            if (currentProfile && currentContent) {
                const { getUserAllProgress } = await import("@/lib/firebase");
                const allProgress = await getUserAllProgress(currentProfile.id);
                const contentProgress = allProgress
                    .filter(p => p.contentId === currentContent.id)
                    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

                if (contentProgress.length > 0) {
                    setLastProgress(contentProgress[0]);
                }
            }
        };
        checkSavedProgress();
    }, [currentContent, currentProfile]);

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

    return (
        <div className="min-h-screen bg-[#141414] text-white font-sans">
            <Header />

            <main className="pt-16 pb-10">
                <div
                    className="w-full bg-black mb-6 group relative"
                    ref={playerContainerRef}
                >
                    <div
                        key={`${currentContent?.id || 'none'}-${currentEpisodeIndex}`}
                        className={`relative w-full flex items-center justify-center ${isFullscreen ? 'h-full bg-black' : 'pb-[56.25%] md:pb-[42%] lg:pb-[40%]'}`}
                    >
                        {/* 1. Video Engines */}
                        {isGoogleDriveApi && !hasQuotaError && (
                            <div className="absolute inset-0 w-full h-full z-10 bg-black flex items-center justify-center">
                                <video
                                    ref={customVideoRef}
                                    src={googleDriveUrl}
                                    className="w-full h-full object-contain"
                                    onPlay={handleVideoPlay}
                                    onPause={handleVideoPause}
                                    onEnded={handleVideoEnded}
                                    onTimeUpdate={handleVideoTimeUpdate}
                                    onLoadedMetadata={handleVideoMetadata}
                                    onError={handleVideoError}
                                    autoPlay
                                    playsInline
                                />
                                {/* Overlay for a premium look */}
                                <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-20"></div>
                            </div>
                        )}

                        {youtubeId && !isGoogleDriveApi && (
                            <div className={`absolute inset-0 w-full h-full overflow-hidden pointer-events-none ${isFullscreen ? 'z-0' : ''}`}>
                                <div
                                    id="youtube-player"
                                    className="absolute w-full h-full"
                                    style={{
                                        transform: isFullscreen ? 'none' : 'scale(1.35)', // Remove scale in fullscreen to fit correctly
                                        transformOrigin: 'center'
                                    }}
                                ></div>
                            </div>
                        )}

                        {/* 2. Common UI Layer (Poster, Interaction, Controls) */}
                        {((youtubeId && !isGoogleDriveApi) || (isGoogleDriveApi && !hasQuotaError)) && (
                            <>
                                {/* Poster / Loading / Ended Overlay */}
                                <div className={`absolute inset-0 w-full h-full z-30 flex items-center justify-center bg-black transition-opacity duration-500 ${(!hasStartedPlaying || isLoadingVideo || videoEnded || waitingForSelection) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                    <div className="absolute inset-0 w-full h-full overflow-hidden">
                                        <img
                                            src={getPosterImage()}
                                            alt="Poster"
                                            className="absolute w-full h-full object-cover grayscale opacity-60"
                                        />
                                    </div>
                                    <div className="absolute inset-0 bg-black/60"></div>
                                    <div className="relative z-10 flex flex-col items-center p-4 text-center">

                                        {/* Prompt State */}
                                        {waitingForSelection && (
                                            <div className="animate-in fade-in zoom-in duration-300">
                                                <p className="text-xl md:text-3xl font-bold text-white mb-2">Quase lá!</p>
                                                <p className="text-gray-300 text-sm md:text-lg mb-6">Clica em um episódio para começares assistindo</p>

                                                {lastProgress && (
                                                    <Button
                                                        onClick={(e) => {
                                                            const epIndex = currentContent?.episodes?.findIndex(
                                                                e => (e as any).season === lastProgress.season && (e as any).episode === lastProgress.episode
                                                            );
                                                            if (epIndex !== undefined && epIndex !== -1) {
                                                                handleEpisodeClick(e as any, epIndex);
                                                            } else if (!currentContent?.episodes) {
                                                                // Movie case
                                                                handleEpisodeClick(e as any, 0);
                                                            }
                                                        }}
                                                        className="bg-primary hover:bg-primary/90 text-white gap-2 px-6 py-6 text-lg rounded-full shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all animate-bounce"
                                                    >
                                                        <RotateCw className="w-5 h-5" />
                                                        Continuar Assistindo
                                                    </Button>
                                                )}

                                                <div className="mt-8 flex justify-center">
                                                    <ChevronDown className="w-8 h-8 text-white animate-bounce" />
                                                </div>
                                            </div>
                                        )}

                                        {/* Loading Spinner */}
                                        {(isLoadingVideo && !videoEnded && !waitingForSelection) && (
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-primary shadow-[0_0_15px_rgba(16,185,129,0.5)]"></div>
                                                <p className="text-white text-base font-medium tracking-wide">Carregando...</p>
                                            </div>
                                        )}

                                        {videoEnded && (
                                            <div className="text-center animate-in fade-in zoom-in duration-300">
                                                <p className="text-2xl font-bold mb-2 text-white">Episódio Finalizado</p>
                                                <Button
                                                    onClick={() => {
                                                        setCurrentEpisodeIndex(0);
                                                        setVideoEnded(false);
                                                        setWaitingForSelection(false);
                                                    }}
                                                    variant="outline"
                                                    className="border-white/20 hover:bg-white/10"
                                                >
                                                    Reiniciar Série
                                                </Button>
                                            </div>
                                        )}
                                        {!hasStartedPlaying && !isLoadingVideo && !videoEnded && !waitingForSelection && (
                                            <div className="animate-pulse">
                                                <Play className="w-16 h-16 text-white/80" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Center Play/Pause Feedback */}
                                <div
                                    className={`absolute inset-0 flex items-center justify-center z-[35] pointer-events-none transition-all duration-300 ${showCenterPlay ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                                >
                                    <div className="bg-black/60 backdrop-blur-sm rounded-full p-4 md:p-6 shadow-2xl">
                                        {isPlaying ? (
                                            <Pause className="w-8 h-8 md:w-12 md:h-12 text-white fill-current" />
                                        ) : (
                                            <Play className="w-8 h-8 md:w-12 md:h-12 text-white fill-current ml-1" />
                                        )}
                                    </div>
                                </div>

                                {/* Interaction Layer */}
                                <div className="absolute inset-0 w-full h-full z-20 pointer-events-auto"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        togglePlay();
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        toggleFullscreen();
                                    }}
                                ></div>

                                {/* Controls Overlay */}
                                <div className={`absolute bottom-0 left-0 right-0 px-2 md:px-4 pb-2 md:pb-4 pt-12 md:pt-20 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 z-40 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                    <div className="flex flex-col gap-2 w-full max-w-6xl mx-auto pointer-events-auto">
                                        <div
                                            className="group relative h-1.5 w-full bg-white/20 rounded-full cursor-pointer hover:h-2 transition-all"
                                            onClick={handleSeek}
                                        >
                                            <div
                                                className="absolute left-0 top-0 bottom-0 bg-primary rounded-full transition-all duration-100 relative"
                                                style={{ width: `${progressPercentage}%` }}
                                            >
                                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow scale-0 group-hover:scale-100 transition-transform"></div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-1">
                                            <div className="flex items-center gap-1 md:gap-3">
                                                <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10 rounded-full" onClick={togglePlay}>
                                                    {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" /> : <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />}
                                                </Button>

                                                <div className="hidden sm:flex items-center gap-2 px-2 py-1 bg-red-600/10 border border-red-600/20 rounded-md">
                                                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
                                                    <span className="text-[10px] font-bold text-red-500 tracking-wider">LIVE</span>
                                                </div>

                                                <Button size="icon" variant="ghost" className="hidden md:flex text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10 rounded-full" onClick={toggleMute}>
                                                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                                </Button>

                                                <span className="text-xs text-gray-300 font-mono ml-2">
                                                    {formatTime(currentTime)} / {formatTime(duration)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1 md:gap-2">
                                                <div className="relative">
                                                    <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10 rounded-full" onClick={() => setShowQualityMenu(!showQualityMenu)}>
                                                        <Settings className="w-4 h-4 md:w-5 md:h-5" />
                                                    </Button>
                                                    {showQualityMenu && (
                                                        <div className="absolute bottom-full right-0 mb-3 bg-[#111] border border-white/10 rounded-xl overflow-hidden min-w-[140px] shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                                                            <div className="p-3 border-b border-white/5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Qualidade</div>
                                                            <div className="max-h-[250px] overflow-y-auto py-1">
                                                                {availableQualities.map((quality) => (
                                                                    <button key={quality} onClick={() => changeQuality(quality)} className={`w-full text-left px-4 py-2.5 text-xs font-medium hover:bg-white/10 transition-colors flex items-center justify-between ${currentQuality === quality ? 'text-primary bg-primary/10' : 'text-gray-200'}`}>
                                                                        {qualityLabels[quality] || quality}
                                                                        {currentQuality === quality && <Check className="w-3 h-3" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <Button size="icon" variant="ghost" className="text-white hover:bg-white/20 h-8 w-8 md:h-10 md:w-10 rounded-full" onClick={toggleFullscreen}>
                                                    <Maximize className="w-4 h-4 md:w-5 md:h-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* 3. Error States */}
                        {isGoogleDriveApi && hasQuotaError && (
                            <div className="absolute inset-0 w-full h-full z-50 bg-black flex items-center justify-center">
                                <div className="text-center p-6 max-w-md animate-in fade-in zoom-in duration-500 bg-zinc-900/90 backdrop-blur-md rounded-2xl border border-red-500/20 shadow-2xl">
                                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)] border border-red-500/20">
                                        <Settings className="w-10 h-10 text-red-500 animate-spin-slow" />
                                    </div>
                                    <h3 className="text-white font-bold text-xl mb-3 tracking-tight">Limite do Google Drive Excedido</h3>
                                    <p className="text-gray-300 text-sm leading-relaxed mb-6">
                                        O vídeo está com uma <span className="text-red-400 font-semibold">demanda enorme de usuários</span> assistindo e está temporariamente bloqueado para ti.
                                        <br /><br />
                                        Clica em outro episódio e se continuar tenta voltar mais tarde ou amanhã.
                                    </p>
                                    <Button
                                        onClick={() => playNextEpisode()}
                                        className="bg-red-500 hover:bg-red-600 text-white w-full py-6 rounded-xl font-bold gap-2 transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                                    >
                                        <RotateCw className="w-5 h-5" />
                                        Tentar Outro Episódio
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* 4. Initial/Fallback UI */}
                        {!youtubeId && !isGoogleDriveApi && (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur-sm">
                                <div className="text-center p-6 max-w-md animate-in fade-in zoom-in duration-500">
                                    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl border border-primary/20">
                                        <Film className="w-10 h-10 text-primary" />
                                    </div>
                                    <h3 className="text-white font-bold text-xl mb-3 tracking-tight">NostalgiaTube</h3>
                                    <p className="text-gray-300 text-sm leading-relaxed mb-4">
                                        {currentContent ? (
                                            <>Clica em um <span className="text-primary font-semibold">episódio</span> abaixo para começares a assistir.</>
                                        ) : (
                                            <>Selecione um conteúdo da secção <span className="text-primary font-semibold">Nostalgia</span> abaixo para começar.</>
                                        )}
                                    </p>
                                    <div className="flex items-center justify-center gap-2 text-gray-500 text-xs">
                                        <ChevronDown className="w-4 h-4 animate-bounce" />
                                        <span>Role para ver os episódios</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="relative z-50">
                    <div className="container mx-auto px-4">
                        {/* Info Section */}
                        {currentContent && (
                            <div className="mb-8 p-4 md:p-6 bg-[#1a1a1a] rounded-xl border border-white/5 relative z-50 shadow-2xl">
                                <h2 className="text-xl md:text-3xl font-bold mb-2 text-primary">{currentContent.title}</h2>
                                {currentEpisode && (
                                    <h3 className="text-lg md:text-xl text-gray-300 mb-4">{currentEpisode.title}</h3>
                                )}

                                <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm text-gray-400 mb-4 items-center">
                                    {currentContent.year && <span>{currentContent.year}</span>}
                                    {currentContent.duration && <span>{currentContent.duration}</span>}
                                    {currentContent.genre && currentContent.genre.map((g, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-white/10 rounded-full text-xs">{g}</span>
                                    ))}

                                    {/* Interaction Buttons */}
                                    <div className="flex items-center gap-3 ml-auto">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => handleVote(e, 'like')}
                                            className={`flex items-center gap-1.5 hover:bg-white/10 relative z-10 ${userVote === 'like' ? 'text-primary' : 'text-gray-400'}`}
                                        >
                                            <ThumbsUp className={`w-4 h-4 pointer-events-none ${userVote === 'like' ? 'fill-current' : ''}`} />
                                            <span className="pointer-events-none">{currentContent.likes || 0}</span>
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => handleVote(e, 'dislike')}
                                            className={`flex items-center gap-1.5 hover:bg-white/10 relative z-10 ${userVote === 'dislike' ? 'text-red-500' : 'text-gray-400'}`}
                                        >
                                            <ThumbsDown className={`w-4 h-4 pointer-events-none ${userVote === 'dislike' ? 'fill-current' : ''}`} />
                                            <span className="pointer-events-none">{currentContent.dislikes || 0}</span>
                                        </Button>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                                if (e) {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                }
                                                setShowDownloadModal(true);
                                            }}
                                            className="flex items-center gap-2 border-white/20 bg-white/5 hover:bg-white/10 text-gray-200 relative z-10"
                                        >
                                            <Download className="w-4 h-4 pointer-events-none" />
                                            <span className="hidden sm:inline pointer-events-none">Download</span>
                                        </Button>
                                    </div>
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
                                                            key={`${currentContent.id}-ep-${idx}`}
                                                            onClick={(e) => handleEpisodeClick(e, idx)}
                                                            className={`flex-none w-48 md:w-60 group relative rounded-lg overflow-hidden border transition-all active:scale-95 touch-none z-50 ${currentEpisodeIndex === idx
                                                                ? 'border-primary ring-1 ring-primary bg-primary/20'
                                                                : 'border-white/10 hover:border-white/30 bg-[#222]'
                                                                }`}
                                                        >
                                                            <div className="aspect-video w-full relative bg-zinc-900 pointer-events-none">
                                                                <img
                                                                    src={epThumb}
                                                                    alt={ep.title}
                                                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity pointer-events-none"
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                                    <Play className="w-6 h-6 md:w-8 md:h-8 text-white fill-current drop-shadow-lg" />
                                                                </div>
                                                                <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-white pointer-events-none">
                                                                    Ep {idx + 1}
                                                                </div>
                                                            </div>
                                                            <div className={`p-2 text-left w-full truncate text-xs md:text-sm font-medium pointer-events-none ${currentEpisodeIndex === idx ? 'bg-primary/10 text-primary' : 'bg-[#222] text-gray-300'}`}>
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
                    </div>

                    <div className="relative z-10 mt-16 md:mt-24">
                        <div className="container mx-auto px-4">
                            {/* "Nostalgia" Section - Posts */}
                            <h2 className="text-xl md:text-2xl font-bold mb-4 md:mb-6 flex items-center gap-2">
                                <span className="text-primary uppercase tracking-wider">Nostalgia</span>
                            </h2>

                            <div className="flex gap-4 overflow-x-auto pb-4 modern-scrollbar snap-x">
                                {contents.map((content) => (
                                    <div
                                        key={content.id}
                                        className="bg-zinc-900/50 rounded-xl overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-300 border border-white/5 hover:border-primary/50 group/card min-w-[200px] md:min-w-[260px] snap-start relative z-10"
                                        onClick={(e) => handlePostClick(e, content)}
                                    >
                                        <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/20 pointer-events-none">
                                            <img
                                                src={content.thumbnail_url}
                                                alt={content.title}
                                                className="w-full h-full object-cover pointer-events-none"
                                            />
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                                <Play className="w-10 h-10 md:w-12 md:h-12 text-white fill-current drop-shadow-lg scale-0 group-hover:scale-100 transition-transform duration-300 delay-75" />
                                            </div>
                                        </div>
                                        <h3 className="mt-2 md:mt-3 text-xs md:text-sm font-medium leading-tight text-white group-hover:text-primary transition-colors line-clamp-2 p-2 pointer-events-none">
                                            {content.title}
                                        </h3>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Download Modal - Relocated to end for better layering */}
                    {currentContent && (
                        <DownloadModal
                            open={showDownloadModal}
                            onClose={() => setShowDownloadModal(false)}
                            title={currentContent.title}
                            thumbnail={currentContent.thumbnail_url}
                            downloadUrl={currentEpisode?.download_url || currentContent.download_url || ''}
                            downloads={currentEpisode?.downloads || currentContent.downloads}
                            download_mode={currentEpisode?.download_mode || currentContent.download_mode || 'direct'}
                        />
                    )}
            </main>
        </div>
    );
}
