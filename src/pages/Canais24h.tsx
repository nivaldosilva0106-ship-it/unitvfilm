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

// Helper YouTube Player component - Now with unique instance ID to avoid conflicts in dual-player
const YouTubePlayer = ({ id, videoId, onEnded, startTime, onTimeUpdate, muted }: { id: string, videoId: string, onEnded: () => void, startTime?: number, onTimeUpdate?: (time: number, duration?: number) => void, muted?: boolean }) => {
    const playerRef = useRef<any>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const initPlayer = () => {
            if (!window.YT || !window.YT.Player) return;
            
            const playerElementId = `yt-player-${id}-${videoId}`;
            if (!document.getElementById(playerElementId)) return;

            playerRef.current = new window.YT.Player(playerElementId, {
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
                        if (muted) event.target.mute();
                        else event.target.unMute();

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
    }, [videoId]);

    // Handle external mute change (for buffering swap)
    useEffect(() => {
        if (playerRef.current && playerRef.current.mute) {
            if (muted) playerRef.current.mute();
            else playerRef.current.unMute();
        }
    }, [muted]);

    return <div id={`yt-player-${videoId}`} className="w-full h-full border-0 pointer-events-auto"></div>;
};

export default function Canais24h() {
    const [searchParams] = useSearchParams();
    const initialChannelId = searchParams.get("channelId");

    const [contents, setContents] = useState<Content[]>([]);
    const [currentChannel, setCurrentChannel] = useState<Content | null>(null);
    const [loading, setLoading] = useState(true);

    // --- Unified Sync Offset State ---
    const [serverOffset, setServerOffset] = useState(0);
    
    // --- Dual Player States (For Double Buffering) ---
    const [activePlayerId, setActivePlayerId] = useState<'A' | 'B'>('A');
    const [playerA, setPlayerA] = useState<{ url: string; startTime: number; title: string; isAd: boolean; originalProg?: Episode } | null>(null);
    const [playerB, setPlayerB] = useState<{ url: string; startTime: number; title: string; isAd: boolean; originalProg?: Episode } | null>(null);
    
    // UI Feedback States
    const [currentProgram, setCurrentProgram] = useState<Episode | null>(null);
    const [isAdMode, setIsAdMode] = useState(false);
    const [videoCurrentTime, setVideoCurrentTime] = useState(0);
    const [videoDuration, setVideoDuration] = useState(0);
    const [tiktokVideoUrlA, setTiktokVideoUrlA] = useState<string | null>(null);
    const [tiktokVideoUrlB, setTiktokVideoUrlB] = useState<string | null>(null);

    const programs = currentChannel?.episodes || [];

    // 1. Initial Load of Channels
    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const all = await getAllContents();
                const canaisItems = all.filter(c => c.category === 'canais24h');
                setContents(canaisItems);

                if (canaisItems.length > 0) {
                    const target = initialChannelId ? canaisItems.find(c => c.id === initialChannelId) : canaisItems[0];
                    setCurrentChannel(target || canaisItems[0]);
                }
            } catch (error) {
                console.error("Erro ao buscar canais:", error);
                toast.error("Erro ao carregar canais");
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [initialChannelId]);

    // 2. Initial Global Sync Offset Calculation
    useEffect(() => {
        const syncTime = async () => {
            try {
                const start = Date.now();
                const res = await fetch(window.location.origin, { method: 'HEAD' });
                const serverDateStr = res.headers.get('Date');
                if (serverDateStr) {
                    const serverTime = new Date(serverDateStr).getTime();
                    const delay = (Date.now() - start) / 2;
                    setServerOffset(serverTime + delay - Date.now());
                }
            } catch (e) {
                console.warn("[Sync] Usando relógio local como fallback.");
            }
        };
        syncTime();
    }, []);

    // 3. Helper: Get content for a specific timestamp
    const getScheduledContent = useCallback((timeShiftMs = 0) => {
        if (!currentChannel || programs.length === 0) return null;
        
        const SLOT_DURATION = 3600; // 1 Hour
        const nowSec = Math.floor((Date.now() + serverOffset + timeShiftMs) / 1000);
        const channelSalt = currentChannel.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const globalTime = nowSec + channelSalt;
        
        const progIdx = Math.floor(globalTime / SLOT_DURATION) % programs.length;
        const prog = programs[progIdx];
        const syncOffset = globalTime % SLOT_DURATION;
        const progDuration = prog.duration || 2700; // Default 45m
        
        if (syncOffset >= progDuration) {
            const intervalUrls = currentChannel.interval_urls || [];
            const adUrls = currentChannel.ad_urls || [];
            if (intervalUrls.length > 0 || adUrls.length > 0) {
                const gapOffset = syncOffset - progDuration;
                const slotIdx = Math.floor(gapOffset / 60);
                const isInterval = (slotIdx % 4 === 0) || adUrls.length === 0;
                const adUrl = isInterval && intervalUrls.length > 0 
                                ? intervalUrls[slotIdx % intervalUrls.length] 
                                : adUrls[slotIdx % adUrls.length];
                return {
                    url: adUrl || "",
                    startTime: gapOffset % 60,
                    title: isInterval ? 'Intervalo' : 'Publicidade',
                    isAd: true,
                    originalProg: prog
                };
            }
        }
        
        return {
            url: prog.internal_player_url || prog.url || "",
            startTime: syncOffset,
            title: prog.title || "",
            isAd: false,
            originalProg: prog
        };
    }, [currentChannel, programs, serverOffset]);

    // 4. TikTok Link Resolver
    const resolveTikTok = async (url: string) => {
        try {
            const res = await fetch(`/api/tiktok?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            return data.url || null;
        } catch {
            return null;
        }
    };

    // 5. Main Double Buffering Synchronization Loop
    useEffect(() => {
        if (!currentChannel || programs.length === 0) return;

        const syncLoop = async () => {
            const nowContent = getScheduledContent(0);
            if (!nowContent) return;

            // 1. Initialize First Player if everything is blank
            if (!playerA && !playerB) {
                setPlayerA(nowContent);
                setCurrentProgram(nowContent.originalProg || null);
                setIsAdMode(nowContent.isAd);
                if (nowContent.url.includes('tiktok.com')) {
                    const res = await resolveTikTok(nowContent.url);
                    setTiktokVideoUrlA(res);
                }
                return;
            }

            // 2. Pre-loading: Check what will play in 15 seconds
            const nextContent = getScheduledContent(15000);
            if (nextContent) {
                const active = activePlayerId === 'A' ? playerA : playerB;
                if (active && nextContent.url !== active.url) {
                    if (activePlayerId === 'A') {
                        if (!playerB || playerB.url !== nextContent.url) {
                            setPlayerB(nextContent);
                            if (nextContent.url.includes('tiktok.com')) {
                                const res = await resolveTikTok(nextContent.url);
                                setTiktokVideoUrlB(res);
                            }
                        }
                    } else {
                        if (!playerA || playerA.url !== nextContent.url) {
                            setPlayerA(nextContent);
                            if (nextContent.url.includes('tiktok.com')) {
                                const res = await resolveTikTok(nextContent.url);
                                setTiktokVideoUrlA(res);
                            }
                        }
                    }
                }
            }

            // 3. The Swap
            const currentInActive = activePlayerId === 'A' ? playerA : playerB;
            if (currentInActive && nowContent.url !== currentInActive.url) {
                const targetId = activePlayerId === 'A' ? 'B' : 'A';
                const targetPlayer = targetId === 'A' ? playerA : playerB;
                
                if (targetPlayer && targetPlayer.url === nowContent.url) {
                    setActivePlayerId(targetId);
                    setCurrentProgram(nowContent.originalProg || null);
                    setIsAdMode(nowContent.isAd);
                } else {
                    if (activePlayerId === 'A') setPlayerA(nowContent); else setPlayerB(nowContent);
                }
            }

            setVideoCurrentTime(nowContent.startTime);
            setVideoDuration(nowContent.isAd ? 60 : (nowContent.originalProg?.duration || 2700));
        };

        const interval = setInterval(syncLoop, 3000);
        return () => clearInterval(interval);
    }, [currentChannel, programs, activePlayerId, playerA, playerB, getScheduledContent]);

    const handleChannelClick = (channel: Content) => {
        setLoading(true);
        setCurrentChannel(channel);
        setPlayerA(null);
        setPlayerB(null);
        setActivePlayerId('A');
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const getYoutubeId = (url?: string) => {
        if (!url) return null;
        // Expanded regex for standard, shorts, live, etc.
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/|live\/)([^#\&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const formatTimeLabel = (offsetHours: number) => {
        const d = new Date();
        d.setMinutes(0);
        d.setSeconds(0);
        d.setHours(d.getHours() + offsetHours);
        return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
    };

    const getRemainingTime = () => {
        if (!videoDuration) return "Calculando...";
        const diff = videoDuration - videoCurrentTime;
        if (diff <= 0) return "Terminando...";
        return `Faltam ${Math.floor(diff / 60)} min`;
    };

    // Sub-component for each player instance
    const PlayerInstance = ({ id, content, tiktokUrl, active }: { id: string, content: any, tiktokUrl: string | null, active: boolean }) => {
        if (!content) return null;
        const ytId = getYoutubeId(content.url);
        
        return (
            <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${active ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'}`}>
                {ytId ? (
                    <YouTubePlayer 
                        id={id}
                        videoId={ytId} 
                        onEnded={() => {}} 
                        startTime={content.startTime}
                        onTimeUpdate={() => {}} 
                        muted={!active}
                    />
                ) : (
                    <VideoPlayer
                        url={tiktokUrl || content.url}
                        title={content.title}
                        poster={currentChannel?.thumbnail_url}
                        autoPlay={true}
                        startTime={content.startTime}
                        isLive={true}
                        onEnded={() => {}}
                        muted={!active}
                    />
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#141414] text-white font-sans">
            <Header />

            <main className="pt-20 pb-10">
                <div className="w-full max-w-7xl mx-auto px-4 md:px-8 mb-8">
                    <div className="relative w-full bg-black rounded-lg overflow-hidden shadow-2xl aspect-video">
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
                                <PlayerInstance id="A" content={playerA} tiktokUrl={tiktokVideoUrlA} active={activePlayerId === 'A'} />
                                <PlayerInstance id="B" content={playerB} tiktokUrl={tiktokVideoUrlB} active={activePlayerId === 'B'} />

                                {currentChannel.channel_logo_url && (
                                    <div className="absolute bottom-4 left-4 z-50 pointer-events-none select-none">
                                        <img src={currentChannel.channel_logo_url} alt="Logo" className="h-8 md:h-14 w-auto object-contain opacity-70 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                                    </div>
                                )}

                                <div className="absolute top-4 left-4 z-40 flex items-center gap-2 pointer-events-none">
                                    <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white animate-pulse">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div> AO VIVO
                                    </div>
                                    <div className="bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-medium text-white/90">
                                        {isAdMode ? "INTERVALO" : "24h Online"}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-8 mb-16 w-full max-w-7xl mx-auto px-4 md:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        <div className="lg:col-span-4 flex flex-col">
                            <div className="bg-zinc-800/80 backdrop-blur-xl border border-zinc-700/50 p-6 rounded-2xl shadow-2xl relative overflow-hidden group">
                                <span className="inline-block px-2 py-0.5 bg-primary/20 text-primary text-[9px] font-bold rounded mb-3 border border-primary/30 uppercase tracking-tighter italic">O que estás a ver</span>
                                <h2 className="text-xl font-bold text-white mb-2 leading-tight">
                                    {isAdMode ? "Intervalo Comercial" : (currentProgram ? currentProgram.title : currentChannel?.title)}
                                </h2>
                                <div className="mt-6 flex flex-col gap-2">
                                    <div className="flex justify-between items-end text-[10px] font-medium text-zinc-400 mb-1">
                                        <span>Tempo Restante</span>
                                        <span className="text-primary font-black tracking-tight">{getRemainingTime()}</span>
                                    </div>
                                    <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden p-[1px] border border-zinc-800">
                                        <div className="h-full bg-gradient-to-r from-primary to-orange-500 rounded-full transition-all duration-1000" style={{ width: `${videoDuration ? (videoCurrentTime / videoDuration) * 100 : 0}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-8 flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Guia de Transmissão</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {programs.length > 0 ? (
                                    Array.from({ length: 3 }).map((_, idx) => (
                                        <div key={idx} className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-2xl group hover:border-primary/50 transition-colors">
                                            <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">{idx === 0 ? 'Próximo' : 'A seguir'}</span>
                                            <h3 className="text-sm font-bold text-zinc-300 mt-2 truncate group-hover:text-white">{formatTimeLabel(idx + 1)} - Programa {idx + 1}</h3>
                                        </div>
                                    ))
                                ) : <p className="text-zinc-600 italic">Programação indisponível.</p>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-7xl mx-auto px-4 md:px-8">
                    <div className="flex items-center gap-3 mb-8">
                        <Tv className="w-6 h-6 text-primary" />
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Explorar Canais</h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6">
                        {contents.map((channel) => (
                            <div 
                                key={channel.id} 
                                className={`aspect-[4/3] rounded-2xl overflow-hidden cursor-pointer group relative border-2 ${currentChannel?.id === channel.id ? 'border-primary shadow-[0_0_20px_rgba(229,9,20,0.3)]' : 'border-zinc-800/50'}`} 
                                onClick={() => handleChannelClick(channel)}
                            >
                                <img src={channel.thumbnail_url} alt={channel.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
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
