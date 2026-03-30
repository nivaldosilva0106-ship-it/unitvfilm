import { useState, useEffect, useCallback } from "react";
import { getAllContents } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content } from "@/types/content";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { Loader2, Film } from "lucide-react";

export default function Canais24h() {
    const [contents, setContents] = useState<Content[]>([]);
    const [currentChannel, setCurrentChannel] = useState<Content | null>(null);
    const [loading, setLoading] = useState(true);

    const [tiktokVideoUrl, setTiktokVideoUrl] = useState<string | null>(null);
    const [isLoadingTikTok, setIsLoadingTikTok] = useState(false);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const all = await getAllContents();
                const canaisItems = all.filter(c => c.category === 'canais24h');
                setContents(canaisItems);

                if (canaisItems.length > 0) {
                    setCurrentChannel(canaisItems[0]); // Seleciona o primeiro por padrão
                }
            } catch (error) {
                console.error("Erro ao buscar canais 24h:", error);
                toast.error("Erro ao carregar canais");
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, []);

    // Helper to extract YouTube ID
    const getYoutubeId = (url?: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    // Helper to extract TikTok ID
    const getTikTokId = (url?: string) => {
        if (!url) return null;
        const regExp = /\/video\/(\d+)/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    };

    const videoUrl = currentChannel?.video_url || currentChannel?.internal_player_url;
    const tiktokUrl = currentChannel?.tiktok_url;
    
    const youtubeId = getYoutubeId(videoUrl);
    const tiktokId = getTikTokId(tiktokUrl);

    useEffect(() => {
        const fetchTiktokDirect = async () => {
            if (!tiktokUrl) {
                setTiktokVideoUrl(null);
                return;
            }

            setIsLoadingTikTok(true);
            try {
                const res = await fetch(`/api/tiktok?url=${encodeURIComponent(tiktokUrl)}`);
                const data = await res.json();
                if (data.url) {
                    setTiktokVideoUrl(data.url);
                } else {
                    console.error("TikTok API Error:", data.error);
                }
            } catch (error) {
                console.error("Fetch TikTok error:", error);
            } finally {
                setIsLoadingTikTok(false);
            }
        };

        fetchTiktokDirect();
    }, [tiktokUrl]);

    const handleChannelClick = (channel: Content) => {
        setCurrentChannel(channel);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-[#141414] text-white font-sans">
            <Header />

            <main className="pt-20 pb-10">
                {/* Player Principal */}
                <div className="w-full max-w-7xl mx-auto px-4 md:px-8 mb-8">
                    <div className="relative w-full bg-black rounded-lg overflow-hidden shadow-2xl aspect-video md:aspect-[21/9] lg:aspect-[21/9]">
                        
                        {loading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80">
                                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                                <span>A carregar canal...</span>
                            </div>
                        ) : !currentChannel ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
                                <div className="text-center">
                                    <Film className="w-16 h-16 text-primary mx-auto mb-4" />
                                    <h2 className="text-2xl font-bold">Nenhum canal disponível</h2>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* YouTube Player */}
                                {youtubeId && (
                                    <div className="absolute inset-0 w-full h-full pointer-events-auto">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=0&controls=1`}
                                            title="YouTube video player"
                                            className="w-full h-full border-0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            referrerPolicy="strict-origin-when-cross-origin"
                                            allowFullScreen
                                        ></iframe>
                                    </div>
                                )}

                                {/* HLS / MP4 / TikTok Direto Player */}
                                {!youtubeId && (tiktokVideoUrl || (videoUrl && !tiktokId)) && (
                                    <div className="absolute inset-0 w-full h-full z-10">
                                        <VideoPlayer
                                            url={tiktokVideoUrl || videoUrl || ""}
                                            title={currentChannel.title}
                                            poster={currentChannel.thumbnail_url}
                                            autoPlay={true}
                                        />
                                    </div>
                                )}

                                {/* TikTok Embed Fallback (Se a API falhar em dar URL direto) */}
                                {tiktokId && !tiktokVideoUrl && (
                                    <div className="absolute inset-0 w-full h-full z-10 flex items-center justify-center bg-black">
                                        {isLoadingTikTok ? (
                                             <div className="flex flex-col items-center">
                                                <Loader2 className="w-10 h-10 animate-spin text-primary mb-2" />
                                                <span className="text-sm">A aceder à transmissão...</span>
                                             </div>
                                        ) : (
                                            <iframe
                                                src={`https://www.tiktok.com/embed/v2/${tiktokId}`}
                                                className="w-full h-full border-0"
                                                allow="autoplay; encrypted-media; fullscreen"
                                            />
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Lista de Canais */}
                <div className="w-full max-w-7xl mx-auto px-4 md:px-8">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-2 h-8 bg-primary rounded"></div>
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight">Canais Disponíveis</h2>
                    </div>

                    {contents.length === 0 && !loading ? (
                        <p className="text-zinc-500">Nenhum canal na grelha de transmissão de momento.</p>
                    ) : (
                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                            {contents.map((channel) => (
                                <div 
                                    key={channel.id} 
                                    className={`relative aspect-[2/3] md:aspect-video rounded-lg overflow-hidden cursor-pointer group transition-all duration-300 ${currentChannel?.id === channel.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#141414] scale-[1.02]' : 'hover:scale-105 hover:ring-2 hover:ring-white/50'}`}
                                    onClick={() => handleChannelClick(channel)}
                                >
                                    <img 
                                        src={channel.thumbnail_url || "/placeholder.svg"} 
                                        alt={channel.title} 
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                                    <div className="absolute bottom-3 left-3 right-3">
                                        <h3 className="text-white font-medium text-sm line-clamp-2 md:text-base">
                                            {channel.title}
                                        </h3>
                                    </div>
                                    
                                    {/* Indicador de Selecionado Reproduzindo */}
                                    {currentChannel?.id === channel.id && (
                                        <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 bg-red-600/90 rounded text-[10px] font-bold">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                            LIVE
                                        </div>
                                    )}

                                    {/* Overlay de Hover */}
                                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 ${currentChannel?.id !== channel.id && 'group-hover:opacity-100'} transition-opacity`}>
                                        <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center backdrop-blur-sm">
                                            <Film className="w-5 h-5 text-white" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
