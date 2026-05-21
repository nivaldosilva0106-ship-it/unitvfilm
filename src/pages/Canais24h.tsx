import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { getAllContents, addToMyList, removeFromMyList, getMyList } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content, Episode } from "@/types/content";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { Loader2, Film, Tv, Clock, RefreshCw, ChevronLeft, ChevronRight, Heart, ThumbsUp, ThumbsDown, Bell, BellRing } from "lucide-react";
import { useReminders } from "@/hooks/useReminders";
import { getBaseUrl } from "@/lib/api";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useAuth } from "@/contexts/AuthContext";
import { useSpatialNavigation, FOCUSABLE_CLASS } from "@/hooks/useSpatialNavigation";

import { Volume2, VolumeX, Maximize, Minimize, Play, Pause, SkipBack, SkipForward, PictureInPicture } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Capacitor } from "@capacitor/core";

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

const YouTubePlayer = memo(({ videoId, id, startTime, active, onTimeUpdate, onEnded, playbackSpeed, onToggleFullscreen, isFullscreen, title, watermarkUrl, watermarkPosition, watermarkSize, mobileWatermarkPosition, mobileWatermarkSize }: {
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
    mobileWatermarkPosition?: string;
    mobileWatermarkSize?: number;
}) => {
    const playerRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<any>(null);
    const lastTimeRef = useRef<number>(0);
    const stuckCountRef = useRef<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('unitv-player-volume');
            return saved !== null ? parseFloat(saved) * 100 : 100;
        }
        return 100;
    });
    const [showControls, setShowControls] = useState(false);
    const [currentTime, setCurrentTime] = useState(startTime || 0);
    const [duration, setDuration] = useState(0);
    
    const [isMobile] = useState(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768);
    const [showInitialOverlay, setShowInitialOverlay] = useState(true);
    
    useEffect(() => {
        if (isPlaying) {
            // Wait 3 seconds before hiding the "Connecting" overlay to hide YouTube UI elements
            const timer = setTimeout(() => setShowInitialOverlay(false), 3000);
            return () => clearTimeout(timer);
        } else {
            setShowInitialOverlay(true);
        }
    }, [isPlaying]);

    // Persist volume
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('unitv-player-volume', (volume / 100).toString());
        }
    }, [volume]);

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

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
        if (playerRef.current) {
            playerRef.current.setVolume(newVolume);
            if (newVolume === 0) {
                playerRef.current.mute();
            } else {
                playerRef.current.unMute();
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
                    origin: getBaseUrl(),
                    playsinline: 1,
                    enablejsapi: 1,
                    widget_referrer: getBaseUrl(),
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
                                    
                                    // Watchdog: Detect stuck video
                                    if (ct > 0 && ct === lastTimeRef.current) {
                                        stuckCountRef.current++;
                                        if (stuckCountRef.current > 8) { // Stuck for ~8 seconds
                                            console.warn("Watchdog: Video stuck at", ct, ". Skipping...");
                                            onEndedRef.current();
                                            return;
                                        }
                                    } else {
                                        stuckCountRef.current = 0;
                                    }
                                    lastTimeRef.current = ct;

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
                        console.warn("YouTube Player Error:", e.data);
                        setHasError(true);
                        setIsPlaying(false);
                        
                        // Error codes: 100 (not found/removed), 101/150 (embed restricted)
                        // If it's a critical error (like blocked video), auto-skip faster
                        if (activeRef.current) {
                            const delay = (e.data === 101 || e.data === 150) ? 1000 : 3000;
                            setTimeout(() => {
                                onEndedRef.current();
                            }, delay);
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
            className={`w-full h-full overflow-hidden relative bg-black group pointer-events-auto ${isFullscreen && !showControls ? 'cursor-none' : ''}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={triggerTogglePlay}
        >
            <div className={`absolute inset-[-15%] w-[130%] h-[130%] transition-opacity duration-700 pointer-events-none ${isPlaying && !hasError ? 'opacity-100' : 'opacity-0'}`}>
                <div id={`yt-${id}-${videoId}`} className="w-full h-full" />
            </div>
            
            {/* Catch clicks so they don't go to iframe */}
            <div className="absolute inset-0 z-10 pointer-events-none" />

            {/* Logo / Loading / Error Overlay - stays for 4s after isPlaying to hide YouTube UI */}
            {(showInitialOverlay || hasError) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-20 gap-6">
                    {watermarkUrl ? (
                        <div className="animate-pulse">
                            <img src={watermarkUrl} alt="Channel" className="h-16 md:h-32 w-auto object-contain filter drop-shadow-2xl" />
                        </div>
                    ) : (
                        <div className="w-16 h-16 border-4 border-white/20 border-t-primary rounded-full animate-spin" />
                    )}
                    <p className="text-white/70 font-bold text-xs md:text-sm animate-pulse tracking-[0.2em] uppercase px-4 text-center">
                        {hasError ? "Conteúdo Indisponível. A saltar..." : "A ligar à emissão..."}
                    </p>
                    {!hasError && <p className="text-white/30 text-[10px] uppercase tracking-[0.2em]">Canais24h Premium</p>}
                </div>
            )}

            {watermarkUrl && isPlaying && !hasError && (
                <div className={`absolute ${getWatermarkClasses(isMobile ? (mobileWatermarkPosition || watermarkPosition) : watermarkPosition)} z-[35] pointer-events-none select-none transition-all duration-300 opacity-70`}>
                    <img 
                        src={watermarkUrl} 
                        alt="Watermark" 
                        style={{ height: `${((isMobile ? (mobileWatermarkSize || watermarkSize) : watermarkSize) || 8) * 4}px` }}
                        className="w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" 
                    />
                </div>
            )}
            
            {(!isPlaying && !hasError && !showInitialOverlay) && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-black pointer-events-none">
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
                             <button onClick={triggerTogglePlay} type="button" className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto">
                                 {isPlaying ? <Pause className="w-4 h-4 md:w-6 md:h-6 text-white fill-white" /> : <Play className="w-4 h-4 md:w-6 md:h-6 text-white fill-white ml-0.5" />}
                             </button>
                             <div className="flex items-center gap-1 md:gap-2">
                                  <button onClick={triggerToggleMute} type="button" className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto">
                                      {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 md:w-5 md:h-5 text-white" /> : <Volume2 className="w-4 h-4 md:w-5 md:h-5 text-white" />}
                                  </button>
                                  <div className="w-16 md:w-20" onClick={(e) => e.stopPropagation()}>
                                      <Slider
                                          value={[isMuted ? 0 : volume]}
                                          min={0}
                                          max={100}
                                          step={1}
                                          onValueChange={handleVolumeChange}
                                          className="cursor-pointer [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-white/30 [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:bg-white"
                                      />
                                  </div>
                             </div>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">


                            {onToggleFullscreen && (
                                <button onClick={onToggleFullscreen} type="button" className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors pointer-events-auto">
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

const SocialPlayer = memo(({ url, active, onTimeUpdate, onEnded, onToggleFullscreen, isFullscreen, title, watermarkUrl, watermarkPosition, watermarkSize, mobileWatermarkPosition, mobileWatermarkSize }: {
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
    mobileWatermarkPosition?: string;
    mobileWatermarkSize?: number;
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(active);
    const [isMuted, setIsMuted] = useState(true);
    const [isMobile] = useState(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768);
    const [volume, setVolume] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('unitv-player-volume');
            return saved !== null ? parseFloat(saved) : 1;
        }
        return 1;
    });
    const [showControls, setShowControls] = useState(false);
    const playerRef = useRef<any>(null);

    // Persist volume
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('unitv-player-volume', volume.toString());
        }
    }, [volume]);

    // Safeguard against missing URL
    if (!url) {
        return (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                <p className="text-zinc-500 text-sm">URL indisponível</p>
            </div>
        );
    }




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

    const handleVolumeChange = (value: number[]) => {
        const newVolume = value[0];
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
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
                className={`w-full h-full relative group ${isFullscreen && !showControls ? 'cursor-none' : ''}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => isPlaying && setShowControls(false)}
                onClick={togglePlay}
            >
                {/* Watermark Logo Overlay */}
                {watermarkUrl && (
                    <div className={`absolute ${getWatermarkClasses(isMobile ? (mobileWatermarkPosition || watermarkPosition) : watermarkPosition)} z-[35] pointer-events-none select-none transition-all duration-300 opacity-70`}>
                        <img 
                            src={watermarkUrl} 
                            alt="Watermark" 
                            style={{ height: `${((isMobile ? (mobileWatermarkSize || watermarkSize) : watermarkSize) || 8) * 4}px` }}
                            className="w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" 
                        />
                    </div>
                )}

            {url?.includes('facebook.com') || url?.includes('fb.watch') ? (
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
                                  <div className="w-16 md:w-20" onClick={(e) => e.stopPropagation()}>
                                      <Slider
                                          value={[isMuted ? 0 : volume]}
                                          min={0}
                                          max={1}
                                          step={0.01}
                                          onValueChange={handleVolumeChange}
                                          className="cursor-pointer [&_[data-radix-slider-track]]:h-1 [&_[data-radix-slider-track]]:bg-white/30 [&_[data-radix-slider-range]]:bg-primary [&_[data-radix-slider-thumb]]:w-3 [&_[data-radix-slider-thumb]]:h-3 [&_[data-radix-slider-thumb]]:bg-white"
                                      />
                                  </div>
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
const PlayerSlot = memo(({ id, content, tiktokUrl, active, channelThumb, watermarkPosition, watermarkSize, mobileWatermarkPosition, mobileWatermarkSize, onTimeUpdate, onEnded, onToggleFullscreen, isFullscreen, isLiteMode }: {
    id: string;
    content: QueueItem | null;
    tiktokUrl: string | null;
    active: boolean;
    channelThumb?: string;
    watermarkPosition?: string;
    watermarkSize?: number;
    mobileWatermarkPosition?: string;
    mobileWatermarkSize?: number;
    onTimeUpdate?: (time: number, duration?: number) => void;
    onEnded?: () => void;
    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
    isLiteMode?: boolean;
}) => {
    const [isMobile] = useState(() => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768);

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
        <div className={`absolute inset-0 w-full h-full ${isLiteMode ? "" : "transition-opacity duration-700 ease-in-out"} ${active ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}>
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
                    mobileWatermarkPosition={mobileWatermarkPosition}
                    mobileWatermarkSize={mobileWatermarkSize}
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
                    mobileWatermarkPosition={mobileWatermarkPosition}
                    mobileWatermarkSize={mobileWatermarkSize}
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
                    watermarkPosition={isMobile ? (mobileWatermarkPosition || watermarkPosition) : watermarkPosition}
                    watermarkSize={isMobile ? (mobileWatermarkSize || watermarkSize) : watermarkSize}
                    initialAspect="cover"
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
    // Initialize TV Spatial Navigation
    const navigate = useNavigate();
    useSpatialNavigation({ 
        enabled: true,
        onBack: () => {
            if (showApkWarning) {
                setShowApkWarning(false);
            } else if (isFullscreen) {
                toggleFullscreen();
            } else {
                navigate("/");
            }
        }
    });

    const [searchParams] = useSearchParams();
    const initialChannelId = searchParams.get("channelId");
    const { isLiteMode } = useAppConfig();
    const { reminders, addReminder, removeReminder } = useReminders();

    const [contents, setContents] = useState<Content[]>([]);
    const [currentChannel, setCurrentChannel] = useState<Content | null>(null);
    const [loading, setLoading] = useState(true);
    const [showApkWarning, setShowApkWarning] = useState(false);

    const { user, currentProfile } = useAuth();
    const [myListId, setMyListId] = useState<string | null>(null);
    const [isInMyList, setIsInMyList] = useState(false);

    useEffect(() => {
        if (!currentProfile || !currentChannel) return;
        
        let isMounted = true;
        const checkMyList = async () => {
            try {
                const list = await getMyList(currentProfile.id);
                if (!isMounted) return;
                
                const listItem = list.find(item => item.contentId === currentChannel.id);
                if (listItem) {
                    setIsInMyList(true);
                    setMyListId(listItem.id);
                } else {
                    setIsInMyList(false);
                    setMyListId(null);
                }
            } catch (err) {
                console.error("Error checking my list:", err);
            }
        };
        
        checkMyList();
        return () => { isMounted = false; };
    }, [currentProfile, currentChannel]);

    const handleFavorite = async () => {
        if (!currentProfile) {
            toast.error("Precisas iniciar sessão para adicionar aos favoritos");
            return;
        }
        if (!currentChannel) return;
        
        try {
            if (isInMyList && myListId) {
                await removeFromMyList(currentProfile.id, myListId);
                setIsInMyList(false);
                setMyListId(null);
                toast.success("Canal removido da tua lista");
            } else {
                const newItem = await addToMyList(currentProfile.id, currentChannel);
                setIsInMyList(true);
                setMyListId(newItem.id);
                toast.success("Canal adicionado à tua lista");
            }
        } catch (error) {
            console.error("Error handling favorite:", error);
            toast.error("Erro ao atualizar favoritos");
        }
    };

    const [likes, setLikes] = useState<Record<string, { count: number, status: 'like'|'dislike'|null }>>({});

    useEffect(() => {
        const stored = localStorage.getItem('unitv_channel_likes');
        if (stored) {
            try { setLikes(JSON.parse(stored)); } catch(e){}
        }
    }, []);

    const getInitialLikes = (id: string) => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return Math.abs(hash) % 1000 + 150; 
    };

    const handleInteraction = (type: 'like'|'dislike') => {
        if (!currentChannel) return;
        setLikes(prev => {
            const current = prev[currentChannel.id] || { count: getInitialLikes(currentChannel.id), status: null };
            let newStatus = current.status;
            let newCount = current.count;

            if (type === 'like') {
                if (current.status === 'like') {
                    newStatus = null;
                    newCount--;
                } else {
                    newStatus = 'like';
                    newCount += current.status === 'dislike' ? 2 : 1;
                }
            } else {
                if (current.status === 'dislike') {
                    newStatus = null;
                    newCount++;
                } else {
                    newStatus = 'dislike';
                    newCount -= current.status === 'like' ? 2 : 1;
                }
            }
            
            const next = { ...prev, [currentChannel.id]: { count: newCount, status: newStatus } };
            localStorage.setItem('unitv_channel_likes', JSON.stringify(next));
            return next;
        });
    };

    const currentChannelLikes = currentChannel ? (likes[currentChannel.id] || { count: getInitialLikes(currentChannel.id), status: null }) : { count: 0, status: null };

    // Detect Capacitor (APK)
    useEffect(() => {
        const checkApk = () => {
            if (Capacitor.isNativePlatform()) {
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
        const eps = (currentChannel?.episodes || []).filter(Boolean);
        if (eps.length === 0 && currentChannel) {
            const mainUrl = currentChannel.internal_player_url || currentChannel.video_url || currentChannel.main_video_id || "";
            if (mainUrl) {
                return [{
                    title: currentChannel.title,
                    url: mainUrl,
                    internal_player_url: mainUrl,
                    season: 1,
                    episode: 1,
                    duration: 86400 * 365, // 1 year duration
                    playback_speed: 1
                } as Episode];
            }
        }
        return eps;
    }, [currentChannel]);
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
                let canais = all.filter((c) => c.category === "canais24h");
                
                // Shuffle channels so they appear in a random order on refresh
                canais = canais.sort(() => Math.random() - 0.5);
                
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

    // ---- 3. Get initial program index from global time (DETERMINISTIC — same on all devices) ----
    const getInitialState = useCallback(() => {
        if (!currentChannel || programs.length === 0) return null;

        const GAP = 0; 
        
        // Deterministic mathematical scheduler based on real-time clock
        // All devices with synced clocks will calculate the EXACT same result
        const nowSec = Math.floor((Date.now() + serverOffsetRef.current) / 1000);
        const salt = (currentChannel.id || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
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

        // Helper to get next media link deterministically (based on time, not random)
        const nowSeed = Math.floor(Date.now() / 1000);
        const getSeeded = (list: any[], idx: number) => list[(idx + nowSeed) % list.length];
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
                const item = shuffleIntervals ? getSeeded(intervalList, breakIdx) : getLinear(intervalList, 0);
                return { url: item.url, startTime: 0, title: item.title || "Intervalo", type: "interval", programIndex: currentItem.programIndex, breakIndex: 1, programsSinceBreak: 0 };
            } else if (globAds > 0 && adList.length > 0) {
                const item = shuffleAds ? getSeeded(adList, breakIdx) : getLinear(adList, 0);
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
                const item = shuffleIntervals ? getSeeded(intervalList, breakIdx) : getLinear(intervalList, 0);
                return { url: item.url, startTime: 0, title: item.title || "Intervalo", type: "interval", programIndex: currentItem.programIndex, breakIndex: 1, programsSinceBreak: pSince };
            } else if (reqAds > 0 && adList.length > 0) {
                const item = shuffleAds ? getSeeded(adList, breakIdx) : getLinear(adList, 0);
                return { url: item.url, startTime: 0, title: item.title || "Publicidade", type: "ad", programIndex: currentItem.programIndex, breakIndex: 1, programsSinceBreak: pSince };
            }
        }

        // 3. Continue Interval Block
        if (currentItem.type === "interval") {
            const targetInt = freq > 0 ? globInt : ((programs[currentItem.programIndex] || programs[0])?.post_video_intervals || 0);
            const targetAds = freq > 0 ? globAds : ((programs[currentItem.programIndex] || programs[0])?.post_video_ads || 0);
            
            if (breakIdx < targetInt && intervalList.length > 0) {
                const item = shuffleIntervals ? getSeeded(intervalList, breakIdx) : getLinear(intervalList, breakIdx);
                return { url: item.url, startTime: 0, title: item.title || "Intervalo", type: "interval", programIndex: currentItem.programIndex, breakIndex: breakIdx + 1, programsSinceBreak: 0 };
            } else if (targetAds > 0 && adList.length > 0) {
                const item = shuffleAds ? getSeeded(adList, breakIdx) : getLinear(adList, 0);
                return { url: item.url, startTime: 0, title: item.title || "Publicidade", type: "ad", programIndex: currentItem.programIndex, breakIndex: 1, programsSinceBreak: 0 };
            } else if (freq > 0 && logoUrl) {
                return { url: logoUrl, startTime: 0, title: "Logo", type: "logo", programIndex: currentItem.programIndex, programsSinceBreak: 0 };
            }
        }

        // 4. Continue Ad Block
        if (currentItem.type === "ad") {
            const targetAds = freq > 0 ? globAds : ((programs[currentItem.programIndex] || programs[0])?.post_video_ads || 0);
            
            if (breakIdx < targetAds && adList.length > 0) {
                const item = shuffleAds ? getSeeded(adList, breakIdx) : getLinear(adList, breakIdx);
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

        console.log("[Canais24h] Initializing state for channel:", currentChannel?.id);
        const initial = getInitialState();
        if (!initial) {
            console.warn("[Canais24h] Could not calculate initial state for channel:", currentChannel?.id);
            setLoading(false);
            return;
        }

        console.log("[Canais24h] Current playing:", initial.item.title, "Type:", initial.item.type);
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
        setTiktokB(null);
        
        // --- SMART ROTATION INIT ---
        recentTitlesRef.current = [initial.item.title];
        consecutiveTitleCountRef.current = 0;

        loadTikTokForSlot(initial.item, "A");
        setLoading(false);
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
    
    const handleTimeUpdate = useCallback((time: number, duration?: number) => {
        if (time > 0) setRealTime(time);
        if (duration) setRealDuration(duration);

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

    const epgListRef = useRef<HTMLDivElement>(null);
    const scrollEpg = (direction: "left" | "right") => {
        if (!epgListRef.current) return;
        const scrollAmount = direction === "left" ? -300 : 300;
        epgListRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
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
        const upcoming: { prog: Episode, timeStr: string, startTime: number, endTime: number }[] = [];
        
        let currentRemainingSeconds = 0;
        let isTimePredictable = true;

        if (realDuration && realDuration > 0) {
            currentRemainingSeconds = Math.max(0, realDuration - realTime);
        } else {
            const currentProg = programs[idx % programs.length];
            if (currentProg && currentProg.duration && currentProg.duration > 0) {
                currentRemainingSeconds = Math.max(0, currentProg.duration - realTime);
            } else {
                isTimePredictable = false;
            }
        }
        
        let accumulatedSeconds = currentRemainingSeconds;

        for (let i = 1; i <= 15; i++) {
            const prog = programs[(idx + i) % programs.length];
            
            let timeStr = "Não Programado";
            let progStart = 0;
            let progEnd = 0;
            
            if (isTimePredictable) {
                const startDateMs = Date.now() + accumulatedSeconds * 1000;
                const startDate = new Date(startDateMs);
                timeStr = startDate.toLocaleTimeString('pt-AO', { 
                    timeZone: 'Africa/Luanda', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                progStart = startDateMs;
                
                if (!prog.duration || prog.duration <= 0) {
                    isTimePredictable = false;
                    progEnd = startDateMs + (2 * 60 * 60 * 1000); // 2 hours fallback
                } else {
                    progEnd = startDateMs + (prog.duration * 1000);
                    accumulatedSeconds += prog.duration;
                }
            }
            
            upcoming.push({ prog, timeStr, startTime: progStart, endTime: progEnd });
        }
        return upcoming;
    };

    // ---- Fullscreen management ----
    const toggleFullscreen = useCallback(async () => {
        if (!playerContainerRef.current) return;
        if (!document.fullscreenElement) {
            try {
                await playerContainerRef.current.requestFullscreen();
                // @ts-ignore
                if (window.screen?.orientation?.lock) {
                    // @ts-ignore
                    await window.screen.orientation.lock("landscape").catch(() => {});
                }
            } catch (err) {}
        } else {
            try {
                await document.exitFullscreen();
                // @ts-ignore
                if (window.screen?.orientation?.unlock) {
                    // @ts-ignore
                    window.screen.orientation.unlock();
                }
            } catch (err) {}
        }
    }, []);

    useEffect(() => {
        const onFSChange = () => {
            const isFS = !!document.fullscreenElement;
            setIsFullscreen(isFS);
            
            // Unlock orientation when exiting fullscreen
            // @ts-ignore
            if (!isFS && window.screen?.orientation?.unlock) {
                // @ts-ignore
                try { window.screen.orientation.unlock(); } catch (e) {}
            }
        };
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

    const isMarathon = useMemo(() => {
        const currentActive = activeSlot === "A" ? slotA : slotB;
        if (!currentActive || currentActive.type !== "program") return false;
        
        const idx = currentActive.programIndex;
        const currentProg = programs[idx];
        if (!currentProg) return false;
        
        const getBaseTitle = (t: string) => {
            let base = t || '';
            const lower = base.toLowerCase();
            base = base.replace(/temporada\s+\d+\s+(?:epis[oó]dio|ep\.?|cap[ií]tulo|cap\.?)\s+\d+/gi, '');
            base = base.replace(/t\d+\s*e\d+/gi, '');
            base = base.replace(/s\d+e\d+/gi, '');
            base = base.replace(/\d+x\d+/gi, '');
            base = base.replace(/(?:epis[oó]dio|ep\.?|cap[ií]tulo|cap\.?)\s+(\d+)(?:\/\d+)?/gi, '');
            base = base.replace(/temporada\s+\d+/gi, '');
            base = base.replace(/parte\s+\d+/gi, '');
            base = base.replace(/[\s\-:_\d\/]+$/g, '').trim();
            return base || t;
        };

        const baseTitle = getBaseTitle(currentProg.title);
        
        const prevProg = programs[idx - 1];
        const nextProg = programs[idx + 1];
        
        const isPrevSame = prevProg && getBaseTitle(prevProg.title) === baseTitle;
        const isNextSame = nextProg && getBaseTitle(nextProg.title) === baseTitle;
        
        return isPrevSame || isNextSame;
    }, [activeSlot, slotA, slotB, programs]);

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
                        className={`relative w-full bg-black overflow-hidden shadow-2xl group/container ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none !max-w-none h-screen w-screen flex flex-col justify-center' : 'rounded-lg aspect-video'}`}
                    >
                        {loading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
                                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                <span>A carregar canal...</span>
                            </div>
                        ) : !currentChannel ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black">
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
                                    mobileWatermarkPosition={currentChannel.mobile_watermark_position}
                                    mobileWatermarkSize={currentChannel.mobile_watermark_size}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={handleEndedA}
                                    onToggleFullscreen={toggleFullscreen}
                                    isFullscreen={isFullscreen}
                                    isLiteMode={isLiteMode}
                                />
                                <PlayerSlot
                                    id="B"
                                    active={activeSlot === "B"}
                                    content={slotB}
                                    tiktokUrl={tiktokB}
                                    channelThumb={currentChannel.channel_logo_url}
                                    watermarkPosition={currentChannel.watermark_position}
                                    watermarkSize={currentChannel.watermark_size}
                                    mobileWatermarkPosition={currentChannel.mobile_watermark_position}
                                    mobileWatermarkSize={currentChannel.mobile_watermark_size}
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={handleEndedB}
                                    onToggleFullscreen={toggleFullscreen}
                                    isFullscreen={isFullscreen}
                                    isLiteMode={isLiteMode}
                                />

                                {isMarathon && !isAdMode && (
                                    <div className="absolute top-4 left-4 md:top-6 md:left-6 z-50 pointer-events-none animate-in fade-in duration-500">
                                        <div className="bg-red-600/90 backdrop-blur-sm text-white px-3 py-1 rounded-md text-[10px] md:text-xs font-black tracking-widest uppercase shadow-[0_0_15px_rgba(220,38,38,0.5)] border border-red-500/30">
                                            Maratona
                                        </div>
                                    </div>
                                )}

                                {/* Live Badge + Mini-Player button */}
                                <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50 flex flex-row-reverse items-center gap-2 transition-all">
                                    <div className="flex items-center gap-1 bg-red-600/90 backdrop-blur-sm px-2 py-0.5 md:px-2.5 md:py-1 rounded text-[9px] md:text-[11px] font-bold uppercase tracking-wider text-white animate-pulse pointer-events-none">
                                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full" /> AO VIVO
                                    </div>
                                    <div className="bg-black/40 backdrop-blur-sm px-2 py-0.5 md:px-2.5 md:py-1 rounded text-[9px] md:text-[11px] font-medium text-white/90 pointer-events-none">
                                        {isAdMode ? "INTERVALO" : "24h Online"}
                                    </div>
                                    {!isPiP && typeof window !== "undefined" && "documentPictureInPicture" in window && 
                                     !(activeSlot === "A" ? slotA?.url : slotB?.url)?.includes("youtu") && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleMiniPlayer();
                                            }}
                                            className={`p-1.5 rounded-lg bg-black/50 backdrop-blur-sm hover:bg-white/20 transition-colors border border-white/10 cursor-pointer ${FOCUSABLE_CLASS}`}
                                            title="Mini-Player"
                                        >
                                            <PictureInPicture className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" />
                                        </button>
                                    )}
                                </div>
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
                                            window.location.reload();
                                        }}
                                        className={`p-1.5 rounded-lg bg-zinc-700/50 hover:bg-zinc-600/50 transition-colors border border-white/5 group ${FOCUSABLE_CLASS}`}
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
                        <div className="lg:col-span-8 flex flex-col gap-4 relative group/epg">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                        Programação de Hoje
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="hidden md:flex items-center gap-1">
                                        <button 
                                            onClick={() => scrollEpg("left")}
                                            className={`p-1.5 rounded-full bg-zinc-800/50 hover:bg-primary/20 border border-white/5 transition-all text-zinc-400 hover:text-primary ${FOCUSABLE_CLASS}`}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={() => scrollEpg("right")}
                                            className={`p-1.5 rounded-full bg-zinc-800/50 hover:bg-primary/20 border border-white/5 transition-all text-zinc-400 hover:text-primary ${FOCUSABLE_CLASS}`}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <button 
                                        onClick={handleRefresh}
                                        title="Atualizar Programação"
                                        className={`p-1.5 hover:bg-white/10 rounded-full transition-colors text-zinc-500 hover:text-primary ${FOCUSABLE_CLASS}`}
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>
                            <div 
                                ref={epgListRef}
                                className="flex overflow-x-auto gap-4 pb-4 md:pb-2 scrollbar-hide snap-x scroll-smooth"
                            >
                                {getUpcomingPrograms().map(({ prog, timeStr, startTime, endTime }, idx) => {
                                    if (!prog) return null;
                                    
                                    const existingReminder = reminders.find(r => 
                                        r.channelId === currentChannel?.id && 
                                        r.programTitle === prog.title && 
                                        Math.abs(r.startTime - startTime) < 60000 
                                    );
                                    
                                    const hasReminder = !!existingReminder;
                                    const canRemind = timeStr !== "Não Programado" && startTime > 0;

                                    return (
                                        <div key={idx} className="min-w-[240px] md:min-w-[280px] flex-none bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-2xl group hover:border-primary/50 transition-colors snap-start flex flex-col justify-between relative">
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                                                        {idx === 0 ? "Próximo" : "A seguir"}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded-md flex items-center gap-1 border border-white/5 shadow-inner">
                                                        <Clock className="w-3 h-3 text-zinc-500" />
                                                        {timeStr}
                                                    </span>
                                                </div>
                                                <div className="overflow-hidden pr-8">
                                                    <h3 className="text-sm font-bold text-zinc-300 whitespace-nowrap animate-marquee group-hover:text-white hover:pause-animation">
                                                        {prog.title || "Sem Título"}
                                                    </h3>
                                                </div>
                                            </div>
                                            {prog.duration && (
                                                <span className="text-[10px] text-zinc-500 mt-2 block">
                                                    {Math.floor(prog.duration / 60)} min
                                                </span>
                                            )}

                                            {/* Reminder Bell */}
                                            {canRemind && (
                                                <button
                                                    onClick={() => {
                                                        if (hasReminder && existingReminder) {
                                                            removeReminder(existingReminder.id);
                                                            toast.success("Lembrete removido.");
                                                        } else {
                                                            const newId = `${currentChannel?.id}-${prog.title}-${Date.now()}`;
                                                            addReminder({
                                                                id: newId,
                                                                channelId: currentChannel?.id || "",
                                                                channelTitle: currentChannel?.title || "",
                                                                programTitle: prog.title || "Programa",
                                                                startTime,
                                                                endTime
                                                            });
                                                            toast.success(`Lembrete definido para ${timeStr}`);
                                                        }
                                                    }}
                                                    className={`absolute right-4 bottom-4 p-2 rounded-xl transition-colors ${
                                                        hasReminder 
                                                        ? "bg-green-500 text-white shadow-lg shadow-green-500/30" 
                                                        : "bg-zinc-800/80 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                                                    } ${FOCUSABLE_CLASS}`}
                                                    title={hasReminder ? "Remover Lembrete" : "Avisar-me quando começar"}
                                                >
                                                    {hasReminder ? <BellRing className="w-4 h-4 animate-pulse" /> : <Bell className="w-4 h-4" />}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Interactive Channel Bar */}
                <div className="w-full max-w-7xl mx-auto px-4 md:px-8 mb-12">
                    <div className="flex flex-col sm:flex-row items-center justify-between bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/80 p-4 rounded-2xl shadow-xl">
                        {/* Channel Info */}
                        <div className="flex items-center gap-4 mb-4 sm:mb-0 w-full sm:w-auto">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-950 flex-shrink-0 flex items-center justify-center p-1 border border-white/5">
                                <img 
                                    src={currentChannel?.channel_logo_url || '/placeholder.png'} 
                                    alt="Logo" 
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <div className="flex flex-col flex-1 overflow-hidden">
                                <span className="text-[10px] uppercase font-black text-zinc-500 tracking-wider">Canal Atual</span>
                                <h3 className="text-base font-bold text-white truncate">{currentChannel?.title || 'Sem Título'}</h3>
                            </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                            <div className="flex items-center bg-zinc-950/80 rounded-xl border border-white/5 overflow-hidden">
                                <button 
                                    onClick={() => handleInteraction('like')} 
                                    className={`flex items-center gap-1.5 px-4 py-2.5 hover:bg-white/10 transition-colors ${currentChannelLikes.status === 'like' ? 'text-primary' : 'text-zinc-400 hover:text-white'} ${FOCUSABLE_CLASS}`}
                                    title="Gostar"
                                >
                                    <ThumbsUp className={`w-4 h-4 ${currentChannelLikes.status === 'like' ? 'fill-primary' : ''}`} />
                                    <span className="text-xs font-bold">{currentChannelLikes.count}</span>
                                </button>
                                <div className="w-[1px] h-4 bg-white/10" />
                                <button 
                                    onClick={() => handleInteraction('dislike')} 
                                    className={`flex items-center gap-1.5 px-4 py-2.5 hover:bg-white/10 transition-colors ${currentChannelLikes.status === 'dislike' ? 'text-white' : 'text-zinc-400 hover:text-white'} ${FOCUSABLE_CLASS}`}
                                    title="Não Gostar"
                                >
                                    <ThumbsDown className={`w-4 h-4 ${currentChannelLikes.status === 'dislike' ? 'fill-white' : ''}`} />
                                </button>
                            </div>
                            <button 
                                onClick={handleFavorite}
                                className={`p-3 rounded-xl bg-zinc-950/80 border border-white/5 hover:border-primary/50 hover:bg-primary/10 transition-all group flex items-center justify-center ${isInMyList ? 'text-primary' : 'text-zinc-400 hover:text-primary'} ${FOCUSABLE_CLASS}`}
                                title={isInMyList ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
                            >
                                <Heart className={`w-5 h-5 group-hover:scale-110 transition-transform ${isInMyList ? 'fill-primary' : ''}`} />
                            </button>
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
                                className={`p-2 rounded-full bg-zinc-800/50 hover:bg-primary/20 border border-white/5 transition-all text-zinc-400 hover:text-primary ${FOCUSABLE_CLASS}`}
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => scrollChannels("right")}
                                className={`p-2 rounded-full bg-zinc-800/50 hover:bg-primary/20 border border-white/5 transition-all text-zinc-400 hover:text-primary ${FOCUSABLE_CLASS}`}
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
                                tabIndex={0}
                                className={`flex-none w-[160px] md:w-[200px] aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer group relative border-2 snap-start transition-all ${FOCUSABLE_CLASS} ${
                                    currentChannel?.id === channel.id
                                        ? "border-primary shadow-[0_0_20px_rgba(229,9,20,0.3)]"
                                        : "border-zinc-800/50"
                                }`}
                                onClick={() => handleChannelClick(channel)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleChannelClick(channel);
                                }}
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
                            A tecnologia de alguns canais externos pode exibir anúncios ao clicar e te redirecionar para outras páginas. 
                            Basta fechar as abas que abrirem e continuares a clicar que o canal vai carregar e apresentar.
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <Button 
                                onClick={() => setShowApkWarning(false)}
                                className={`bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 rounded-xl ${FOCUSABLE_CLASS}`}
                            >
                                Assistir mesmo assim
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
