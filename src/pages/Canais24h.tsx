import { useState, useEffect, useCallback, useRef } from "react";
import { getAllContents } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content, Episode } from "@/types/content";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { Loader2, Film, Tv, Play, Clock, Info } from "lucide-react";
import { useSearchParams } from "react-router-dom";

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

// YouTube Player with onEnded support
const YouTubePlayer = ({ videoId, onEnded, startTime, onTimeUpdate }: { videoId: string, onEnded: () => void, startTime?: number, onTimeUpdate?: (time: number, duration?: number) => void }) => {
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
                                onTimeUpdate(event.target.getCurrentTime(), event.target.getDuration());
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
    const [videoDuration, setVideoDuration] = useState(0);
    const [videoCurrentTime, setVideoCurrentTime] = useState(0);

    const hasSyncedRef = useRef(false);
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
        hasSyncedRef.current = false; // Reset sync flag para o novo canal

        if (!currentChannel || programs.length === 0) {
             setCurrentProgramIndex(0);
             setChannelStartTime(0);
        }
    }, [currentChannel]);

    // Deterministic Global Sync Logic (Updated continuously to avoid drift)
    const updateSync = useCallback(() => {
        if (!currentChannel || !programs.length) return;
        
        const SLOT_DURATION = 3600; // 1 hora
        const nowSec = Math.floor(Date.now() / 1000);
        const channelSalt = currentChannel.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const globalTime = nowSec + channelSalt;
        
        const syncIndex = Math.floor(globalTime / SLOT_DURATION) % programs.length;
        const syncOffset = globalTime % SLOT_DURATION;
        
        // --- PREVENT LOOPING/STUTTERING ---
        // Only update currentProgramIndex if it actually changed
        if (syncIndex !== currentProgramIndex) {
            setCurrentProgramIndex(syncIndex);
            setChannelStartTime(syncOffset); // Reset only on program change
        } else if (!hasSyncedRef.current) {
            // First time sync for the current session
            setChannelStartTime(syncOffset);
            hasSyncedRef.current = true;
        }
    }, [currentChannel, programs.length, currentProgramIndex]);

    // Initial sync and continuous refresh
    useEffect(() => {
        updateSync();
        const interval = setInterval(updateSync, 10000); // Check for program change every 10s
        return () => clearInterval(interval);
    }, [updateSync]);

    const handleTimeUpdate = useCallback((time: number, duration?: number) => {
        setVideoCurrentTime(time);
        if (duration) {
            setVideoDuration(duration);
            // We only "loop" if the video actually ends within the slot 
            // and the user first joins far into the slot
        }
    }, []);

    // Helper para formatar horario (HH:MM)
    const formatTimeLabel = (offsetHours: number) => {
        const d = new Date();
        d.setMinutes(0);
        d.setSeconds(0);
        d.setHours(d.getHours() + offsetHours);
        return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    };

    // Helper para tempo restante
    const getRemainingTime = () => {
        if (!videoDuration) return "Calculando...";
        const diff = videoDuration - videoCurrentTime;
        if (diff <= 0) return "Terminando...";
        const mins = Math.floor(diff / 60);
        return `Faltam ${mins} min`;
    };

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
        setChannelStartTime(0); 
        // Se o vídeo acabar naturalmente durante a sessão, o próximo começa do 0:00 (voto do user)
        if (programs.length > 0) {
            setCurrentProgramIndex(prev => {
                const next = prev + 1;
                return next >= programs.length ? 0 : next; 
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
                    <div className="relative w-full bg-black rounded-lg overflow-hidden shadow-2xl aspect-video">
                        
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
                                {/* Channel Logo Watermark */}
                                {currentChannel.channel_logo_url && (
                                    <div className="absolute top-4 right-4 z-50 pointer-events-none select-none">
                                        <img 
                                            src={currentChannel.channel_logo_url} 
                                            alt="Logo" 
                                            className="h-8 md:h-14 w-auto object-contain opacity-70 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                    </div>
                                )}

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

                {/* Guia de Programação Estilo Descodificador (ZAP/DSTV) */}
                <div className="mt-8 mb-16 w-full max-w-7xl mx-auto px-4 md:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        
                        {/* Bloco Ativo (O que está a dar agora) */}
                        <div className="lg:col-span-4 flex flex-col">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="w-2 h-2 bg-red-600 rounded-full animate-ping"></div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Canal Ativo</span>
                            </div>
                            
                            <div className="bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 backdrop-blur-xl border border-zinc-700/50 p-6 rounded-2xl shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Tv className="w-24 h-24" />
                                </div>
                                
                                <span className="inline-block px-2 py-0.5 bg-primary/20 text-primary text-[9px] font-bold rounded mb-3 border border-primary/30 uppercase tracking-tighter">Estás a ver agora</span>
                                <h2 className="text-xl font-bold text-white mb-2 leading-tight">
                                    {currentProgram ? currentProgram.title : currentChannel?.title}
                                </h2>
                                
                                <div className="mt-6 flex flex-col gap-2">
                                    <div className="flex justify-between items-end text-[10px] font-medium text-zinc-400 mb-1 uppercase tracking-widest">
                                        <span>Progresso</span>
                                        <span className="text-primary font-bold">{getRemainingTime()}</span>
                                    </div>
                                    <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-[1px] border border-zinc-800">
                                        <div 
                                            className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full shadow-[0_0_10px_rgba(234,23,43,0.5)] transition-all duration-500" 
                                            style={{ width: `${videoDuration ? (videoCurrentTime / videoDuration) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-[9px] font-mono text-zinc-500 mt-1">
                                        <span>{formatTimeLabel(0)}</span>
                                        <span>{formatTimeLabel(1)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Próximos Programas (EPG Grid) */}
                        <div className="lg:col-span-8 flex flex-col">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-primary" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Grelha de Programação</span>
                                </div>
                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Seguinte na Emissão</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {programs.length > 1 ? (
                                    Array.from({ length: Math.min(3, programs.length - 1) }).map((_, idx) => {
                                        const nextIndex = (currentProgramIndex + 1 + idx) % programs.length;
                                        const nextProg = programs[nextIndex];
                                        return (
                                            <div 
                                                key={`next-${nextProg.title}-${idx}`} 
                                                className="bg-zinc-900/40 hover:bg-primary/5 backdrop-blur-xl border border-zinc-800/50 hover:border-primary/30 p-5 rounded-2xl transition-all duration-500 group cursor-default relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl -mr-10 -mt-10 group-hover:bg-primary/10 transition-colors"></div>
                                                
                                                <div className="flex items-center justify-between mb-4 relative z-10">
                                                    <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase tracking-tighter border border-primary/20">Próximo</span>
                                                    <span className="text-[10px] font-mono font-bold text-zinc-500 group-hover:text-zinc-300 transition-colors uppercase">{formatTimeLabel(idx + 1)}</span>
                                                </div>
                                                
                                                <h3 className="text-sm font-bold text-zinc-300 line-clamp-2 leading-tight group-hover:text-white transition-colors relative z-10 min-h-[2.5rem]">
                                                    {nextProg.title}
                                                </h3>
                                                
                                                <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between relative z-10">
                                                    <div className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-500 uppercase">
                                                        <Tv className="w-3 h-3" />
                                                        <span>24h Live</span>
                                                    </div>
                                                    <div className="w-1.5 h-1.5 bg-zinc-800 rounded-full group-hover:bg-primary transition-colors"></div>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="col-span-1 md:col-span-3 py-16 flex flex-col items-center justify-center bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800/50 backdrop-blur-sm">
                                        <div className="w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                                            <Info className="w-6 h-6 text-zinc-600" />
                                        </div>
                                        <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest">Sem mais conteúdos agendados</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

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
