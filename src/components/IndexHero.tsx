import React, { useRef, useEffect, useState, memo } from "react";
import { Volume2, VolumeX, Play, Info, Plus, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Content } from "@/types/content";
import { getProviderConfig } from "@/lib/providers";
import { useAppConfig } from "@/hooks/useAppConfig";
import { getOptimizedImageUrl } from "@/lib/utils";
import { getTmdbLogoUrl } from "@/lib/tmdb";
import { FOCUSABLE_CLASS } from "@/hooks/useSpatialNavigation";
import { getBaseUrl } from "@/lib/api";

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

interface IndexHeroProps {
    currentTrailer: Content | null;
    showVideo: boolean;
    getYouTubeId: (url: string | undefined | null) => string | null;
    isTransitioning: boolean;
    isMuted: boolean;
    heroTextVisible: boolean;
    activeContent: Content | null;
    allContentData: Content[];
    currentImageIndex: number;
    playerModalOpen: boolean;
    quickViewContentOpen: boolean;
    selectedSeriesOpen: boolean;
    isInList: boolean;
    toggleAudio: () => void;
    handlePlayContent: (content: Content) => void;
    handleInfoContent: (content: Content) => void;
    handleToggleMyList: (content: Content) => void;
    providerLogos?: Record<string, string>;
    onReady?: () => void;
}

