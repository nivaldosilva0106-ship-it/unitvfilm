import { useState, useEffect, useCallback, useRef } from "react";
import { getAllContents } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content, Episode } from "@/types/content";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { Loader2, Film, Tv, Play } from "lucide-react";
import { useSearchParams } from "react-router-dom";

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

// YouTube Player with onEnded support
const YouTubePlayer = ({ videoId, onEnded, startTime, onTimeUpdate }: { videoId: string, onEnded: () => void, startTime?: number, onTimeUpdate?: (time: number) => void }) => {
    const playerRef = useRef<any>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const initPlayer = () => {
            if (!window.YT || !window.YT.Player) return;
            
            playerRef.current = new window.YT.Player(`yt-player-${videoId}`, {
                videoId: videoId,
                playerVars: { 
                    autoplay: 1, 
                    controls: 0,
                    disablekb: 1,
                    rel: 0,
                    start: startTime ? Math.floor(startTime) : 0,
                    modestbranding: 1
                },
                events: {
                    onReady: (event: any) => {
                        if (onTimeUpdate) {
                            intervalRef.current = setInterval(() => {
                                if (event.target && event.target.getCurrentTime) {
                                    onTimeUpdate(event.target.getCurrentTime());
                                }
                            }, 2000);
                        }
                    },
                    onStateChange: (event: any) => {
                        if (event.data === window.YT.PlayerState.ENDED) {
                            onEnded();
                        }
                    }
                }
            });
        };

        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            document.body.appendChild(tag);
            window.onYouTubeIframeAPIReady = initPlayer;
        } else {
            initPlayer();
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (playerRef.current && playerRef.current.destroy) {
                playerRef.current.destroy();
            }
        };
    }, [videoId, onEnded]);

    return <div id={`yt-player-${videoId}`} className="w-full h-full border-0 pointer-events-auto"></div>;
};

