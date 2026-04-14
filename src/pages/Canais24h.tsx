import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { getAllContents } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content, Episode } from "@/types/content";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { Loader2, Film, Tv, Clock, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { getBaseUrl } from "@/lib/api";
import { useSearchParams } from "react-router-dom";

import { Volume2, VolumeX, Maximize, Minimize, Play, Pause, SkipBack, SkipForward, PictureInPicture } from "lucide-react";
import { Slider } from "@/components/ui/slider";

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

const getWatermarkClasses = (position?: string) => {
    switch (position) {
        case 'top-left': return 'top-6 left-6';
        case 'top-right': return 'top-6 right-6';
        case 'bottom-right': return 'bottom-6 right-6';
        default: return 'bottom-6 left-6';
    }
};

const YouTubePlayer = memo(({ videoId, id, startTime, active, onTimeUpdate, onEnded, playbackSpeed, onToggleFullscreen, isFullscreen, title, watermarkUrl, watermarkPosition, watermarkSize }: {
    videoId: string;
    id: string;
    startTime: number;
    active: boolean;
    onTimeUpdate: (time: number, duration?: number) => void;
    onEnded: () => void;
    playbackSpeed?: number;
    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
    title?: string;
    watermarkUrl?: string;
    watermarkPosition?: string;
    watermarkSize?: number;
}) => {
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<any>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(100);
    const [showControls, setShowControls] = useState(false);
    const [currentTime, setCurrentTime] = useState(startTime || 0);
    const [duration, setDuration] = useState(0);

    const onTimeUpdateRef = useRef(onTimeUpdate);
    const onEndedRef = useRef(onEnded);
    const activeRef = useRef(active);
    const startTimeRef = useRef(startTime);
    onTimeUpdateRef.current = onTimeUpdate;
    onEndedRef.current = onEnded;
    activeRef.current = active;
    startTimeRef.current = startTime;

    // Format time helper
    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds)) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // UI Controls triggers
    const triggerTogglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (playerRef.current) {
            const state = playerRef.current.getPlayerState();
            if (state === 1) { // playing
                playerRef.current.pauseVideo();
                setIsPlaying(false);
            } else {
                playerRef.current.playVideo();
                setIsPlaying(true);
            }
        }
    };

    const triggerToggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (playerRef.current) {
            if (isMuted || volume === 0) {
                playerRef.current.unMute();
                playerRef.current.setVolume(volume > 0 ? volume : 100);
                setIsMuted(false);
                setVolume(volume > 0 ? volume : 100);
            } else {
                playerRef.current.mute();
                setIsMuted(true);
            }
        }
    };

    // Keep controls active on mouse move
    const controlsTimeoutRef = useRef<any>(null);
    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    };



    useEffect(() => {
        let destroyed = false;
        let retryTimer: any = null;
        let safetyTimer: any = null;
        setIsPlaying(false);
        setHasError(false);

        const initPlayer = (attempt = 0) => {
            if (destroyed) return;
            if (!window.YT?.Player) {
                // YT API not loaded yet, retry
                if (attempt < 30) retryTimer = setTimeout(() => initPlayer(attempt + 1), 200);
                return;
            }
            const el = document.getElementById(`yt-${id}-${videoId}`);
            if (!el) {
                // DOM element not ready yet, retry up to 15 times (3 seconds)
                if (attempt < 15) retryTimer = setTimeout(() => initPlayer(attempt + 1), 200);
                return;
            }

            try { playerRef.current?.destroy(); } catch {}
            playerRef.current = null;

            playerRef.current = new window.YT.Player(`yt-${id}-${videoId}`, {
                videoId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    start: Math.floor(startTime),
                    origin: window.location.origin,
                    playsinline: 1,
                },
                events: {
                    onReady: (e: any) => {
                        if (destroyed) return;
                        e.target.mute();
                        e.target.playVideo();

                        // If active, unmute immediately
                        if (activeRef.current) {
                            setTimeout(() => {
                                try {
                                    e.target.unMute();
                                    e.target.setVolume(100);
                                    setIsMuted(false);
                                } catch {}
                            }, 300);
                        }
                        
                        // Force seek to designated start time! (Critical for correct time advancement)
                        if (startTimeRef.current && startTimeRef.current > 0) {
                           e.target.seekTo(startTimeRef.current, true);
                        }

                        // Time sync interval
                        if (intervalRef.current) clearInterval(intervalRef.current);
                        intervalRef.current = setInterval(() => {
                            try {
                                if (!playerRef.current || destroyed) return;
                                const state = playerRef.current.getPlayerState();
                                
                                // Set playback speed
                                if (playbackSpeed && playerRef.current.getPlaybackRate() !== playbackSpeed) {
                                    playerRef.current.setPlaybackRate(playbackSpeed);
                                }

                                if (state === 1 && activeRef.current) {
                                    const ct = playerRef.current.getCurrentTime();
                                    const du = playerRef.current.getDuration();
                                    setCurrentTime(ct);
                                    setDuration(du);
                                    if (du > 0) onTimeUpdateRef.current(ct, du);
                                }
                                // Auto-recover: if CUED (5) or UNSTARTED (-1), force play
                                if (state === 5 || state === -1) {
                                    playerRef.current.playVideo();
                                }
                            } catch {}
                        }, 1000);
                    },
                    onError: (e: any) => {
                        if (destroyed) return;
                        setHasError(true);
                        setIsPlaying(false);
                        
                        // If it's a critical error (like blocked video), auto-skip
                        if (activeRef.current) {
                            setTimeout(() => {
                                onEndedRef.current();
                            }, 3000); // Wait 3 seconds showing the cover before skipping
                        }
                    },
                    onStateChange: (e: any) => {
                        if (destroyed) return;
                        const YTState = window.YT.PlayerState;
                        
                        if (e.data === YTState.PLAYING) {
                            setIsPlaying(true);
                        } else if (e.data === YTState.BUFFERING || e.data === YTState.PAUSED || e.data === YTState.UNSTARTED) {
                            setIsPlaying(false);
                        }

                        if (e.data === YTState.ENDED) {
                            if (activeRef.current) onEndedRef.current();
                        }
                        // Force play if CUED (loaded but not playing)
                        if (e.data === 5) {
                            e.target.playVideo();
                        }
                        // Auto-resume if paused unexpectedly
                        if (e.data === YTState.PAUSED && activeRef.current) {
                            setTimeout(() => {
                                try {
                                    if (playerRef.current?.getPlayerState?.() === YTState.PAUSED) {
                                        playerRef.current.playVideo();
                                    }
                                } catch {}
                            }, 800);
                        }
                    },
                },
            });

            // Safety timer: if after 5s the video still hasn't played, force it
            safetyTimer = setTimeout(() => {
                if (destroyed) return;
                try {
                    const state = playerRef.current?.getPlayerState?.();
                    if (state !== 1) { // not playing
                        playerRef.current?.playVideo();
                    }
                } catch {}
            }, 5000);
        };

        if (!window.YT) {
            if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
                const tag = document.createElement("script");
                tag.src = "https://www.youtube.com/iframe_api";
                document.body.appendChild(tag);
            }
            const prevReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if (prevReady) prevReady();
                initPlayer();
            };
        } else {
            // Start trying immediately
            initPlayer();
        }

        return () => {
            destroyed = true;
            if (retryTimer) clearTimeout(retryTimer);
            if (safetyTimer) clearTimeout(safetyTimer);
            if (intervalRef.current) clearInterval(intervalRef.current);
            try { playerRef.current?.destroy(); } catch {}
            playerRef.current = null;
        };
    }, [videoId, id]); // ONLY recreate when video changes

    // Mute/unmute AND play/pause based on active state (does NOT recreate iframe)
    useEffect(() => {
        try {
            if (!playerRef.current) return;
            if (active) {
                // Delayed unmuting for smoother transition
                setTimeout(() => {
                    try {
                        if (!playerRef.current) return;
                        playerRef.current.unMute();
                        playerRef.current.setVolume(100);
                        setIsMuted(false);
                        // Ensure playing
                        if (playerRef.current.getPlayerState?.() !== 1) {
                            playerRef.current.playVideo();
                        }
                    } catch {}
                }, 800);
            } else {
                playerRef.current.mute();
                playerRef.current.pauseVideo();
            }
        } catch {}
    }, [active]);

    return (
        <div 
            ref={containerRef}
            id={`yt-slot-container-${id}-${videoId}`}
            data-slot-id={id}
            className="w-full h-full overflow-hidden relative bg-black group pointer-events-auto"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={triggerTogglePlay}
        >
            <div className={`absolute inset-[-15%] w-[130%] h-[130%] transition-opacity duration-700 pointer-events-none ${isPlaying && !hasError ? 'opacity-100' : 'opacity-0'}`}>
                <div id={`yt-${id}-${videoId}`} className="w-full h-full" />
            </div>
            
            {/* Catch clicks so they don't go to iframe */}
            <div className="absolute inset-0 z-10 pointer-events-none" />

            {/* Logo / Loading / Error Overlay */}
            {(!isPlaying || hasError) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 gap-6">
                    {watermarkUrl ? (
                        <div className="animate-pulse">
                            <img src={watermarkUrl} alt="Channel" className="h-24 md:h-32 w-auto object-contain filter drop-shadow-2xl" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
                    )}
                    <p className="text-white/70 font-bold text-xs md:text-sm animate-pulse tracking-[0.2em] uppercase px-4 text-center">
                        {hasError ? "Conteúdo Indisponível. A saltar..." : "A ligar à emissão..."}
                    </p>
                </div>
            )}

            {watermarkUrl && isPlaying && !hasError && (
                <div className={`absolute ${getWatermarkClasses(watermarkPosition)} z-[35] pointer-events-none select-none transition-all duration-300 opacity-70`}>
                    <img 
                        src={watermarkUrl} 
                        alt="Watermark" 
                        style={{ height: `${(watermarkSize || 8) * 4}px` }}
                        className="w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" 
                    />
                </div>
            )}
            
            {(!isPlaying && !hasError) && (
                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <button 
                        className="w-14 h-14 md:w-20 md:h-20 bg-primary/90 hover:bg-primary rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl scale-110 opacity-0 group-hover:opacity-100"
                    >
                        <Play className="w-6 h-6 md:w-10 md:h-10 text-white fill-white ml-1" />
                    </button>
                </div>
            )}

            <div 
                className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 z-30 ${(!hasError && (showControls || !isPlaying)) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
                

                
                <div className="relative p-3 md:p-4 space-y-2 md:space-y-3 z-40">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 md:gap-2">
                             <button onClick={triggerTogglePlay} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                                 {isPlaying ? <Pause className="w-4 h-4 md:w-6 md:h-6 text-white fill-white" /> : <Play className="w-4 h-4 md:w-6 md:h-6 text-white fill-white ml-0.5" />}
                             </button>
                             <div className="flex items-center gap-1 md:gap-2">
                                  <button onClick={triggerToggleMute} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-white" /> : <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-white" />}
                                  </button>
                             </div>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">


                            {onToggleFullscreen && (
                                <button onClick={onToggleFullscreen} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                                    {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5 text-white" /> : <Maximize className="w-4 h-4 md:w-5 md:h-5 text-white" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
YouTubePlayer.displayName = "YouTubePlayer";

// ============================================================
// SOCIAL PLAYER — Handles Facebook and X (Twitter)
// ============================================================
import ReactPlayerComponent from 'react-player';
const ReactPlayer = ReactPlayerComponent as any;

const SocialPlayer = memo(({ url, active, onTimeUpdate, onEnded, onToggleFullscreen, isFullscreen, title, watermarkUrl, watermarkPosition, watermarkSize }: {
    url: string;
    active: boolean;
    onTimeUpdate: (time: number) => void;
    onEnded: () => void;
    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
    title?: string;
    watermarkUrl?: string;
    watermarkPosition?: string;
    watermarkSize?: number;
}) => {

    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(active);
    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(1);
    const [showControls, setShowControls] = useState(false);
    const playerRef = useRef<any>(null);




    // Sync active state with playback
    useEffect(() => {
        setIsPlaying(active);
    }, [active]);

    const handleProgress = (state: { playedSeconds: number; loadedSeconds: number }) => {
        if (active) {
            onTimeUpdate(state.playedSeconds);
        }
    };

    // Auto-unmute when active
    useEffect(() => {
        if (active) {
            const t = setTimeout(() => {
                setIsMuted(false);
                setVolume(1);
            }, 800);
            return () => clearTimeout(t);
        } else {
            setIsMuted(true);
        }
    }, [active]);

    const togglePlay = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsPlaying(!isPlaying);
    };

    const toggleMute = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMuted(!isMuted);
    };

    // Auto-hide controls
    const controlsTimeoutRef = useRef<any>(null);
    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    };

    return (
        <div 
            id={`social-slot-container-${url}`}
            className="w-full h-full bg-black relative group overflow-hidden"
        >
            <div 
                ref={containerRef}
                className="w-full h-full relative"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => isPlaying && setShowControls(false)}
                onClick={togglePlay}
            >
                {/* Watermark Logo Overlay */}
                {watermarkUrl && (
                    <div className={`absolute ${getWatermarkClasses(watermarkPosition)} z-[35] pointer-events-none select-none transition-all duration-300 opacity-70`}>
                        <img 
                            src={watermarkUrl} 
                            alt="Watermark" 
                            style={{ height: `${(watermarkSize || 8) * 4}px` }}
                            className="w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" 
                        />
                    </div>
                )}

            {url.includes('facebook.com') || url.includes('fb.watch') ? (
                <div className="absolute inset-0 bg-black flex items-center justify-center">
                    <iframe
                        src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&t=0&autoplay=1&mute=1`}
                        width="100%"
                        height="100%"
                        style={{ border: 'none', overflow: 'hidden' }}
                        scrolling="no"
                        frameBorder="0"
                        allowFullScreen={true}
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                        onLoad={() => {
                            if (active) onTimeUpdate(1);
                        }}
                    />
                    
                    {/* UI Patches to hide Facebook branding elements */}
                    {active && (
                        <>
                            {/* Hide Top Left Branding (Logo/Name) */}
                            <div className="absolute top-0 left-0 w-[40%] h-[50px] bg-black/80 blur-sm pointer-events-none z-10" />
                            
                            {/* Hide Top Right Branding (Live/Share) */}
                            <div className="absolute top-0 right-0 w-[30%] h-[50px] bg-black/80 blur-sm pointer-events-none z-10" />
                        </>
                    )}
                </div>
            ) : (
                <ReactPlayer
                    ref={playerRef}
                    url={url}
                    width="100%"
                    height="100%"
                    playing={active && isPlaying}
                    muted={!active || isMuted}
                    volume={volume}
                    onProgress={(state: any) => {
                        if (active) handleProgress(state);
                    }}
                    onEnded={() => {
                        if (active) onEnded();
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    progressInterval={1000}
                    style={{ position: 'absolute', top: 0, left: 0 }}
                />
            )}

            {/* UI Custom Overlay (consistent with YouTubePlayer) */}
            <div 
                className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 z-30 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
                

                
                <div className="relative p-3 md:p-4 space-y-2 md:space-y-3 z-40">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 md:gap-2">
                             <button onClick={togglePlay} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                                 {isPlaying ? <Pause className="w-4 h-4 md:w-6 md:h-6 text-white fill-white" /> : <Play className="w-4 h-4 md:w-6 md:h-6 text-white fill-white ml-0.5" />}
                             </button>
                             <div className="flex items-center gap-1 md:gap-2">
                                  <button onClick={toggleMute} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-white" /> : <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-white" />}
                                  </button>
                             </div>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">


                             {onToggleFullscreen && (
                                 <button onClick={onToggleFullscreen} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                                      {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5 text-white" /> : <Maximize className="w-4 h-4 md:w-5 md:h-5 text-white" />}
                                 </button>
                             )}
                        </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
});
SocialPlayer.displayName = "SocialPlayer";

// ============================================================
// PLAYER SLOT — Renders YouTube or VideoPlayer
// ============================================================
const PlayerSlot = memo(({ id, content, tiktokUrl, active, channelThumb, watermarkPosition, watermarkSize, onTimeUpdate, onEnded, onToggleFullscreen, isFullscreen }: {
    id: string;
    content: QueueItem | null;
    tiktokUrl: string | null;
    active: boolean;
    channelThumb?: string;
    watermarkPosition?: string;
    watermarkSize?: number;
    onTimeUpdate?: (time: number, duration?: number) => void;
    onEnded?: () => void;
    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
}) => {
    const getYtId = (url?: string) => {
        if (!url) return null;
        const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/|live\/)([^#&?]*).*/);
        return m && m[2].length === 11 ? m[2] : null;
    };

    const ytId = content ? getYtId(content.url) : null;
    const isTikTok = content?.url?.includes("tiktok.com") || false;
    const isFacebook = content?.url?.includes("facebook.com") || content?.url?.includes("fb.watch") || false;
    const isTwitter = content?.url?.includes("twitter.com") || content?.url?.includes("x.com") || false;
    const isSocial = isFacebook || isTwitter;

        // TikTok auto-skip if error
    useEffect(() => {
        if (isTikTok && tiktokUrl === "error" && active && onEnded) {
            const t = setTimeout(onEnded, 2500);
            return () => clearTimeout(t);
        }
    }, [isTikTok, tiktokUrl, active, onEnded]);

    if (!content) return null;

    // TikTok loading
    if (isTikTok && tiktokUrl === null) {
        return (
            <div className={`absolute inset-0 w-full h-full flex items-center justify-center bg-black transition-opacity duration-500 ${active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
                <div className="bg-black/80 backdrop-blur-xl p-8 rounded-3xl border border-white/5 flex flex-col items-center shadow-2xl">
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                    <span className="text-xs font-bold text-white uppercase tracking-[0.2em] opacity-80">A Sincronizar...</span>
                </div>
            </div>
        );
    }

    // TikTok error
    if (isTikTok && tiktokUrl === "error") {
        return (
            <div className={`absolute inset-0 w-full h-full flex items-center justify-center bg-black transition-opacity duration-500 ${active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
                <div className="bg-black/40 backdrop-blur-md p-6 rounded-2xl border border-red-500/20 text-center">
                    <p className="text-red-400 font-bold mb-2">Conteúdo Indisponível</p>
                    <span className="text-sm text-white/50">A saltar vídeo...</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-in-out ${active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
            {ytId ? (
                <YouTubePlayer 
                    videoId={ytId}
                    id={id}
                    startTime={content.startTime}
                    active={active}
                    onTimeUpdate={onTimeUpdate || (() => {})}
                    onEnded={onEnded || (() => {})}
                    playbackSpeed={content.playbackSpeed}
                    onToggleFullscreen={onToggleFullscreen}
                    isFullscreen={isFullscreen}
                    watermarkUrl={channelThumb}
                    watermarkPosition={watermarkPosition}
                    watermarkSize={watermarkSize}
                />
            ) : isSocial ? (
                <SocialPlayer
                    url={content.url}
                    active={active}
                    onTimeUpdate={onTimeUpdate || (() => {})}
                    onEnded={onEnded || (() => {})}
                    onToggleFullscreen={onToggleFullscreen}
                    isFullscreen={isFullscreen}
                    watermarkUrl={channelThumb}
                    watermarkPosition={watermarkPosition}
                    watermarkSize={watermarkSize}
                />
            ) : (
                <VideoPlayer
                    url={isTikTok ? tiktokUrl! : content.url}
                    poster={channelThumb}
                    autoPlay={true}
                    startTime={content.startTime}
                    active={active}
                    isLive={true}
                    onEnded={() => {
                        if (active && onEnded) onEnded();
                    }}
                    onTimeUpdate={(t, d) => {
                        if (active && onTimeUpdate) onTimeUpdate(t, d);
                    }}
                    onToggleFullscreen={onToggleFullscreen}
                    isFullscreen={isFullscreen}
                    muted={!active}
                    initialPlaybackRate={content.playbackSpeed}
                    watermarkUrl={channelThumb}
                    watermarkPosition={watermarkPosition}
                    watermarkSize={watermarkSize}
                />
            )}
        </div>
    );
});
PlayerSlot.displayName = "PlayerSlot";

// ============================================================
// TYPE for queue items
// ============================================================
interface QueueItem {
    url: string;
    startTime: number;
    title: string;
    type: "program" | "interval" | "ad" | "logo";
    programIndex: number;
    playbackSpeed?: number;
    breakIndex?: number;
    description?: string;
    programsSinceBreak?: number;
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function Canais24h() {
    const [searchParams] = useSearchParams();
    const initialChannelId = searchParams.get("channelId");

    const [contents, setContents] = useState<Content[]>([]);
    const [currentChannel, setCurrentChannel] = useState<Content | null>(null);
    const [loading, setLoading] = useState(true);
    const [showApkWarning, setShowApkWarning] = useState(false);

    // Detect Capacitor (APK)
    useEffect(() => {
        const checkApk = () => {
            const isCapacitor = (window as any).Capacitor?.isNativePlatform;
            if (isCapacitor) {
                setShowApkWarning(true);
            }
        };
        checkApk();
    }, []);

    const handleAdvanceToWeb = () => {
        const webUrl = `https://unitvfilms.vercel.app/canais24h${initialChannelId ? `?channelId=${initialChannelId}` : ""}`;
        window.open(webUrl, "_blank");
    };

    // Server time offset
    const serverOffsetRef = useRef(0);

    // Dual player slots
    const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
    const [slotA, setSlotA] = useState<QueueItem | null>(null);
    const [slotB, setSlotB] = useState<QueueItem | null>(null);
    const [tiktokA, setTiktokA] = useState<string | null>(null);
    const [tiktokB, setTiktokB] = useState<string | null>(null);

    // UI
    const [nowPlayingTitle, setNowPlayingTitle] = useState("");
    const [isAdMode, setIsAdMode] = useState(false);
    const [realTime, setRealTime] = useState(0);
    const [realDuration, setRealDuration] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPiP, setIsPiP] = useState(false);

    // Ref to player container for fullscreen and PiP
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const pipWindowRef = useRef<any>(null);
    const playerContainerParentRef = useRef<HTMLElement | null>(null);
    const channelListRef = useRef<HTMLDivElement>(null);

    // Track current program index
    const currentIndexRef = useRef(0);
    const isTransitioningRef = useRef(false);
    const bufferReadyRef = useRef(false);
    
    // Channel generation counter to invalidate stale TikTok promises
    const channelGenRef = useRef(0);

    // --- SMART ROTATION SYSTEM ---
    const recentTitlesRef = useRef<string[]>([]);
    const consecutiveTitleCountRef = useRef(0);

    // Sort programs naturally (alphabetically but with awareness of numbers)
    // This allows "Ep 1, Ep 2, Ep 10" to be in correct order automatically.
    const programs = useMemo(() => {
        return currentChannel?.episodes || [];
    }, [currentChannel?.episodes]);
    const intervalList = currentChannel?.interval_list || [];
    const adList = currentChannel?.ad_list || [];

    // Use refs for state accessed in callbacks to avoid stale closures
    const activeSlotRef = useRef(activeSlot);
    const slotARef = useRef(slotA);
    const slotBRef = useRef(slotB);
    activeSlotRef.current = activeSlot;
    slotARef.current = slotA;
    slotBRef.current = slotB;

    // ---- 1. Load channels ----
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const all = await getAllContents();
                const canais = all.filter((c) => c.category === "canais24h");
                setContents(canais);
                if (canais.length > 0) {
                    const t = initialChannelId ? canais.find((c) => c.id === initialChannelId) : canais[0];
                    setCurrentChannel(t || canais[0]);
                }
            } catch {
                toast.error("Erro ao carregar canais");
            } finally {
                setLoading(false);
            }
        })();
    }, [initialChannelId]);

    // ---- 2. Server sync (once) ----
    useEffect(() => {
        (async () => {
            try {
                const t0 = Date.now();
                const r = await fetch(window.location.origin, { method: "HEAD" });
                const d = r.headers.get("Date");
                if (d) {
                    serverOffsetRef.current = new Date(d).getTime() + (Date.now() - t0) / 2 - Date.now();
                }
            } catch {}
        })();
    }, []);

    // ---- 3. Get initial program index from global time ----
    const getInitialState = useCallback(() => {
        if (!currentChannel || programs.length === 0) return null;

        const GAP = 0; 
        const channelId = currentChannel.id;
        
        // 1. First, check if we have a saved progression state for this channel locally
        const SAVED_STATE_KEY = `tv_progression_${channelId}`;
        const savedSyncStr = localStorage.getItem(SAVED_STATE_KEY);
        
        let bestStartingProg = null;
        let bestStartTime = 0;
        
        if (savedSyncStr) {
            try {
                const data = JSON.parse(savedSyncStr);
                const elapsedSinceSave = Math.floor((Date.now() - data.realTimestamp) / 1000);
                
                // CRITICAL: If the programming length changed, ignore saved state to avoid index out of bounds or stale sync
                if (data.programCount !== programs.length) {
                    localStorage.removeItem(SAVED_STATE_KEY);
                    throw new Error("Programming changed");
                }

                // If it's been less than 24 hours, we resume from where they were and skip forward logically
                // to simulate they left the TV on. (Advances TV time correctly without looping) a true virtual broadcast tracking.
                if (elapsedSinceSave >= 0 && elapsedSinceSave < 86400) {
                    let simulatedProgIndex = data.index;
                    let simulatedElapsedWithinVideo = data.videoTime + elapsedSinceSave;
                    
                    // Loop forward through programs mathematically to find the correct active video now!
                    let iterations = 0;
                    while (iterations < programs.length) {
                         const currentDur = programs[simulatedProgIndex]?.duration || 1800; // Use actual duration if present
                         if (simulatedElapsedWithinVideo < currentDur) {
                             bestStartingProg = programs[simulatedProgIndex];
                             bestStartTime = simulatedElapsedWithinVideo;
                             break;
                         } else {
                             // Subtract duration, jump to next block
                             simulatedElapsedWithinVideo -= currentDur;
                             simulatedProgIndex = (simulatedProgIndex + 1) % programs.length;
                         }
                         iterations++;
                    }
                    
                    if (bestStartingProg) {
                        return {
                            item: {
                                url: bestStartingProg.internal_player_url || bestStartingProg.url || "",
                                startTime: bestStartTime,
                                title: bestStartingProg.title || "",
                                type: "program" as const,
                                programIndex: simulatedProgIndex,
                                playbackSpeed: bestStartingProg.playback_speed,
                                description: bestStartingProg.description || "",
                            },
                            duration: bestStartingProg.duration || 1800,
                        };
                    }
                }
            } catch {}
        }

        // 2. Fallback to static mathematical scheduler 
        const nowSec = Math.floor((Date.now() + serverOffsetRef.current) / 1000);
        const salt = currentChannel.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        let total = 0;
        const mapped = programs.map((p, i) => {
            const s = total;
            const dur = p.duration || 1800;
            total = s + dur + GAP;
            return { index: i, cycleStart: s, cycleEnd: s + dur, dur, gap: GAP };
        });

        const t = (nowSec + salt) % (total || 1);

        for (const m of mapped) {
            if (t >= m.cycleStart && t < m.cycleEnd) {
                const prog = programs[m.index];
                return {
                    item: {
                        url: prog.internal_player_url || prog.url || "",
                        startTime: t - m.cycleStart,
                        title: prog.title || "",
                        type: "program" as const,
                        programIndex: m.index,
                        playbackSpeed: prog.playback_speed,
                        description: prog.description || "",
                    },
                    duration: m.dur,
                };
            }
        }

        // Fallback: if no slot matched (edge case), start from first program
        const fallbackProg = programs[0];
        return {
            item: {
                url: fallbackProg.internal_player_url || fallbackProg.url || "",
                startTime: 0,
                title: fallbackProg.title || "",
                type: "program" as const,
                programIndex: 0,
                playbackSpeed: fallbackProg.playback_speed,
                description: fallbackProg.description || "",
            },
            duration: fallbackProg.duration || 1800,
        };
    }, [currentChannel, programs]);

    // TikTok resolver with 8s timeout + generation guard
    const resolveTikTok = useCallback(async (url: string, gen: number): Promise<string> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
            const baseUrl = getBaseUrl();
            console.log(`Resolving TikTok: ${url} using base: ${baseUrl}`);
            const r = await fetch(`${baseUrl}/api/tiktok?url=${encodeURIComponent(url)}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (channelGenRef.current !== gen) return "stale";
            
            if (!r.ok) {
                console.error(`TikTok resolve failed: ${r.status} ${r.statusText}`);
                return "error";
            }
            
            const d = await r.json();
            return d.url || "error";
        } catch (err) {
            console.error('TikTok resolution catch:', err);
            return "error";
        }
    }, []);

    // ---- 4. Build the NEXT item ----
    const getNextItem = useCallback((currentItem: QueueItem): QueueItem => {
        const shuffleIntervals = currentChannel?.shuffle_intervals || false;
        const shuffleAds = currentChannel?.shuffle_ads || false;
        
        // Settings
        const freq = currentChannel?.break_frequency || 0;
        const globInt = currentChannel?.global_intervals_count || 0;
        const globAds = currentChannel?.global_ads_count || 0;
        const logoUrl = currentChannel?.post_break_logo_url;
        
        // Trackers
        let breakIdx = currentItem.breakIndex || 0;
        let pSince = currentItem.programsSinceBreak || 0;

        // Helper to get next random media link
        const getRandom = (list: any[]) => list[Math.floor(Math.random() * list.length)];
        const getLinear = (list: any[], idx: number) => list[idx % list.length];
        
        // Check if we need to enter a break block
        let shouldBreak = false;
        if (currentItem.type === "program" && freq > 0) {
            pSince += 1; // We just finished a program
            if (pSince >= freq) {
                shouldBreak = true;
            }
        }

        // 1. Transition FROM Program TO Break (if needed)
        if (shouldBreak) {
            if (globInt > 0 && intervalList.length > 0) {
                const item = shuffleIntervals ? getRandom(intervalList) : getLinear(intervalList, 0);
                return { url: item.url, startTime: 0, title: item.title || "Intervalo", type: "interval", programIndex: currentItem.programIndex, breakIndex: 1, programsSinceBreak: 0 };
            } else if (globAds > 0 && adList.length > 0) {
                const item = shuffleAds ? getRandom(adList) : getLinear(adList, 0);
                return { url: item.url, startTime: 0, title: item.title || "Publicidade", type: "ad", programIndex: currentItem.programIndex, breakIndex: 1, programsSinceBreak: 0 };
            } else if (logoUrl) {
                return { url: logoUrl, startTime: 0, title: "Logo", type: "logo", programIndex: currentItem.programIndex, programsSinceBreak: 0 };
            }
        }

        // 2. Play legacy breaks if global breaks are not active
        if (currentItem.type === "program" && !shouldBreak && freq === 0) {
            const currentProg = programs[currentItem.programIndex] || programs[0];
            const reqInt = currentProg?.post_video_intervals || 0;
            const reqAds = currentProg?.post_video_ads || 0;
            
            if (reqInt > 0 && intervalList.length > 0) {
                const item = shuffleIntervals ? getRandom(intervalList) : getLinear(intervalList, 0);
                return { url: item.url, startTime: 0, title: item.title || "Intervalo", type: "interval", programIndex: currentItem.programIndex, breakIndex: 1, programsSinceBreak: pSince };
            } else if (reqAds > 0 && adList.length > 0) {
                const item = shuffleAds ? getRandom(adList) : getLinear(adList, 0);
                return { url: item.url, startTime: 0, title: item.title || "Publicidade", type: "ad", programIndex: currentItem.programIndex, breakIndex: 1, programsSinceBreak: pSince };
            }
        }

        // 3. Continue Interval Block
        if (currentItem.type === "interval") {
            const targetInt = freq > 0 ? globInt : ((programs[currentItem.programIndex] || programs[0])?.post_video_intervals || 0);
            const targetAds = freq > 0 ? globAds : ((programs[currentItem.programIndex] || programs[0])?.post_video_ads || 0);
            
            if (breakIdx < targetInt && intervalList.length > 0) {
                const item = shuffleIntervals ? getRandom(intervalList) : getLinear(intervalList, breakIdx);
                return { url: item.url, startTime: 0, title: item.title || "Intervalo", type: "interval", programIndex: currentItem.programIndex, breakIndex: breakIdx + 1, programsSinceBreak: 0 };
            } else if (targetAds > 0 && adList.length > 0) {
                const item = shuffleAds ? getRandom(adList) : getLinear(adList, 0);
                return { url: item.url, startTime: 0, title: item.title || "Publicidade", type: "ad", programIndex: currentItem.programIndex, breakIndex: 1, programsSinceBreak: 0 };
            } else if (freq > 0 && logoUrl) {
                return { url: logoUrl, startTime: 0, title: "Logo", type: "logo", programIndex: currentItem.programIndex, programsSinceBreak: 0 };
            }
        }

        // 4. Continue Ad Block
        if (currentItem.type === "ad") {
            const targetAds = freq > 0 ? globAds : ((programs[currentItem.programIndex] || programs[0])?.post_video_ads || 0);
            
            if (breakIdx < targetAds && adList.length > 0) {
                const item = shuffleAds ? getRandom(adList) : getLinear(adList, breakIdx);
                return { url: item.url, startTime: 0, title: item.title || "Publicidade", type: "ad", programIndex: currentItem.programIndex, breakIndex: breakIdx + 1, programsSinceBreak: 0 };
            } else if (freq > 0 && logoUrl) {
                return { url: logoUrl, startTime: 0, title: "Logo", type: "logo", programIndex: currentItem.programIndex, programsSinceBreak: 0 };
            }
        }

        // 5. From Logo to Next Program
        // Logo is the end of the break block. Or if there was no break but we just ended a program.
        
        // 6. Next Program (Smart Rotation Logic)
        let nextIdx = (currentItem.programIndex + 1) % programs.length;
        let nextProg = programs[nextIdx];

        // VARIETY CHECK: If it's the same title and we've reached a repetition limit (e.g. 2 in a row)
        // OR if the next title is already in our recent history (to ensure mix)
        const currentTitle = currentItem.title || "";
        const nextTitle = nextProg?.title || "";
        const history = recentTitlesRef.current;

        // Determine if we should seek variety
        // We allow 2 consecutive plays (to support 2x2 mode) but seek variety if it would be the 3rd or if it's already in recent history
        let needsVariety = false;
        if (nextTitle === currentTitle) {
            if (consecutiveTitleCountRef.current >= 1) { // 0-indexed, so 1 means we've already played it twice (initial + 1 repeat)
                needsVariety = true;
            }
        } else if (history.includes(nextTitle) && programs.length > history.length + 1) {
            // If the title is in recent history and we have enough other programs to choose from, skip it
            needsVariety = true;
        }

        if (needsVariety && programs.length > 1) {
            // Find a different title, prioritizing the END of the list as requested
            let foundVariety = false;
            // Search backwards from the end
            for (let i = programs.length - 1; i >= 0; i--) {
                const candidate = programs[i];
                const candTitle = candidate.title || "";
                if (candTitle !== currentTitle && !history.includes(candTitle)) {
                    nextIdx = i;
                    nextProg = candidate;
                    foundVariety = true;
                    break;
                }
            }

            // Fallback: if no "perfect" variety found, just pick the next one that isn't the current title
            if (!foundVariety) {
                for (let i = 0; i < programs.length; i++) {
                    const idx = (nextIdx + i) % programs.length;
                    const candidate = programs[idx];
                    if (candidate.title !== currentTitle) {
                        nextIdx = idx;
                        nextProg = candidate;
                        break;
                    }
                }
            }
        }

        // Update tracking state
        if (nextTitle === currentTitle) {
            consecutiveTitleCountRef.current += 1;
        } else {
            consecutiveTitleCountRef.current = 0;
            // Update history
            const newHistory = [nextTitle, ...history.filter(t => t !== nextTitle)].slice(0, 5);
            recentTitlesRef.current = newHistory;
        }

        // If coming from logo or break, pSince is already 0. If coming from program, it increments naturally.
        if (currentItem.type === "program" && !shouldBreak) pSince += 1;

        return {
            url: nextProg?.internal_player_url || nextProg?.url || "",
            startTime: 0,
            title: nextProg?.title || "",
            type: "program",
            programIndex: nextIdx,
            playbackSpeed: nextProg?.playback_speed,
            breakIndex: 0,
            description: nextProg?.description || "",
            programsSinceBreak: pSince,
        };
    }, [programs, currentChannel, intervalList, adList]);

    // ---- Helper: resolve TikTok for a slot ----
    const loadTikTokForSlot = useCallback((item: QueueItem, slot: "A" | "B") => {
        const gen = channelGenRef.current;
        if (item.url.includes("tiktok.com")) {
            if (slot === "A") setTiktokA(null);
            else setTiktokB(null);
            resolveTikTok(item.url, gen).then((resolved) => {
                if (resolved === "stale") return; // channel changed, ignore
                if (slot === "A") setTiktokA(resolved);
                else setTiktokB(resolved);
            });
        } else {
            if (slot === "A") setTiktokA(null);
            else setTiktokB(null);
        }
    }, [resolveTikTok]);

    // ---- 5. INITIAL LOAD ----
    useEffect(() => {
        if (!currentChannel || programs.length === 0) return;

        const initial = getInitialState();
        if (!initial) return;

        currentIndexRef.current = initial.item.programIndex;
        isTransitioningRef.current = false;
        bufferReadyRef.current = false;

        setSlotA(initial.item);
        setSlotB(null);
        setActiveSlot("A");
        setNowPlayingTitle(initial.item.title);
        setIsAdMode(initial.item.type !== "program");
        setRealDuration(initial.duration);
        setRealTime(initial.item.startTime);
        setLoading(false);
        setTiktokB(null);
        
        // --- SMART ROTATION INIT ---
        recentTitlesRef.current = [initial.item.title];
        consecutiveTitleCountRef.current = 0;

        loadTikTokForSlot(initial.item, "A");
    }, [currentChannel, programs, getInitialState, loadTikTokForSlot]);

    // ---- 6. Swap when video ends ----
    const handleEnded = useCallback((fromSlot: string) => {
        const currentActive = activeSlotRef.current;
        // Only allow swap from the ACTIVE slot
        if (fromSlot !== currentActive) return;
        if (isTransitioningRef.current) return;
        isTransitioningRef.current = true;

        const currentContent = currentActive === "A" ? slotARef.current : slotBRef.current;
        if (!currentContent) {
            isTransitioningRef.current = false;
            return;
        }

        const bufferSlot = currentActive === "A" ? slotBRef.current : slotARef.current;

        if (!bufferSlot) {
            // No buffer: load next and swap
            const nextItem = getNextItem(currentContent);
            const targetSlot = currentActive === "A" ? "B" : "A";

            if (targetSlot === "B") {
                setSlotB(nextItem);
                loadTikTokForSlot(nextItem, "B");
            } else {
                setSlotA(nextItem);
                loadTikTokForSlot(nextItem, "A");
            }

            setTimeout(() => {
                setActiveSlot(targetSlot);
                setNowPlayingTitle(nextItem.title);
                setIsAdMode(nextItem.type !== "program");
                currentIndexRef.current = nextItem.programIndex;
                setRealTime(0);
                bufferReadyRef.current = false;
                setTimeout(() => { isTransitioningRef.current = false; }, 1000);
            }, 400);
            return;
        }

        // NORMAL: Swap to pre-loaded buffer
        const newSlot = currentActive === "A" ? "B" : "A";
        setActiveSlot(newSlot);
        setNowPlayingTitle(bufferSlot.title);
        setIsAdMode(bufferSlot.type !== "program");
        currentIndexRef.current = bufferSlot.programIndex;
        setRealTime(0);
        bufferReadyRef.current = false;

        // Clear old slot after animation
        setTimeout(() => {
            if (newSlot === "A") { setSlotB(null); setTiktokB(null); }
            else { setSlotA(null); setTiktokA(null); }
            isTransitioningRef.current = false;
        }, 1200);
    }, [getNextItem, loadTikTokForSlot]);

    // Stable ref for handleEnded
    const handleEndedRef = useRef(handleEnded);
    handleEndedRef.current = handleEnded;

    // Stable callbacks for PlayerSlots (never change identity)
    const handleEndedA = useCallback(() => handleEndedRef.current("A"), []);
    const handleEndedB = useCallback(() => handleEndedRef.current("B"), []);

    // ---- 7. Pre-buffer & time tracking ----
    const lastSaveRef = useRef(0);
    
    const handleTimeUpdate = useCallback((time: number, duration?: number) => {
        if (time > 0) setRealTime(time);
        if (duration) setRealDuration(duration);

        // Periodically save progression (avoids duration-math skipping bug on refresh)
        const now = Date.now();
        if (now - lastSaveRef.current > 5000 && currentChannel) {
             lastSaveRef.current = now;
             const activeSlotName = activeSlotRef.current;
             const runningSlot = activeSlotName === "A" ? slotARef.current : slotBRef.current;
             if (runningSlot && runningSlot.type === "program") {
                  localStorage.setItem(`tv_progression_${currentChannel.id}`, JSON.stringify({
                       index: runningSlot.programIndex,
                       videoTime: Math.floor(time),
                       realTimestamp: now
                  }));
             }
        }

        const remaining = (duration || 0) - time;

        const activeSlotName = activeSlotRef.current;
        const runningSlot = activeSlotName === "A" ? slotARef.current : slotBRef.current;

        // NATURAL END (Watchdog for stuck players)
        if (duration && duration > 0 && remaining <= 0.5 && !isTransitioningRef.current) {
            handleEndedRef.current(activeSlotRef.current);
            return;
        }

        if (duration && remaining > 0 && remaining <= 0.5 && !isTransitioningRef.current) {
            handleEndedRef.current(activeSlotRef.current);
            return;
        }

        // PRE-BUFFER 10s before end
        if (remaining > 0 && remaining <= 10 && !bufferReadyRef.current) {
            bufferReadyRef.current = true;
            const currentItem = activeSlotRef.current === "A" ? slotARef.current : slotBRef.current;
            if (!currentItem) return;

            const nextItem = getNextItem(currentItem);
            if (activeSlotRef.current === "A") {
                setSlotB(nextItem);
                loadTikTokForSlot(nextItem, "B");
            } else {
                setSlotA(nextItem);
                loadTikTokForSlot(nextItem, "A");
            }
        }
    }, [getNextItem, loadTikTokForSlot, currentChannel]);

    // ---- Channel click ----
    const handleChannelClick = useCallback((channel: Content) => {
        // Increment generation to invalidate any in-flight TikTok promises
        channelGenRef.current++;
        
        setLoading(true);
        
        // Reset ALL player state
        setSlotA(null);
        setSlotB(null);
        setTiktokA(null);
        setTiktokB(null);
        setActiveSlot("A");
        setNowPlayingTitle("");
        setIsAdMode(false);
        setRealTime(0);
        setRealDuration(0);
        isTransitioningRef.current = false;
        bufferReadyRef.current = false;
        currentIndexRef.current = 0;

        // Set new channel (triggers useEffect to load initial state)
        setCurrentChannel(channel);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    const scrollChannels = (direction: "left" | "right") => {
        if (!channelListRef.current) return;
        const scrollAmount = direction === "left" ? -400 : 400;
        channelListRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    };
    
    
    // Manual refresh function
    const handleRefresh = useCallback(async () => {
        setLoading(true);
        try {
            const all = await getAllContents();
            const canais = all.filter((c) => c.category === "canais24h");
            setContents(canais);
            if (currentChannel) {
                const refreshed = canais.find(c => c.id === currentChannel.id);
                if (refreshed) {
                    setCurrentChannel(refreshed);
                }
            }
            toast.success("Programação atualizada!");
        } catch (err) {
            console.error("Refresh error:", err);
            toast.error("Erro ao atualizar!");
        } finally {
            setLoading(false);
        }
    }, [currentChannel]);


    // ---- UI Helpers ----
    const getRemainingTime = () => {
        if (!realDuration) return "Calculando...";
        const diff = realDuration - realTime;
        if (diff <= 0) return "Terminando...";
        const m = Math.floor(diff / 60);
        const s = Math.floor(diff % 60);
        return m > 0 ? `Faltam ${m}min ${s.toString().padStart(2, "0")}s` : `Faltam ${s}s`;
    };

    const getUpcomingPrograms = () => {
        if (programs.length === 0) return [];
        const idx = currentIndexRef.current;
        const upcoming: Episode[] = [];
        for (let i = 1; i <= 3; i++) {
            upcoming.push(programs[(idx + i) % programs.length]);
        }
        return upcoming;
    };

    // ---- Fullscreen management ----
    const toggleFullscreen = useCallback(() => {
        if (!playerContainerRef.current) return;
        if (!document.fullscreenElement) {
            playerContainerRef.current.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }, []);

    useEffect(() => {
        const onFSChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onFSChange);
        return () => document.removeEventListener("fullscreenchange", onFSChange);
    }, []);

    // ---- PiP (Mini-Player) at page level ----
    const toggleMiniPlayer = useCallback(async () => {
        const container = playerContainerRef.current;
        if (!container) return;

        if ("documentPictureInPicture" in window && !isPiP) {
            try {
                // Save the parent element so we can re-append later
                playerContainerParentRef.current = container.parentElement;

                // @ts-ignore
                const pipWindow = await window.documentPictureInPicture.requestWindow({
                    width: 640,
                    height: 360,
                });
                pipWindowRef.current = pipWindow;

                // Copy all stylesheets to PiP window
                [...document.styleSheets].forEach((styleSheet) => {
                    try {
                        if (styleSheet.cssRules) {
                            const newStyle = pipWindow.document.createElement("style");
                            [...styleSheet.cssRules].forEach((rule: CSSRule) => {
                                newStyle.appendChild(pipWindow.document.createTextNode(rule.cssText));
                            });
                            pipWindow.document.head.appendChild(newStyle);
                        } else if (styleSheet.href) {
                            const newLink = pipWindow.document.createElement("link");
                            newLink.rel = "stylesheet";
                            newLink.href = styleSheet.href;
                            pipWindow.document.head.appendChild(newLink);
                        }
                    } catch (e) {
                        if (styleSheet.href) {
                            const newLink = pipWindow.document.createElement("link");
                            newLink.rel = "stylesheet";
                            newLink.href = styleSheet.href;
                            pipWindow.document.head.appendChild(newLink);
                        }
                    }
                });

                pipWindow.document.body.style.backgroundColor = "black";
                pipWindow.document.body.style.margin = "0";
                pipWindow.document.body.style.overflow = "hidden";

                // Move the ENTIRE player container into PiP
                pipWindow.document.body.appendChild(container);
                // Make it fill the PiP window
                container.style.width = "100vw";
                container.style.height = "100vh";
                container.style.maxWidth = "none";
                container.style.borderRadius = "0";
                setIsPiP(true);

                pipWindow.addEventListener("pagehide", () => {
                    // Restore container back to main page
                    const parent = playerContainerParentRef.current;
                    if (parent) {
                        parent.appendChild(container);
                    }
                    // Reset inline styles
                    container.style.width = "";
                    container.style.height = "";
                    container.style.maxWidth = "";
                    container.style.borderRadius = "";
                    setIsPiP(false);
                    pipWindowRef.current = null;
                });
            } catch (err) {
                console.error("Document PiP failed:", err);
                toast.error("Erro ao abrir Mini-Player");
            }
        } else if (isPiP && pipWindowRef.current) {
            pipWindowRef.current.close();
        }
    }, [isPiP]);

    // Cleanup PiP on unmount
    useEffect(() => {
        return () => {
            if (pipWindowRef.current) {
                try { pipWindowRef.current.close(); } catch {}
            }
        };
    }, []);

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="min-h-screen bg-[#141414] text-white font-sans">
            <Header />
            <main className="pt-20 pb-10">
                {/* Player */}
                <div className="w-full max-w-7xl mx-auto px-4 md:px-8 mb-8">
                    <div
                        ref={playerContainerRef}
                        id="player-container"
                        className="relative w-full bg-black rounded-lg overflow-hidden shadow-2xl aspect-video group/container"
                    >
                        {loading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80">
                                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                <span>A carregar canal...</span>
                            </div>
                        ) : !currentChannel ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                                <Film className="w-16 h-16 text-primary mx-auto mb-4" />
                                <h2 className="text-2xl font-bold">Nenhum canal disponível</h2>
                            </div>
                        ) : (
                            <>
                                <PlayerSlot
                                    id="A"
                                    active={activeSlot === "A"}
                                    content={slotA}
                                    tiktokUrl={tiktokA}
                                    channelThumb={currentChannel.channel_logo_url}
                                    watermarkPosition={currentChannel.watermark_position}
                                    watermarkSize={currentChannel.watermark_size}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={handleEndedA}
                                    onToggleFullscreen={toggleFullscreen}
                                    isFullscreen={isFullscreen}
                                />
                                <PlayerSlot
                                    id="B"
                                    active={activeSlot === "B"}
                                    content={slotB}
                                    tiktokUrl={tiktokB}
                                    channelThumb={currentChannel.channel_logo_url}
                                    watermarkPosition={currentChannel.watermark_position}
                                    watermarkSize={currentChannel.watermark_size}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={handleEndedB}
                                    onToggleFullscreen={toggleFullscreen}
                                    isFullscreen={isFullscreen}
                                />

                                {/* Live Badge + Mini-Player button */}
                                <div className="absolute top-6 right-6 z-50 flex flex-row-reverse items-center gap-2 transition-all">
                                    <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider text-white animate-pulse pointer-events-none">
                                        <div className="w-2 h-2 bg-white rounded-full" /> AO VIVO
                                    </div>
                                    <div className="bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-medium text-white/90 pointer-events-none">
                                        {isAdMode ? "INTERVALO" : "24h Online"}
                                    </div>
                                    {!isPiP && typeof window !== "undefined" && "documentPictureInPicture" in window && 
                                     !(activeSlot === "A" ? slotA?.url : slotB?.url)?.includes("youtu") && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleMiniPlayer();
                                            }}
                                            className="p-1.5 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-white/20 transition-colors border border-white/10 cursor-pointer"
                                            title="Mini-Player"
                                        >
                                            <PictureInPicture className="w-4 h-4 text-white" />
                                        </button>
                                    )}
                                </div>

                                {/* Periodic Title Badge */}

                            </>
                        )}
                    </div>
                </div>

                {/* Info + EPG */}
                <div className="mt-8 mb-16 w-full max-w-7xl mx-auto px-4 md:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Now Playing */}
                        <div className="lg:col-span-4 flex flex-col">
                            <div className="bg-zinc-800/80 backdrop-blur-xl border border-zinc-700/50 p-6 rounded-2xl shadow-2xl">
                                <span className="inline-block px-2 py-0.5 bg-primary/20 text-primary text-[9px] font-bold rounded mb-3 border border-primary/30 uppercase tracking-tighter italic">
                                    O que estás a ver
                                </span>
                                <div className="flex items-center justify-between mb-2 overflow-hidden">
                                    <div className="flex-1 overflow-hidden mr-4">
                                        <h2 className="text-xl font-bold text-white leading-tight whitespace-nowrap animate-marquee hover:pause-animation">
                                            {isAdMode ? "Intervalo Comercial" : (nowPlayingTitle || currentChannel?.title)}
                                        </h2>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            if (currentChannel) {
                                                localStorage.removeItem(`tv_progression_${currentChannel.id}`);
                                                window.location.reload();
                                            }
                                        }}
                                        className="p-1.5 rounded-lg bg-zinc-700/50 hover:bg-zinc-600/50 transition-colors border border-white/5 group"
                                        title="Sincronizar Programação"
                                    >
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 group-hover:text-white uppercase tracking-wider">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                            Sincronizar
                                        </div>
                                    </button>
                                </div>
                                {!isAdMode && activeSlotRef.current === "A" && slotA?.description && (
                                    <p className="text-xs text-zinc-400 mb-2 line-clamp-3">
                                        {slotA.description}
                                    </p>
                                )}
                                {!isAdMode && activeSlotRef.current === "B" && slotB?.description && (
                                    <p className="text-xs text-zinc-400 mb-2 line-clamp-3">
                                        {slotB.description}
                                    </p>
                                )}
                                <div className="mt-6 flex flex-col gap-2">
                                    <div className="flex justify-between items-end text-[10px] font-medium text-zinc-400 mb-1">
                                        <span>Emissão</span>
                                        <span className="text-primary font-black tracking-tight">{getRemainingTime()}</span>
                                    </div>
                                    <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-[1px] border border-zinc-800">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full transition-all duration-1000"
                                            style={{ width: `${realDuration ? (realTime / realDuration) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* EPG */}
                        <div className="lg:col-span-8 flex flex-col gap-4">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                        Programação de Hoje
                                    </span>
                                </div>
                                <button 
                                    onClick={handleRefresh}
                                    title="Atualizar Programação"
                                    className="p-1 hover:bg-white/10 rounded-full transition-colors text-zinc-500 hover:text-primary"
                                >
                                    <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            <div className="flex overflow-x-auto md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4 md:pb-0 scrollbar-hide snap-x">
                                {getUpcomingPrograms().map((prog, idx) => (
                                    <div key={idx} className="min-w-[280px] md:min-w-0 bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-2xl group hover:border-primary/50 transition-colors snap-center">
                                        <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                                            {idx === 0 ? "Próximo" : "A seguir"}
                                        </span>
                                        <div className="overflow-hidden mt-2">
                                            <h3 className="text-sm font-bold text-zinc-300 whitespace-nowrap animate-marquee group-hover:text-white hover:pause-animation">
                                                {prog.title}
                                            </h3>
                                        </div>
                                        {prog.duration && (
                                            <span className="text-[10px] text-zinc-500 mt-1 block">
                                                {Math.floor(prog.duration / 60)} min
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-7xl mx-auto px-4 md:px-8 relative group/channels">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <Tv className="w-6 h-6 text-primary" />
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Explorar Canais</h2>
                        </div>
                        
                        {/* Desktop Navigation Arrows */}
                        <div className="hidden md:flex items-center gap-2">
                            <button 
                                onClick={() => scrollChannels("left")}
                                className="p-2 rounded-full bg-zinc-800/50 hover:bg-primary/20 border border-white/5 transition-all text-zinc-400 hover:text-primary"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => scrollChannels("right")}
                                className="p-2 rounded-full bg-zinc-800/50 hover:bg-primary/20 border border-white/5 transition-all text-zinc-400 hover:text-primary"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div 
                        ref={channelListRef}
                        className="flex overflow-x-auto gap-6 pb-6 md:pb-2 scrollbar-hide snap-x scroll-smooth"
                    >
                        {contents.map((channel) => (
                            <div
                                key={channel.id}
                                className={`flex-none w-[160px] md:w-[200px] aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer group relative border-2 snap-start transition-all ${
                                    currentChannel?.id === channel.id
                                        ? "border-primary shadow-[0_0_20px_rgba(229,9,20,0.3)]"
                                        : "border-zinc-800/50"
                                }`}
                                onClick={() => handleChannelClick(channel)}
                            >
                                <img
                                    src={channel.thumbnail_url}
                                    alt={channel.title}
                                    className="w-full h-full object-contain bg-zinc-900 p-4 group-hover:scale-110 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs font-bold text-white truncate">{channel.title}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
            {/* APK Warning Modal */}
            {showApkWarning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-500">
                    <div className="bg-[#151515] border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl scale-in-center overflow-hidden relative">
                        {/* Background Decoration */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                        
                        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
                            <Tv className="w-10 h-10 text-primary" />
                        </div>
                        
                        <h2 className="text-2xl font-black text-white mb-4">Aviso de Compatibilidade</h2>
                        
                        <p className="text-gray-400 text-sm leading-relaxed mb-8">
                            Esta página ainda não está 100% funcional para aplicativos. 
                            Alguns canais (como links do TikTok) não vão aparecer corretamente aqui.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <Button 
                                onClick={handleAdvanceToWeb}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl"
                            >
                                Avançar para o Site Web
                            </Button>
                            
                            <Button 
                                variant="ghost"
                                onClick={() => setShowApkWarning(false)}
                                className="text-gray-500 hover:text-white"
                            >
                                Continuar no App mesmo assim
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .scale-in-center {
                    animation: scale-in-center 0.5s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
                }
                @keyframes scale-in-center {
                    0% { transform: scale(0); opacity: 1; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
            `}} />
        </div>
    );
}
