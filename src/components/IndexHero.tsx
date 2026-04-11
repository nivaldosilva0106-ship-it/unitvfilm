import React, { useRef, useEffect, memo } from "react";
import { Volume2, VolumeX, Play, Info, Plus, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Content } from "@/types/content";
import { getProviderConfig } from "@/lib/providers";
import { useAppConfig } from "@/hooks/useAppConfig";
import { getOptimizedImageUrl } from "@/lib/utils";

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
    providerLogos
}: IndexHeroProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const { isLiteMode, imageQuality, enableBackdropBlur } = useAppConfig();

    // Audio command to iframe
    useEffect(() => {
        if (iframeRef.current && iframeRef.current.contentWindow) {
            const action = isMuted ? "mute" : "unMute";
            iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ event: "command", func: action, args: [] }),
                "*"
            );
        }
    }, [isMuted, currentTrailer]);

    return (
        <div className="relative py-12 flex items-center justify-center overflow-hidden min-h-[350px] md:min-h-[450px] lg:min-h-[550px] w-full">
            {/* Hero Background: Image first (15s), then Video */}
            {!playerModalOpen && !quickViewContentOpen && !selectedSeriesOpen && currentTrailer && currentTrailer.trailer_url && showVideo && getYouTubeId(currentTrailer.trailer_url) ? (
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="relative w-full h-full overflow-hidden">
                        <iframe
                            ref={iframeRef}
                            key={currentTrailer.id}
                            className={`absolute top-[40%] left-1/2 w-[200%] h-[200%] md:top-1/2 md:w-[130%] md:h-[130%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-700 will-change-[opacity] ${isTransitioning ? 'opacity-0' : 'opacity-50'}`}
                            src={`https://www.youtube.com/embed/${getYouTubeId(currentTrailer.trailer_url)}?autoplay=1&mute=0&controls=0&enablejsapi=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&end=90&loop=1&playlist=${getYouTubeId(currentTrailer.trailer_url)}`}
                            loading="lazy"
                            title="Hero Video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            style={{ border: 'none' }}
                        />
                        <div className="absolute inset-0 z-10 bg-transparent pointer-events-auto cursor-default" />
                        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-transparent to-background" />
                    </div>
                </div>
            ) : (
                <div className="absolute inset-0 z-0">
                    {currentTrailer ? (
                        <>
                            <img
                                src={getOptimizedImageUrl(currentTrailer.backdrop_url || currentTrailer.thumbnail_url, 'backdrop', imageQuality)}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/95" />
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-b from-background to-background/80" />
                    )}
                </div>
            )}

            {!playerModalOpen && currentTrailer && currentTrailer.trailer_url && (
                <div className="absolute right-8 bottom-32 z-50 hidden md:block">
                    <button
                        onClick={toggleAudio}
                        className="p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/20 transition-all backdrop-blur-md shadow-lg"
                        aria-label={isMuted ? "Ativar som" : "Mudo"}
                    >
                        {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                </div>
            )}

            <div className="relative z-20 text-center px-4 max-w-5xl mx-auto w-full flex flex-col items-center">
                <div className={`transition-opacity duration-1000 ${heroTextVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-3 drop-shadow-lg pt-8">
                        Bem-vindo ao Uni<span className="text-primary glow-effect">Tv</span>Film
                    </h1>
                    <p className="text-lg text-foreground/90 drop-shadow-md mb-8">
                        Sua plataforma de streaming com os melhores filmes, séries e canais de TV
                    </p>
                </div>

                {activeContent && (
                    <div className="w-full max-w-4xl mx-auto z-50 relative mt-8 group/hero-info animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        {/* The Ultra-Modern Glass Card */}
                        <div className={`relative overflow-hidden rounded-3xl p-0.5 transition-all duration-500 ${!isLiteMode ? 'hover:scale-[1.01] active:scale-[0.99]' : ''}`}>
                            {/* Animated Border Glow */}
                            {!isLiteMode && <div className="absolute inset-0 bg-gradient-to-r from-primary/30 via-white/5 to-primary/30 opacity-40 group-hover/hero-info:opacity-70 transition-opacity blur-sm" />}
                            
                            <div className={`relative bg-zinc-950/80 rounded-[calc(1.5rem-2px)] p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start gap-8 shadow-2xl border border-white/5 ${enableBackdropBlur ? 'backdrop-blur-md' : ''}`}>
                                
                                {/* Poster Area with Floating Effect */}
                                <div 
                                    className="relative group/poster shrink-0 w-40 sm:w-48 cursor-pointer perspective-1000"
                                    onClick={() => handlePlayContent(activeContent)}
                                >
                                    <div className={`relative transition-all duration-500 transform-gpu ${!isLiteMode ? 'group-hover/poster:scale-105 group-hover/poster:-rotate-y-12 group-hover/poster:translate-z-10' : ''}`}>
                                        <img
                                            src={getOptimizedImageUrl(activeContent.thumbnail_url, 'poster', imageQuality)}
                                            alt={activeContent.title}
                                            loading="lazy"
                                            className="w-full aspect-[2/3] object-cover rounded-2xl shadow-2xl ring-1 ring-white/10"
                                        />
                                        
                                        {/* Provider Logo Overlay */}
                                        {activeContent.watch_provider && getProviderConfig(activeContent.watch_provider, providerLogos) && (
                                            <div className="absolute top-3 left-3 z-10 bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/10 shadow-2xl transition-transform duration-300 group-hover/poster:scale-110">
                                                <img 
                                                    src={getProviderConfig(activeContent.watch_provider, providerLogos)?.logo} 
                                                    alt="" 
                                                    className="h-7 w-auto object-contain" 
                                                />
                                            </div>
                                        )}

                                        {/* Age Classification Badge */}
                                        {activeContent.classification && (
                                            <div className={`absolute ${activeContent.watch_provider ? 'top-[62px]' : 'top-3'} left-3 z-10 px-2.5 py-1 rounded-lg text-xs font-black text-white shadow-xl transition-all duration-300 group-hover/poster:scale-110
                                                ${activeContent.classification === 'L' ? 'bg-green-500 hover:bg-green-400' :
                                                activeContent.classification === '10' ? 'bg-blue-400 hover:bg-blue-300' :
                                                activeContent.classification === '12' ? 'bg-yellow-400 hover:bg-yellow-300' :
                                                activeContent.classification === '14' ? 'bg-orange-400 hover:bg-orange-300' :
                                                activeContent.classification === '16' ? 'bg-red-500 hover:bg-red-400' :
                                                activeContent.classification === '18' ? 'bg-black ring-1 ring-white/20' : 'bg-zinc-600'
                                            }`}>
                                                {activeContent.classification}
                                            </div>
                                        )}

                                        {/* Play Hover Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent opacity-0 group-hover/poster:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                                            <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg shadow-primary/30 scale-0 group-hover/poster:scale-100 transition-transform duration-300">
                                                <Play className="w-8 h-8 text-white fill-current ml-1" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Content Details */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center h-full w-full text-center md:text-left">
                                    <div className="flex items-center justify-center md:justify-start gap-3 mb-4 flex-wrap">
                                        {activeContent.isPremium && (
                                            <span className="bg-primary text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.1em] shadow-[0_0_15px_-3px_rgba(var(--primary),0.5)] animate-pulse">
                                                Assista agora
                                            </span>
                                        )}
                                        <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1 rounded-full text-yellow-500 text-xs font-black">
                                            <Star className="w-3.5 h-3.5 fill-current" />
                                            {activeContent.rating ? activeContent.rating.toFixed(1) : "N/A"}
                                        </div>
                                        <span className="text-[10px] text-zinc-300 uppercase bg-white/5 border border-white/10 px-2.5 py-1 rounded-full font-bold tracking-widest backdrop-blur-sm">
                                            {activeContent.category === 'movie' ? 'Cinematográfico' : activeContent.category === 'series' ? 'Série Original' : 'TV Ao Vivo'}
                                        </span>
                                    </div>

                                    <h3 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 tracking-tighter leading-none drop-shadow-2xl">
                                        {activeContent.title}
                                    </h3>
                                    
                                    <p className="text-sm sm:text-base text-zinc-300/90 line-clamp-3 mb-8 leading-relaxed font-medium max-w-2xl mx-auto md:mx-0">
                                        {activeContent.description || "Inicie sua jornada cinematográfica agora com este conteúdo exclusivo."}
                                    </p>

                                    {/* Action Buttons */}
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                                        <button
                                            onClick={() => handlePlayContent(activeContent)}
                                            className="group/btn relative bg-primary hover:bg-primary-hover text-white font-black h-14 px-10 rounded-2xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-[0_10px_20px_-5px_rgba(var(--primary),0.3)] flex items-center justify-center gap-2 text-base overflow-hidden flex-1 sm:flex-none"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-in-out" />
                                            <Play className="w-5 h-5 fill-current" /> 
                                            Reproduzir
                                        </button>

                                        <button
                                            onClick={() => handleInfoContent(activeContent)}
                                            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold h-14 px-8 rounded-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-base flex-1 sm:flex-none shadow-xl"
                                        >
                                            <Info className="w-5 h-5" /> 
                                            Explorar
                                        </button>

                                        <button
                                            onClick={() => handleToggleMyList(activeContent)}
                                            className={`group/list h-14 w-14 rounded-2xl border flex items-center justify-center backdrop-blur-md transition-all duration-500 hover:scale-110 active:rotate-12 flex-shrink-0 shadow-xl
                                                ${isInList 
                                                    ? 'bg-primary/20 border-primary text-primary shadow-primary/20' 
                                                    : 'bg-white/5 border-white/10 text-white hover:border-white/40'
                                                }`}
                                            title={isInList ? "Remover da lista" : "Adicionar à lista"}
                                        >
                                            {isInList ? (
                                                <Check className="w-6 h-6 animate-in zoom-in duration-300" />
                                            ) : (
                                                <Plus className="w-6 h-6 group-hover/list:rotate-180 transition-transform duration-500" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

IndexHero.displayName = 'IndexHero';