export default function Canais24h() {
    const [searchParams] = useSearchParams();
    const initialChannelId = searchParams.get("channelId");

    const [contents, setContents] = useState<Content[]>([]);
    const [currentChannel, setCurrentChannel] = useState<Content | null>(null);
    const [currentProgramIndex, setCurrentProgramIndex] = useState(0);
    const [channelStartTime, setChannelStartTime] = useState(0);

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
                    if (initialChannelId) {
                        const target = canaisItems.find(c => c.id === initialChannelId);
                        if (target) {
                            setCurrentChannel(target);
                        } else {
                            setCurrentChannel(canaisItems[0]);
                        }
                    } else {
                        setCurrentChannel(canaisItems[0]); // Seleciona o primeiro por padrão
                    }
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

    // Get current program if using episodes/programming blocks
    const programs = currentChannel?.episodes || [];
    const currentProgram = programs.length > 0 ? programs[currentProgramIndex] : null;

    useEffect(() => {
        // Quando o canal muda
        setTiktokVideoUrl(null);
        if (!currentChannel || programs.length === 0) {
             setCurrentProgramIndex(0);
             setChannelStartTime(0);
             return;
        }

        const storageKey = `live_state_${currentChannel.id}`;
        const savedState = localStorage.getItem(storageKey);
        
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                const elapsedSinceLeaveSec = Math.floor((Date.now() - parsed.timestamp) / 1000);
                
                // Retoma do index exato com o avanço correspondente ao tempo em falta
                setCurrentProgramIndex(parsed.programIndex >= 0 && parsed.programIndex < programs.length ? parsed.programIndex : 0);
                
                // Se a ausencia foi muito longa (várias horas) pode exceder o video, mas a API "onEnded" tratará do salto mal tente carregar
                setChannelStartTime(parsed.currentTime + elapsedSinceLeaveSec);
            } catch (e) {
                setCurrentProgramIndex(0);
                setChannelStartTime(0);
            }
        } else {
            // Utilizador nunca entrou no canal
            setCurrentProgramIndex(0);
            setChannelStartTime(0);
        }
    }, [currentChannel]);

    const handleTimeUpdate = useCallback((time: number) => {
        if (!currentChannel) return;
        const storageKey = `live_state_${currentChannel.id}`;
        localStorage.setItem(storageKey, JSON.stringify({
            programIndex: currentProgramIndex,
            currentTime: time,
            timestamp: Date.now()
        }));
    }, [currentChannel, currentProgramIndex]);

    // Use current program URLs if available, fallback to channel level URLs
    const videoUrl = currentProgram?.internal_player_url || currentProgram?.url || currentChannel?.video_url || currentChannel?.internal_player_url;
    const tiktokUrl = currentProgram?.tiktok_url || currentChannel?.tiktok_url;
    
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
                }
            } catch (err) {
                console.error("TikTok feed error:", err);
            } finally {
                setIsLoadingTikTok(false);
            }
        };
        fetchTiktokDirect();
    }, [tiktokUrl]);

    const handleProgramEnded = useCallback(() => {
        setChannelStartTime(0); // Normalizar reprodução sequencial a partir de agora
        if (programs.length > 0) {
            setCurrentProgramIndex(prev => {
                const next = prev + 1;
                return next >= programs.length ? 0 : next; // Loop 24/7
            });
        }
    }, [programs.length]);

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
                                {/* AO VIVO Indicator Overlay */}
                                <div className="absolute top-4 left-4 z-40 flex items-center gap-2 pointer-events-none">
                                    <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white animate-pulse">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                                        AO VIVO
                                    </div>
                                    <div className="bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-medium text-white/90">
                                        24h Online
                                    </div>
                                </div>

                                {/* YouTube Player */}
                                {youtubeId && (
                                    <div className="absolute inset-0 w-full h-full pointer-events-auto">
                                        <div className="absolute top-4 left-4 right-4 z-20 pointer-events-none">
                                            <h2 className="text-white font-bold text-sm md:text-lg drop-shadow-lg line-clamp-1">
                                                Você está assistindo: {currentProgram ? currentProgram.title : currentChannel.title}
                                            </h2>
                                        </div>
                                        <YouTubePlayer 
                                            videoId={youtubeId} 
                                            onEnded={handleProgramEnded} 
                                            startTime={channelStartTime}
                                            onTimeUpdate={handleTimeUpdate} 
                                        />
                                    </div>
                                )}

                                {/* HLS / MP4 / TikTok Direto Player */}
                                {!youtubeId && (tiktokVideoUrl || (videoUrl && !tiktokId)) && (
                                    <div className="absolute inset-0 w-full h-full z-10">
                                        <VideoPlayer
                                            url={tiktokVideoUrl || videoUrl || ""}
                                            title={`Você está assistindo: ${currentProgram ? currentProgram.title : currentChannel.title}`}
                                            poster={currentChannel.thumbnail_url}
                                            autoPlay={true}
                                            onEnded={handleProgramEnded}
                                            onTimeUpdate={handleTimeUpdate}
                                            startTime={channelStartTime}
                                            isLive={true}
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

                {/* Programação a Seguir (Up Next) */}
                {programs.length > 1 && (
                    <div className="mt-8 mb-12 w-full max-w-7xl mx-auto px-4 md:px-8">
                        <div className="flex flex-col gap-1 mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(234,23,43,0.5)]"></div>
                                <h2 className="text-xl font-bold tracking-tight text-white uppercase text-sm">Programação de Hoje</h2>
                            </div>
                            <p className="text-xs text-zinc-500 uppercase tracking-widest ml-4.5">Próximos Blocos</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {Array.from({ length: Math.min(4, programs.length - 1) }).map((_, idx) => {
                                const nextIndex = (currentProgramIndex + 1 + idx) % programs.length;
                                const nextProg = programs[nextIndex];
                                return (
                                    <div 
                                        key={`next-${nextProg.title}-${idx}`} 
                                        className="group flex flex-col gap-3 bg-zinc-900/40 hover:bg-zinc-800/60 p-4 rounded-xl border border-zinc-800/50 transition-all duration-300 hover:border-primary/30 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
                                            <Tv className="w-10 h-10" />
                                        </div>
                                        <div className="flex items-center justify-between text-[10px] font-bold text-primary tracking-tighter uppercase mb-1">
                                            <span>Bloco {nextIndex + 1}</span>
                                            <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400 font-medium">Em breve</span>
                                        </div>
                                        <h3 className="text-zinc-200 font-semibold line-clamp-2 leading-snug group-hover:text-white transition-colors">
                                            {nextProg.title}
                                        </h3>
                                        <div className="mt-2 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-white/10 w-0 group-hover:w-full transition-all duration-1000"></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Lista de Canais */}
                <div className="w-full max-w-7xl mx-auto px-4 md:px-8">
                    <div className="flex flex-col gap-1 mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-8 bg-primary rounded-full shadow-[0_0_15px_rgba(234,23,43,0.3)]"></div>
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Escolher Canal</h2>
                        </div>
                    </div>

                    {contents.length === 0 && !loading ? (
                        <p className="text-zinc-500">Nenhum canal na grelha de transmissão de momento.</p>
                    ) : (
                        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                            {contents.map((channel) => (
                                <div 
                                    key={channel.id} 
                                    className={`relative aspect-[2/3] md:aspect-video rounded-xl overflow-hidden cursor-pointer group transition-all duration-500 ${currentChannel?.id === channel.id ? 'ring-2 ring-primary ring-offset-4 ring-offset-[#141414] scale-[1.03]' : 'hover:scale-105 hover:ring-2 hover:ring-white/30'}`}
                                    onClick={() => handleChannelClick(channel)}
                                >
                                    <img 
                                        src={channel.thumbnail_url || "/placeholder.svg"} 
                                        alt={channel.title} 
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-black/10 to-transparent flex flex-col justify-end p-3">
                                        <div className={`w-8 h-8 rounded-full bg-primary/90 flex items-center justify-center mb-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 shadow-lg ${currentChannel?.id === channel.id ? 'translate-y-0 opacity-100' : ''}`}>
                                            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                                        </div>
                                        <h3 className="text-white font-bold text-sm md:text-base leading-tight drop-shadow-md">
                                            {channel.title}
                                        </h3>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_5px_rgba(220,38,38,0.8)]"></span>
                                            <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">LIVE</span>
                                        </div>
                                    </div>
                                    
                                    {currentChannel?.id === channel.id && (
                                        <div className="absolute top-3 right-3 bg-primary px-2 py-0.5 rounded text-[9px] font-black uppercase text-white shadow-xl">
                                            Agora
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