export const IndexHero = memo(({
    currentTrailer,
    showVideo,
    getYouTubeId,
    isTransitioning,
    isMuted,
    heroTextVisible,
    activeContent,
    allContentData,
    currentImageIndex,
    playerModalOpen,
    quickViewContentOpen,
    selectedSeriesOpen,
    isInList,
    toggleAudio,
    handlePlayContent,
    handleInfoContent,
    handleToggleMyList,
    providerLogos,
    onReady
}: IndexHeroProps) => {
    const { isLiteMode, imageQuality } = useAppConfig();
    const playerRef = useRef<any>(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [tmdbLogo, setTmdbLogo] = useState<string | null>(null);
    const [displayedContent, setDisplayedContent] = useState<Content | null>(null);
    const [displayedLogo, setDisplayedLogo] = useState<string | null>(null);
    const prevContentRef = useRef<Content | null>(null);

    useEffect(() => {
        if (activeContent && activeContent.id !== prevContentRef.current?.id) {
            prevContentRef.current = activeContent;
            setTmdbLogo(null);
            setDisplayedLogo(null);
            
            if (activeContent.tmdb_id) {
                getTmdbLogoUrl(activeContent.tmdb_id, activeContent.category === 'movie' ? 'movie' : 'tv')
                    .then((logo) => {
                        setTmdbLogo(logo);
                        setDisplayedLogo(logo);
                    })
                    .catch(() => {
                        setTmdbLogo(null);
                        setDisplayedLogo(null);
                    });
            }
            
            setDisplayedContent(activeContent);
        }
    }, [activeContent]);

    const showLogo = displayedLogo && displayedContent;
    const showTextTitle = !displayedLogo && displayedContent;

    // YouTube Player System (Stealth Mode)
    useEffect(() => {
        // PERF: Skip heavy video player if showVideo is false or modais are open
        if (!currentTrailer || !currentTrailer.trailer_url || !showVideo || playerModalOpen || quickViewContentOpen || selectedSeriesOpen) {
            setIsVideoPlaying(false);
            if (playerRef.current) {
                try { playerRef.current.pauseVideo(); } catch {}
            }
            return;
        }

        const ytId = getYouTubeId(currentTrailer.trailer_url);
        if (!ytId) return;

        let destroyed = false;
        
        const initPlayer = () => {
             if (destroyed) return;
             if (!window.YT?.Player) return; // wait for script
             
             const el = document.getElementById(`hero-yt-player`);
             if (!el) return;
             
             try { playerRef.current?.destroy(); } catch {}
             playerRef.current = null;
             
             playerRef.current = new window.YT.Player(`hero-yt-player`, {
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
                     playlist: ytId // For proper looping
                 },
                 events: {
                     onReady: (e: any) => {
                         if (destroyed) return;
                         e.target.mute(); // Secure autoplay
                         e.target.playVideo();
                         if (!isMuted) {
                             setTimeout(() => {
                                 try { e.target.unMute(); } catch {}
                             }, 500);
                         }
                     },
                     onStateChange: (e: any) => {
                         if (destroyed) return;
                         if (e.data === window.YT.PlayerState.PLAYING) {
                             setIsVideoPlaying(true);
                             if (onReady) onReady();
                         } else if (e.data === window.YT.PlayerState.ENDED || e.data === window.YT.PlayerState.CUED) {
                             setIsVideoPlaying(false);
                         }
                     }
                 }
             });
        };

        setIsVideoPlaying(false);

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
    }, [currentTrailer, showVideo, getYouTubeId, playerModalOpen, quickViewContentOpen, selectedSeriesOpen]);

    // Signal ready immediately if video is disabled or there is no video trailer to load
    useEffect(() => {
        if (!currentTrailer || !currentTrailer.trailer_url || !showVideo) {
            if (onReady) onReady();
        }
    }, [currentTrailer, showVideo, onReady]);

    // Handle Mute from UI toggle
    useEffect(() => {
        if (playerRef.current && playerRef.current.unMute && playerRef.current.mute) {
            try {
                if (isMuted) {
                    playerRef.current.mute();
                } else {
                    playerRef.current.unMute();
                }
            } catch {}
        }
    }, [isMuted]);

    return (
        <div className="relative py-12 flex items-center justify-start overflow-hidden min-h-[50vh] md:min-h-[75vh] lg:min-h-[85vh] w-full">
            {/* Background Architecture */}
            <div className="absolute inset-0 z-0 bg-black">
                {/* Backdrop Image - Smooth fade out when video is actually playing */}
                {currentTrailer && (
                    <img
                        src={getOptimizedImageUrl(currentTrailer.backdrop_url || currentTrailer.thumbnail_url, 'backdrop', imageQuality)}
                        alt=""
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity [transition-duration:1500ms] ease-in-out ${isVideoPlaying ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
                        loading="lazy"
                    />
                )}
                
                {/* Embedded Video Player */}
                <div 
                    className={`absolute inset-0 transition-opacity [transition-duration:1500ms] ease-in-out ${isVideoPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                     <div className="relative w-full h-full overflow-hidden pointer-events-none">
                          <div 
                              id="hero-yt-player" 
                              className="absolute top-1/2 left-1/2 w-[300%] h-[300%] md:w-[150%] md:h-[150%] lg:w-[130%] lg:h-[130%] -translate-x-1/2 -translate-y-1/2 pointer-events-none" 
                          />
                     </div>
                </div>

                {/* Overlays to isolate text visually */}
                <div className="absolute inset-0 z-10 bg-gradient-to-r from-background via-background/60 to-transparent pointer-events-none w-[90%] md:w-[70%]" />
                <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-transparent to-background/95 pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-background to-transparent h-48 pointer-events-none" />
            </div>

            {/* Audio & Classification controls on the Right Edge (Netflix style) */}
            {!playerModalOpen && currentTrailer && currentTrailer.trailer_url && isVideoPlaying && (
                <div className="absolute right-0 bottom-32 z-50 flex items-center gap-4 animate-in fade-in slide-in-from-right-8 duration-1000">
                    <button
                        onClick={toggleAudio}
                        className={`p-3 rounded-full bg-black/40 hover:bg-black/60 text-white border border-white/20 transition-all backdrop-blur-md shadow-lg mr-4 ${FOCUSABLE_CLASS}`}
                        aria-label={isMuted ? "Ativar som" : "Mudo"}
                    >
                        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    {activeContent?.classification && (
                        <div className="bg-black/60 border-l-[3px] border-white backdrop-blur-md text-white py-2 px-6 text-xl font-black shadow-2xl flex items-center h-12 rounded-l-[4px]">
                            {activeContent.classification}
                        </div>
                    )}
                </div>
            )}

            {/* Main Content Info (Left Aligned) */}
            <div className="relative z-20 px-6 sm:px-12 md:px-16 w-full max-w-[90%] md:max-w-[50%] mt-[10vh] md:mt-0 flex flex-col items-start gap-4 md:gap-6">
                {displayedContent && (
                    <div className={`transition-all duration-1000 flex flex-col gap-4 w-full ${isTransitioning ? 'opacity-0 -translate-x-8' : 'opacity-100 translate-x-0'}`}>
                        
                        {/* Title Logo (preferred) or Text Title (fallback) */}
                        {showLogo ? (
                            <div className="w-full max-w-[280px] sm:max-w-[350px] md:max-w-[450px]">
                                <img 
                                    src={displayedLogo!} 
                                    alt={displayedContent.title}
                                    className="w-full h-auto max-h-[160px] object-contain object-left filter drop-shadow-2xl"
                                />
                                {displayedContent.isPremium && (
                                    <span className="mt-6 inline-block bg-primary text-white px-3 py-1 rounded-sm text-xs font-black uppercase tracking-[0.1em] shadow-[0_0_15px_-3px_rgba(var(--primary),0.5)]">
                                        Novo
                                    </span>
                                )}
                            </div>
                        ) : showTextTitle ? (
                            <div className="flex flex-col items-start">
                                {displayedContent.isPremium && (
                                    <span className="mb-4 bg-primary text-white px-3 py-1 rounded-sm text-xs font-black uppercase tracking-[0.1em] shadow-[0_0_15px_-3px_rgba(var(--primary),0.5)] animate-pulse">
                                        Novo
                                    </span>
                                )}
                                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-white leading-tight drop-shadow-2xl tracking-tighter">
                                    {displayedContent.title}
                                </h1>
                            </div>
                        ) : null}

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center gap-3 drop-shadow-xl text-sm md:text-base font-bold mt-2">
                            <div className="text-green-500 font-black">
                                {displayedContent.rating ? `${(displayedContent.rating * 10).toFixed(0)}% Relevância` : "Recomendado"}
                            </div>
                            
                            {displayedContent.year && (
                                <span className="text-white/80">{displayedContent.year}</span>
                            )}

                            {displayedContent.classification && (!isVideoPlaying || window.innerWidth < 768) && (
                                <span className={`px-1.5 py-0.5 rounded-[3px] border font-bold text-xs
                                    ${displayedContent.classification === 'L' ? 'bg-green-500 text-white border-green-500' :
                                    displayedContent.classification === '10' ? 'bg-blue-400 text-white border-blue-400' :
                                    displayedContent.classification === '12' ? 'bg-yellow-400 text-black border-yellow-400' :
                                    displayedContent.classification === '14' ? 'bg-orange-400 text-white border-orange-400' :
                                    displayedContent.classification === '16' ? 'bg-red-500 text-white border-red-500' :
                                    'bg-black text-white border-white/50'}`}>
                                    {displayedContent.classification}
                                </span>
                            )}
                            
                            {displayedContent.duration && (
                                <span className="text-white/80">{displayedContent.duration}</span>
                            )}

                            {displayedContent.category === 'movie' ? (
                                <span className="border border-white/40 px-1 rounded-sm text-white/80 text-[10px] font-bold uppercase">
                                    HD
                                </span>
                            ) : null}

                            {displayedContent.watch_provider && providerLogos?.[displayedContent.watch_provider] && (
                                <img 
                                    src={providerLogos[displayedContent.watch_provider]} 
                                    alt={displayedContent.watch_provider} 
                                    title={displayedContent.watch_provider}
                                    className="h-4 sm:h-5 object-contain ml-1 drop-shadow-md rounded-[2px]" 
                                />
                            )}
                        </div>

                        {/* Description */}
                        <p className="text-base sm:text-lg text-white/90 line-clamp-3 md:line-clamp-4 max-w-xl leading-snug drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-medium mt-1">
                            {displayedContent.description}
                        </p>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-3 mt-4">
                            <button
                                onClick={() => handlePlayContent(displayedContent)}
                                className={`group/btn relative bg-green-800 hover:bg-green-700 text-white font-bold h-11 md:h-13 px-6 md:px-8 rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_4px_14px_0_rgba(22,101,52,0.5)] flex items-center justify-center gap-2 text-base md:text-lg ${FOCUSABLE_CLASS}`}
                            >
                                <Play className="w-5 h-5 md:w-6 md:h-6 fill-current" /> 
                                Assistir
                            </button>

                            <button
                                onClick={() => handleInfoContent(displayedContent)}
                                className={`bg-white/10 hover:bg-white/20 text-white font-bold h-11 md:h-13 px-6 md:px-8 rounded-full backdrop-blur-xl border border-white/20 transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-base md:text-lg shadow-xl ${FOCUSABLE_CLASS}`}
                            >
                                <Info className="w-5 h-5 md:w-6 md:h-6" /> 
                                Mais informações
                            </button>

                            <button
                                onClick={(e) => { e.stopPropagation(); handleToggleMyList(displayedContent); }}
                                className={`w-11 h-11 md:w-13 md:h-13 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full backdrop-blur-xl border border-white/20 transition-all duration-300 hover:scale-105 active:scale-95 shadow-xl ${FOCUSABLE_CLASS}`}
                            >
                                {isInList ? <Check className="w-5 h-5 md:w-6 md:h-6" /> : <Plus className="w-5 h-5 md:w-6 md:h-6" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

IndexHero.displayName = 'IndexHero';
