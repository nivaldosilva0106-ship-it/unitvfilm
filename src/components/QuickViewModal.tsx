import { useRef, useEffect, useState } from 'react';
import { X, Play, Clock, Star, Info, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Content } from '@/types/content';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { getProviderConfig } from '@/lib/providers';
import { getBaseUrl } from '@/lib/api';

// Utility helper to extract 11-character YouTube video IDs
const getYouTubeId = (url: string | undefined | null) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

interface QuickViewModalProps {
    content: Content | null;
    open: boolean;
    onClose: () => void;
    onPlay?: (content: Content) => void; // New prop to open player
}

export const QuickViewModal = ({ content, open, onClose, onPlay }: QuickViewModalProps) => {
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>(null);
    const [muted, setMuted] = useState(true);
    const [showTrailer, setShowTrailer] = useState(false);
    const [videoOpacity, setVideoOpacity] = useState(0); // For smooth cross-fade effect
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    // 3-Stage transition timer orchestrator
    useEffect(() => {
        let startTimer: NodeJS.Timeout;
        let stopTimer: NodeJS.Timeout;
        let fadeOutTimer: NodeJS.Timeout;

        if (open && content?.trailer_url) {
            setShowTrailer(false);
            setVideoOpacity(0);
            setIsVideoPlaying(false);

            // Phase 1: Wait 5 seconds, then transition to video
            startTimer = setTimeout(() => {
                setShowTrailer(true);
                // Slowly fade in video opacity
                setTimeout(() => setVideoOpacity(1), 100);

                // Phase 2: Play for 60 seconds, then fade back to backdrop image
                stopTimer = setTimeout(() => {
                    setVideoOpacity(0); // Fade out video opacity
                    
                    // Phase 3: Wait for 1s fade-out transition, then unmount video
                    fadeOutTimer = setTimeout(() => {
                        setShowTrailer(false);
                        setIsVideoPlaying(false);
                    }, 1000); // matches CSS transition duration
                }, 60000); // 60 seconds duration
            }, 5000); // 5 seconds initial delay
        } else {
            setShowTrailer(false);
            setVideoOpacity(0);
            setIsVideoPlaying(false);
        }

        return () => {
            clearTimeout(startTimer);
            clearTimeout(stopTimer);
            clearTimeout(fadeOutTimer);
        };
    }, [open, content]);

    // YouTube Player stealth background system
    useEffect(() => {
        if (!open || !content?.trailer_url || !showTrailer) {
            setIsVideoPlaying(false);
            if (playerRef.current) {
                try { playerRef.current.pauseVideo(); } catch {}
            }
            return;
        }

        const ytId = getYouTubeId(content.trailer_url);
        if (!ytId) return; // Fallback to standard HTML video element if not YouTube

        let destroyed = false;

        const initPlayer = () => {
            if (destroyed) return;
            if (!window.YT?.Player) return;

            const el = document.getElementById('quickview-yt-player');
            if (!el) return;

            try { playerRef.current?.destroy(); } catch {}
            playerRef.current = null;

            playerRef.current = new window.YT.Player('quickview-yt-player', {
                videoId: ytId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    origin: getBaseUrl(),
                    playsinline: 1,
                    playlist: ytId // For proper loop / playback
                },
                events: {
                    onReady: (e: any) => {
                        if (destroyed) return;
                        e.target.mute(); // Autoplay requires mute initially
                        e.target.playVideo();
                        if (!muted) {
                            setTimeout(() => {
                                try { e.target.unMute(); } catch {}
                            }, 500);
                        }
                    },
                    onStateChange: (e: any) => {
                        if (destroyed) return;
                        if (e.data === window.YT.PlayerState.PLAYING) {
                            setIsVideoPlaying(true);
                        } else {
                            setIsVideoPlaying(false);
                        }
                    }
                }
            });
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
            setTimeout(initPlayer, 100);
        }

        return () => {
            destroyed = true;
            try { playerRef.current?.destroy(); } catch {}
            playerRef.current = null;
            setIsVideoPlaying(false);
        };
    }, [open, content, showTrailer]);

    // Handle volume state changes for YouTube player
    useEffect(() => {
        if (playerRef.current && playerRef.current.unMute && playerRef.current.mute) {
            try {
                if (muted) {
                    playerRef.current.mute();
                } else {
                    playerRef.current.unMute();
                }
            } catch {}
        }
    }, [muted]);

    // Handle direct video end - smoothly fade back to backdrop image
    const handleVideoEnd = () => {
        setVideoOpacity(0);
        setTimeout(() => {
            setShowTrailer(false);
            setIsVideoPlaying(false);
        }, 1000); // match transition duration
    };

    const handlePlay = () => {
        if (!content) return;

        if (onPlay) {
            onPlay(content);
        } else if (content.category === 'nostalgia') {
            navigate(`/nostalgia/${content.id}`);
        } else if (content.category === 'series') {
            navigate(`/content/${content.id}`);
        } else {
            navigate(`/watch/${content.id}`);
        }
        onClose();
    };

    if (!content || !open) return null;

    // Classification Color
    const getClassificationColor = (cls?: string) => {
        switch (cls) {
            case 'L': return 'bg-green-500';
            case '10': return 'bg-blue-400';
            case '12': return 'bg-yellow-400';
            case '14': return 'bg-orange-400';
            case '16': return 'bg-red-500';
            case '18': return 'bg-black';
            default: return 'bg-zinc-500';
        }
    };

    const isYouTubeTrailer = !!getYouTubeId(content.trailer_url);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className="relative w-[800px] max-w-[90vw] bg-[#141414] rounded-lg overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95 duration-200 border border-zinc-800"
                onClick={e => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-20 bg-black/50 p-2 rounded-full hover:bg-black/80 text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="relative h-[400px] w-full bg-black overflow-hidden">
                    {/* Always show backdrop image as base */}
                    <img
                        src={content.backdrop_url || content.thumbnail_url}
                        alt={content.title}
                        className="w-full h-full object-cover"
                    />

                    {/* YouTube Trailer container with stealth crop & fade transition */}
                    {showTrailer && content.trailer_url && isYouTubeTrailer && (
                        <div 
                            className="absolute inset-0 w-full h-full transition-opacity duration-1000 bg-black"
                            style={{ opacity: videoOpacity }}
                        >
                            <div className="relative w-full h-full overflow-hidden pointer-events-none">
                                <div 
                                    id="quickview-yt-player" 
                                    className="absolute top-1/2 left-1/2 w-[300%] h-[300%] md:w-[150%] md:h-[150%] lg:w-[130%] lg:h-[130%] -translate-x-1/2 -translate-y-1/2 pointer-events-none" 
                                />
                            </div>
                        </div>
                    )}

                    {/* Fallback Direct Video Overlay with fade transition */}
                    {showTrailer && content.trailer_url && !isYouTubeTrailer && (
                        <video
                            ref={videoRef}
                            src={content.trailer_url}
                            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
                            style={{ opacity: videoOpacity }}
                            autoPlay
                            muted={muted}
                            onEnded={handleVideoEnd}
                            poster={content.backdrop_url || content.thumbnail_url}
                        />
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent pointer-events-none" />

                    {/* Content Info Overlay */}
                    <div className="absolute bottom-0 left-0 p-8 w-full z-10">
                        <h2 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">{content.title}</h2>

                        <div className="flex items-center gap-3 mb-6">
                            <Button onClick={handlePlay} className="bg-white text-black hover:bg-white/90 gap-2 font-bold px-8">
                                <Play className="w-5 h-5 fill-black" /> Assistir
                            </Button>

                            {content.trailer_url && (
                                <button
                                    onClick={() => setMuted(!muted)}
                                    className="p-3 rounded-full border border-zinc-500 text-zinc-300 hover:border-white hover:text-white transition-all bg-black/30 backdrop-blur"
                                >
                                    {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                <div className="p-8 pt-0 grid grid-cols-3 gap-8">
                    <div className="col-span-2 space-y-4">
                        <div className="flex items-center gap-3 text-sm font-medium">
                            {content.watch_provider && getProviderConfig(content.watch_provider) && (
                                <div className="bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded border border-white/10 flex items-center justify-center h-6">
                                    <img 
                                        src={getProviderConfig(content.watch_provider)?.logo} 
                                        alt="" 
                                        className="h-full w-auto object-contain"
                                    />
                                </div>
                            )}
                            <span className="text-green-500 font-bold">Novo</span>
                            <span className="text-zinc-400">{content.year || '2024'}</span>
                            <div className={cn("px-2 py-0.5 rounded text-xs font-bold text-white", getClassificationColor(content.classification))}>
                                {content.classification || 'L'}
                            </div>
                            <span className="text-zinc-400">{content.duration || '1h 30m'}</span>
                            <div className="flex items-center border border-zinc-600 px-1 rounded text-[10px] text-zinc-400">HD</div>
                        </div>

                        <p className="text-zinc-300 leading-relaxed text-sm">
                            {content.description}
                        </p>
                    </div>

                    <div className="col-span-1 space-y-4 text-sm">
                        <div>
                            <span className="text-zinc-500 block mb-1">Gênero:</span>
                            <span className="text-zinc-300 hover:underline cursor-pointer">
                                {content.genre?.join(', ') || 'Ação, Drama'}
                            </span>
                        </div>
                        {content.cast && (
                            <div>
                                <span className="text-zinc-500 block mb-1">Elenco:</span>
                                <span className="text-zinc-300 line-clamp-2">
                                    {content.cast}
                                </span>
                            </div>
                        )}
                        <div>
                            <span className="text-zinc-500 block mb-1">Classificação:</span>
                            <div className="flex items-center gap-2 text-zinc-300">
                                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                {content.rating ? content.rating.toFixed(1) : 'NR'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
