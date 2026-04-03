import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import { getAllContents } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content, Episode } from "@/types/content";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { Loader2, Film, Tv, Clock } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { Volume2, VolumeX, Maximize, Minimize, Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Slider } from "@/components/ui/slider";

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

// ============================================================
// YOUTUBE PLAYER — STABLE. Only recreates when videoId changes.
// Uses refs for callbacks to prevent iframe destruction loops.
// ============================================================
const YouTubePlayer = memo(({ videoId, id, startTime, active, playbackSpeed, onTimeUpdate, onEnded, onToggleFullscreen, isFullscreen, title }: {
    videoId: string;
    id: string;
    startTime: number;
    active: boolean;
    playbackSpeed?: number;
    onTimeUpdate: (time: number, duration?: number) => void;
    onEnded: () => void;
    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
    title?: string;
}) => {
    const playerRef = useRef<any>(null);
    const intervalRef = useRef<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);
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
                    onStateChange: (e: any) => {
                        if (destroyed) return;
                        const YTState = window.YT.PlayerState;
                        if (e.data === YTState.PLAYING) {
                            setIsPlaying(true);
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

    // Mute/unmute based on active state (does NOT recreate iframe)
    useEffect(() => {
        try {
            if (!playerRef.current) return;
            if (active) {
                playerRef.current.unMute();
                playerRef.current.setVolume(100);
                // Ensure playing
                if (playerRef.current.getPlayerState?.() !== 1) {
                    playerRef.current.playVideo();
                }
            } else {
                playerRef.current.mute();
            }
        } catch {}
    }, [active]);

    return (
        <div 
            className="w-full h-full overflow-hidden relative bg-black group"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={triggerTogglePlay}
        >
            {/* Scaled iframe to crop YouTube branding */}
            <div className="absolute inset-[-15%] w-[130%] h-[130%]">
                <div id={`yt-${id}-${videoId}`} className="w-full h-full" />
            </div>
            
            {/* Transparent overlay blocks ALL native YouTube UI clicks */}
            <div className="absolute inset-0 z-20 pointer-events-none" />

            {/* Loading spinner until YouTube starts playing */}
            {!isPlaying && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-20 gap-4">
                    <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
                    <p className="text-white font-medium text-xs md:text-sm animate-pulse tracking-wide px-4 text-center">
                        Aguarde, estamos a estabelecer a ligação da rede...
                    </p>
                </div>
            )}
            
            {/* Center Play Button (when paused) */}
            {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                    <button 
                        onClick={triggerTogglePlay}
                        className="w-14 h-14 md:w-20 md:h-20 bg-primary/90 hover:bg-primary rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 shadow-2xl"
                    >
                        <Play className="w-6 h-6 md:w-10 md:h-10 text-white fill-white ml-1" />
                    </button>
                </div>
            )}

            {/* UI Custom Overlay (Identical to VideoPlayer) */}
            <div 
                className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 z-30 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
                
                {title && (
                    <div className="absolute top-4 left-4 right-4 z-40">
                        <h2 className="text-white font-bold text-sm md:text-lg drop-shadow-lg line-clamp-1">{title}</h2>
                    </div>
                )}
                
                <div className="relative p-3 md:p-4 space-y-2 md:space-y-3 z-40">
                    {/* Progress bar removed for better TV experience */}

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
                        {onToggleFullscreen && (
                             <button onClick={onToggleFullscreen} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                                  {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5 text-white" /> : <Maximize className="w-4 h-4 md:w-5 md:h-5 text-white" />}
                             </button>
                        )}
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

const SocialPlayer = memo(({ url, active, onTimeUpdate, onEnded, onToggleFullscreen, isFullscreen, title }: {
    url: string;
    active: boolean;
    onTimeUpdate: (time: number, duration?: number) => void;
    onEnded: () => void;
    onToggleFullscreen?: () => void;
    isFullscreen?: boolean;
    title?: string;
}) => {
    // Normalize Facebook Reels URLs to standard Video URLs
    const normalizedUrl = useMemo(() => {
        let u = url;
        // Match /reel/XXXX or /videos/XXXX or ?v=XXXX
        if (u.includes('facebook.com/reel/')) {
            const reelMatch = u.match(/facebook\.com\/reel\/(\d+)/);
            if (reelMatch && reelMatch[1]) {
                u = `https://www.facebook.com/facebook/videos/${reelMatch[1]}/`;
            }
        }
        return u;
    }, [url]);

    const [isPlaying, setIsPlaying] = useState(active);
    const [isMuted, setIsMuted] = useState(!active);
    const [volume, setVolume] = useState(1);
    const [showControls, setShowControls] = useState(false);
    const playerRef = useRef<any>(null);

    // Sync active state with player state
    useEffect(() => {
        setIsPlaying(active);
        setIsMuted(!active);
    }, [active]);

    const handleProgress = (state: { playedSeconds: number; loadedSeconds: number }) => {
        if (active) {
            onTimeUpdate(state.playedSeconds);
        }
    };

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
            className="w-full h-full bg-black relative group overflow-hidden"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={togglePlay}
        >
            {url.includes('facebook.com') || url.includes('fb.watch') ? (
                <iframe
                    src={`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&t=0&autoplay=${active ? 1 : 0}&mute=${isMuted ? 1 : 0}`}
                    width="100%"
                    height="100%"
                    style={{ border: 'none', overflow: 'hidden', position: 'absolute', top: 0, left: 0 }}
                    scrolling="no"
                    frameBorder="0"
                    allowFullScreen={true}
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    onLoad={() => {
                         if (active) onTimeUpdate(1); // Fake some progress to trigger any logic
                    }}
                />
            ) : (
                <ReactPlayer
                    ref={playerRef}
                    url={url}
                    width="100%"
                    height="100%"
                    playing={active && isPlaying}
                    muted={isMuted}
                    volume={volume}
                    onProgress={handleProgress}
                    onEnded={onEnded}
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
                
                {title && (
                    <div className="absolute top-4 left-4 right-4 z-40">
                        <h2 className="text-white font-bold text-sm md:text-lg drop-shadow-lg line-clamp-1">{title}</h2>
                    </div>
                )}
                
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
                        {onToggleFullscreen && (
                             <button onClick={onToggleFullscreen} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors">
                                  {isFullscreen ? <Minimize className="w-4 h-4 md:w-5 md:h-5 text-white" /> : <Maximize className="w-4 h-4 md:w-5 md:h-5 text-white" />}
                             </button>
                        )}
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
const PlayerSlot = memo(({ id, content, tiktokUrl, active, channelThumb, onTimeUpdate, onEnded, onToggleFullscreen, isFullscreen }: {
    id: string;
    content: QueueItem | null;
    tiktokUrl: string | null;
    active: boolean;
    channelThumb?: string;
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
                    id={id}
                    videoId={ytId}
                    startTime={content.startTime || 0}
                    active={active}
                    playbackSpeed={content.playbackSpeed}
                    onTimeUpdate={onTimeUpdate || (() => {})}
                    onEnded={onEnded || (() => {})}
                    onToggleFullscreen={onToggleFullscreen}
                    isFullscreen={isFullscreen}
                    title={content.title}
                />
            ) : isSocial ? (
                <SocialPlayer
                    url={content.url}
                    active={active}
                    onTimeUpdate={onTimeUpdate || (() => {})}
                    onEnded={onEnded || (() => {})}
                    onToggleFullscreen={onToggleFullscreen}
                    isFullscreen={isFullscreen}
                    title={content.title}
                />
            ) : (
                <VideoPlayer
                    url={isTikTok ? tiktokUrl! : content.url}
                    title={content.title}
                    poster={channelThumb}
                    autoPlay={true}
                    startTime={content.startTime}
                    isLive={true}
                    onEnded={onEnded || (() => {})}
                    onTimeUpdate={onTimeUpdate}
                    onToggleFullscreen={onToggleFullscreen}
                    isFullscreen={isFullscreen}
                    muted={!active}
                    initialPlaybackRate={content.playbackSpeed}
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
    type: "program" | "interval" | "ad";
    programIndex: number;
    playbackSpeed?: number;
    breakIndex?: number;
    description?: string;
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

    // Ref to player container for fullscreen
    const playerContainerRef = useRef<HTMLDivElement>(null);

    // Track current program index
    const currentIndexRef = useRef(0);
    const isTransitioningRef = useRef(false);
    const bufferReadyRef = useRef(false);
    
    // Channel generation counter to invalidate stale TikTok promises
    const channelGenRef = useRef(0);

    const programs = currentChannel?.episodes || [];
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
            const r = await fetch(`/api/tiktok?url=${encodeURIComponent(url)}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            // If channel changed since we started, discard result
            if (channelGenRef.current !== gen) return "stale";
            const d = await r.json();
            return d.url || "error";
        } catch {
            return "error";
        }
    }, []);

    // ---- 4. Build the NEXT item ----
    const getNextItem = useCallback((currentItem: QueueItem): QueueItem => {
        const shuffleIntervals = currentChannel?.shuffle_intervals || false;
        const shuffleAds = currentChannel?.shuffle_ads || false;
        const currentProg = programs[currentItem.programIndex] || programs[0];

        const reqIntervals = currentProg?.post_video_intervals || 0;
        const reqAds = currentProg?.post_video_ads || 0;
        
        let breakIdx = currentItem.breakIndex || 0;
        
        if (currentItem.type === "program") {
            if (reqIntervals > 0 && intervalList.length > 0) {
                const urlObj = shuffleIntervals 
                    ? intervalList[Math.floor(Math.random() * intervalList.length)] 
                    : intervalList[0 % intervalList.length];
                return {
                    url: urlObj.url, startTime: 0, title: urlObj.title || "Intervalo",
                    type: "interval", programIndex: currentItem.programIndex, breakIndex: 1
                };
            } else if (reqAds > 0 && adList.length > 0) {
                 const urlObj = shuffleAds 
                    ? adList[Math.floor(Math.random() * adList.length)] 
                    : adList[0 % adList.length];
                return {
                    url: urlObj.url, startTime: 0, title: urlObj.title || "Publicidade",
                    type: "ad", programIndex: currentItem.programIndex, breakIndex: 1
                };
            }
        } 
        
        if (currentItem.type === "interval") {
             if (breakIdx < reqIntervals && intervalList.length > 0) {
                  const urlObj = shuffleIntervals 
                    ? intervalList[Math.floor(Math.random() * intervalList.length)] 
                    : intervalList[breakIdx % intervalList.length];
                  return {
                      url: urlObj.url, startTime: 0, title: urlObj.title || "Intervalo",
                      type: "interval", programIndex: currentItem.programIndex, breakIndex: breakIdx + 1
                  };
             } else if (reqAds > 0 && adList.length > 0) {
                  const urlObj = shuffleAds 
                    ? adList[Math.floor(Math.random() * adList.length)] 
                    : adList[0 % adList.length];
                  return {
                      url: urlObj.url, startTime: 0, title: urlObj.title || "Publicidade",
                      type: "ad", programIndex: currentItem.programIndex, breakIndex: 1
                  };
             }
        }

        if (currentItem.type === "ad") {
             if (breakIdx < reqAds && adList.length > 0) {
                   const urlObj = shuffleAds 
                    ? adList[Math.floor(Math.random() * adList.length)] 
                    : adList[breakIdx % adList.length];
                  return {
                      url: urlObj.url, startTime: 0, title: urlObj.title || "Publicidade",
                      type: "ad", programIndex: currentItem.programIndex, breakIndex: breakIdx + 1
                  };
             }
        }

        const nextIdx = (currentItem.programIndex + 1) % programs.length;
        const nextProg = programs[nextIdx];
        return {
            url: nextProg?.internal_player_url || nextProg?.url || "",
            startTime: 0,
            title: nextProg?.title || "",
            type: "program",
            programIndex: nextIdx,
            playbackSpeed: nextProg?.playback_speed,
            breakIndex: 0,
            description: nextProg?.description || "",
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

        // WATCHDOG: Force end transition if stuck at end
        if (duration && duration > 0 && remaining <= 0.5 && !isTransitioningRef.current) {
            handleEndedRef.current(activeSlotRef.current);
            return;
        }

        // PRE-EMPTIVE SWAP 1.2s before end (hides YouTube replay icon)
        if (duration && remaining > 0 && remaining <= 1.2 && !isTransitioningRef.current) {
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
    }, [getNextItem, loadTikTokForSlot]);

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
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={handleEndedB}
                                    onToggleFullscreen={toggleFullscreen}
                                    isFullscreen={isFullscreen}
                                />

                                {/* Logo Watermark - z-20 stays BEHIND controls (z-30) */}
                                {currentChannel.channel_logo_url && (
                                    <div
                                        className={`absolute bottom-6 left-6 z-20 pointer-events-none select-none transition-all duration-300 ${
                                            isFullscreen ? "opacity-90 scale-125" : "opacity-70"
                                        }`}
                                    >
                                        <img
                                            src={currentChannel.channel_logo_url}
                                            alt="Logo"
                                            className="h-8 md:h-14 w-auto object-contain filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
                                        />
                                    </div>
                                )}

                                {/* Live Badge - Moved to Top Right and Right-Aligned */}
                                <div className="absolute top-6 right-6 z-50 flex flex-row-reverse items-center gap-2 pointer-events-none transition-all">
                                    <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider text-white animate-pulse">
                                        <div className="w-2 h-2 bg-white rounded-full" /> AO VIVO
                                    </div>
                                    <div className="bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded text-[11px] font-medium text-white/90">
                                        {isAdMode ? "INTERVALO" : "24h Online"}
                                    </div>
                                </div>

                                {/* Periodic Title Badge ("Você está assistindo") - Now appears slightly below the live badge if both are present, or we can just shift it left */}
                                {nowPlayingTitle && !isAdMode && (realTime % 555 < 15) && (
                                    <div className="absolute top-16 right-6 z-50 animate-in fade-in slide-in-from-right-4 duration-700">
                                        <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10 shadow-xl flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                            <div className="flex flex-col text-right">
                                                <span className="text-[10px] text-white/60 font-medium uppercase tracking-tight">Estás a ver:</span>
                                                <span className="text-sm text-white font-bold max-w-[200px] truncate">{nowPlayingTitle}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
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
                                <h2 className="text-xl font-bold text-white mb-2 leading-tight">
                                    {isAdMode ? "Intervalo Comercial" : (nowPlayingTitle || currentChannel?.title)}
                                </h2>
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
                                        <span>Tempo Restante</span>
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
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                    Programação de Hoje
                                </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {getUpcomingPrograms().map((prog, idx) => (
                                    <div key={idx} className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-2xl group hover:border-primary/50 transition-colors">
                                        <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                                            {idx === 0 ? "Próximo" : "A seguir"}
                                        </span>
                                        <h3 className="text-sm font-bold text-zinc-300 mt-2 truncate group-hover:text-white">
                                            {prog.title}
                                        </h3>
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

                {/* Channel List */}
                <div className="w-full max-w-7xl mx-auto px-4 md:px-8">
                    <div className="flex items-center gap-3 mb-8">
                        <Tv className="w-6 h-6 text-primary" />
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Explorar Canais</h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                        {contents.map((channel) => (
                            <div
                                key={channel.id}
                                className={`aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer group relative border-2 ${
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
        </div>
    );
}
