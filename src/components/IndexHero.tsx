import React, { useRef, useEffect } from "react";
import { Volume2, VolumeX, Play, Info, Plus, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Content } from "@/types/content";

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
}

export const IndexHero = ({
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
    handleToggleMyList
}: IndexHeroProps) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

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
        <div className="relative py-12 flex items-center justify-center overflow-hidden min-h-[400px] md:min-h-[500px] lg:min-h-[600px] w-full">
            {/* Hero Background: Image first (15s), then Video */}
            {!playerModalOpen && !quickViewContentOpen && !selectedSeriesOpen && currentTrailer && currentTrailer.trailer_url && showVideo && getYouTubeId(currentTrailer.trailer_url) ? (
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <div className="relative w-full h-full overflow-hidden">
                        <iframe
                            ref={iframeRef}
                            key={currentTrailer.id}
                            className={`absolute top-[35%] left-1/2 w-[300%] h-[300%] md:top-1/2 md:w-[150%] md:h-[150%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-1000 ${isTransitioning ? 'opacity-0' : 'opacity-60'}`}
                            src={`https://www.youtube.com/embed/${getYouTubeId(currentTrailer.trailer_url)}?autoplay=1&mute=0&controls=0&enablejsapi=1&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&end=90&loop=1&playlist=${getYouTubeId(currentTrailer.trailer_url)}`}
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
                                src={currentTrailer.backdrop_url || currentTrailer.thumbnail_url}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/95" />
                        </>
                    ) : (
                        allContentData.length > 0 && (
                            <>
                                {allContentData.map((content, index) => (
                                    <div
                                        key={content.id}
                                        className={`absolute inset-0 transition-opacity duration-1000 ${index === currentImageIndex ? 'opacity-100' : 'opacity-0'
                                            }`}
                                    >
                                        <img
                                            src={content.backdrop_url || content.thumbnail_url}
                                            alt=""
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                ))}
                                <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/95" />
                            </>
                        )
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
                    <div className="w-full max-w-3xl mx-auto z-50 relative animate-in fade-in zoom-in duration-700">
                        <div className="bg-black/70 backdrop-blur-xl border border-white/10 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 shadow-2xl hover:bg-black/80 transition-all">
                            <div className="relative group shrink-0 w-32 sm:w-auto">
                                <img
                                    src={activeContent.thumbnail_url}
                                    alt={activeContent.title}
                                    className="w-full sm:w-28 sm:h-42 object-cover rounded-lg shadow-xl group-hover:scale-105 transition-transform duration-300 ring-1 ring-white/10"
                                />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between h-full w-full text-center sm:text-left">
                                <div className="mb-4 sm:mb-0">
                                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 flex-wrap">
                                        <span className="bg-primary/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm">
                                            Assista agora
                                        </span>
                                        <div className="flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded text-yellow-500 text-xs font-bold">
                                            <Star className="w-3 h-3 fill-current" />
                                            {activeContent.rating ? activeContent.rating.toFixed(1) : "N/A"}
                                        </div>
                                        <span className="text-[10px] text-gray-300 uppercase border border-white/20 px-1.5 py-0.5 rounded font-medium bg-white/5">
                                            {activeContent.category === 'movie' ? 'Filme' : activeContent.category === 'series' ? 'Série' : 'TV'}
                                        </span>
                                    </div>

                                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 truncate leading-tight">
                                        {activeContent.title}
                                    </h3>
                                    <p className="text-sm text-gray-300 line-clamp-2 sm:line-clamp-2 md:line-clamp-3 mb-4 leading-relaxed">
                                        {activeContent.description || "Sem descrição disponível."}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mt-auto">
                                    <Button
                                        onClick={() => handlePlayContent(activeContent)}
                                        className="bg-primary hover:bg-primary/90 text-white font-semibold h-9 px-5 rounded-md transition-all hover:scale-105 shadow-lg shadow-primary/20 text-sm flex-1 sm:flex-none"
                                    >
                                        <Play className="w-4 h-4 mr-1.5 fill-current" /> Assistir
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={() => handleInfoContent(activeContent)}
                                        className="bg-transparent border-white/20 text-white hover:bg-white/10 hover:border-white h-9 px-4 rounded-md backdrop-blur-sm transition-all text-sm flex-1 sm:flex-none"
                                    >
                                        <Info className="w-4 h-4 mr-1.5" /> Detalhes
                                    </Button>

                                    <Button
                                        variant="ghost"
                                        onClick={() => handleToggleMyList(activeContent)}
                                        className="text-white hover:bg-white/10 h-9 w-9 rounded-full border border-white/10 flex-shrink-0"
                                        title={isInList ? "Remover da lista" : "Adicionar à lista"}
                                    >
                                        {isInList ? (
                                            <Check className="w-5 h-5 text-green-400" />
                                        ) : (
                                            <Plus className="w-5 h-5" />
                                        )}
                                        <span className="sr-only">Minha Lista</span>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
