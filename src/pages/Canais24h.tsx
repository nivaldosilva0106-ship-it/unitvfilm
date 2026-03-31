import { useState, useEffect, useCallback, useRef, memo } from "react";
import { getAllContents } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content, Episode } from "@/types/content";
import { VideoPlayer } from "@/components/VideoPlayer";
import { toast } from "sonner";
import { Loader2, Film, Tv, Clock } from "lucide-react";
import { useSearchParams } from "react-router-dom";

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

// ============================================================
// YOUTUBE PLAYER — defined OUTSIDE the main component to prevent re-mounts
// ============================================================
const YouTubePlayer = memo(({ id, videoId, onEnded, startTime, onTimeUpdate, muted }: {
    id: string;
    videoId: string;
    onEnded: () => void;
    startTime?: number;
    onTimeUpdate?: (time: number, duration?: number) => void;
    muted?: boolean;
}) => {
    const playerRef = useRef<any>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const initPlayer = () => {
            if (!window.YT || !window.YT.Player) return;
            const elId = `yt-player-${id}-${videoId}`;
            if (!document.getElementById(elId)) return;

            playerRef.current = new window.YT.Player(elId, {
                videoId,
                playerVars: {
                    autoplay: 1,
                    controls: 0,
                    disablekb: 1,
                    rel: 0,
                    start: startTime ? Math.floor(startTime) : 0,
                    modestbranding: 1,
                },
                events: {
                    onReady: (e: any) => {
                        if (muted) e.target.mute(); else e.target.unMute();
                        if (onTimeUpdate) {
                            intervalRef.current = setInterval(() => {
                                if (e.target?.getCurrentTime) {
                                    onTimeUpdate(e.target.getCurrentTime(), e.target.getDuration());
                                }
                            }, 1000);
                        }
                    },
                    onStateChange: (e: any) => {
                        if (e.data === window.YT.PlayerState.ENDED) onEnded();
                    },
                },
            });
        };

        if (!window.YT) {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            document.body.appendChild(tag);
            window.onYouTubeIframeAPIReady = initPlayer;
        } else {
            initPlayer();
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (playerRef.current?.destroy) playerRef.current.destroy();
        };
    }, [videoId, id]);

    useEffect(() => {
        if (playerRef.current?.mute) {
            if (muted) playerRef.current.mute(); else playerRef.current.unMute();
        }
    }, [muted]);

    return <div id={`yt-player-${id}-${videoId}`} className="w-full h-full border-0 pointer-events-auto" />;
});
YouTubePlayer.displayName = "YouTubePlayer";

// ============================================================
// PLAYER INSTANCE — defined OUTSIDE as memoized component
// ============================================================
const PlayerSlot = memo(({ id, content, tiktokUrl, active, channelThumb, onTimeUpdate, onEnded }: {
    id: string;
    content: { url: string; startTime: number; title: string } | null;
    tiktokUrl: string | null;
    active: boolean;
    channelThumb?: string;
    onTimeUpdate?: (time: number, duration?: number) => void;
    onEnded?: () => void;
}) => {
    if (!content) return null;

    const getYoutubeId = (url?: string) => {
        if (!url) return null;
        const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/|live\/)([^#&?]*).*/);
        return m && m[2].length === 11 ? m[2] : null;
    };

    const ytId = getYoutubeId(content.url);

    return (
        <div className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${active ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"}`}>
            {ytId ? (
                <YouTubePlayer
                    id={id}
                    videoId={ytId}
                    onEnded={onEnded || (() => {})}
                    startTime={content.startTime}
                    onTimeUpdate={active ? onTimeUpdate : undefined}
                    muted={!active}
                />
            ) : (
                <VideoPlayer
                    url={tiktokUrl || content.url}
                    title={content.title}
                    poster={channelThumb}
                    autoPlay={true}
                    startTime={content.startTime}
                    isLive={true}
                    onEnded={onEnded || (() => {})}
                    onTimeUpdate={active ? onTimeUpdate : undefined}
                    muted={!active}
                />
            )}
        </div>
    );
});
PlayerSlot.displayName = "PlayerSlot";

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================
export default function Canais24h() {
    const [searchParams] = useSearchParams();
    const initialChannelId = searchParams.get("channelId");

    const [contents, setContents] = useState<Content[]>([]);
    const [currentChannel, setCurrentChannel] = useState<Content | null>(null);
    const [loading, setLoading] = useState(true);

    // Sync
    const serverOffsetRef = useRef(0);

    // Dual Player — use refs for content to avoid re-renders
    const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
    const [slotA, setSlotA] = useState<{ url: string; startTime: number; title: string; isAd: boolean } | null>(null);
    const [slotB, setSlotB] = useState<{ url: string; startTime: number; title: string; isAd: boolean } | null>(null);
    const [tiktokA, setTiktokA] = useState<string | null>(null);
    const [tiktokB, setTiktokB] = useState<string | null>(null);

    // UI display states
    const [currentProgramTitle, setCurrentProgramTitle] = useState("");
    const [isAdMode, setIsAdMode] = useState(false);
    const [nextPrograms, setNextPrograms] = useState<any[]>([]);

    // Real playback tracking from the ACTIVE player's onTimeUpdate callback
    const [realTime, setRealTime] = useState(0);
    const [realDuration, setRealDuration] = useState(0);

    // Refs to track what's loaded to prevent redundant state updates
    const loadedUrlRef = useRef<string>("");
    const bufferUrlRef = useRef<string>("");
    const isSwappingRef = useRef(false);
    const hasInitializedRef = useRef(false);

    const programs = currentChannel?.episodes || [];

    // ---- 1. Load channels ----
    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const all = await getAllContents();
                const canais = all.filter((c) => c.category === "canais24h");
                setContents(canais);
                if (canais.length > 0) {
                    const target = initialChannelId ? canais.find((c) => c.id === initialChannelId) : canais[0];
                    setCurrentChannel(target || canais[0]);
                }
            } catch {
                toast.error("Erro ao carregar canais");
            } finally {
                setLoading(false);
            }
        })();
    }, [initialChannelId]);

    // ---- 2. Server time sync (once) ----
    useEffect(() => {
        (async () => {
            try {
                const t0 = Date.now();
                const res = await fetch(window.location.origin, { method: "HEAD" });
                const d = res.headers.get("Date");
                if (d) {
                    const st = new Date(d).getTime();
                    serverOffsetRef.current = st + (Date.now() - t0) / 2 - Date.now();
                }
            } catch { /* local fallback */ }
        })();
    }, []);

    // ---- 3. Scheduling engine (pure function, no state updates) ----
    const getScheduledContent = useCallback((shiftMs = 0) => {
        if (!currentChannel || programs.length === 0) return null;

        const GAP = 180; // 3 min gap
        const nowSec = Math.floor((Date.now() + serverOffsetRef.current + shiftMs) / 1000);

        let total = 0;
        const mapped = programs.map((p) => {
            const s = total;
            const dur = p.duration || 1800;
            total = s + dur + GAP;
            return { ...p, cycleStart: s, cycleEnd: s + dur, dur };
        });

        const salt = currentChannel.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
        const t = (nowSec + salt) % total;

        for (const prog of mapped) {
            if (t >= prog.cycleStart && t < prog.cycleEnd) {
                return {
                    url: prog.internal_player_url || prog.url || "",
                    startTime: t - prog.cycleStart,
                    title: prog.title || "",
                    isAd: false,
                    duration: prog.dur,
                    nextPrograms: mapped.filter((p) => p.cycleStart > prog.cycleStart).slice(0, 3),
                };
            }
            if (t >= prog.cycleEnd && t < prog.cycleEnd + GAP) {
                const iUrls = currentChannel.interval_urls || [];
                const aUrls = currentChannel.ad_urls || [];
                const gap = t - prog.cycleEnd;
                const si = Math.floor(gap / 60);
                const isInt = (si % 2 === 0) || aUrls.length === 0;
                const adUrl = isInt && iUrls.length > 0
                    ? iUrls[si % iUrls.length]
                    : aUrls[si % aUrls.length];
                return {
                    url: adUrl || "",
                    startTime: gap % 60,
                    title: isInt ? "Intervalo" : "Publicidade",
                    isAd: true,
                    duration: 60,
                    nextPrograms: mapped.filter((p) => p.cycleStart > prog.cycleStart).slice(0, 3),
                };
            }
        }
        return null;
    }, [currentChannel, programs]);

    // TikTok resolver
    const resolveTikTok = async (url: string) => {
        try {
            const r = await fetch(`/api/tiktok?url=${encodeURIComponent(url)}`);
            const d = await r.json();
            return d.url || null;
        } catch { return null; }
    };

    // ---- 4. INITIAL LOAD — run once when channel changes ----
    useEffect(() => {
        if (!currentChannel || programs.length === 0) return;

        hasInitializedRef.current = false;
        loadedUrlRef.current = "";
        bufferUrlRef.current = "";

        const content = getScheduledContent(0);
        if (!content) return;

        loadedUrlRef.current = content.url;
        setSlotA({ url: content.url, startTime: content.startTime, title: content.title, isAd: content.isAd });
        setSlotB(null);
        setActiveSlot("A");
        setCurrentProgramTitle(content.title);
        setIsAdMode(content.isAd);
        setRealDuration(content.duration);
        setNextPrograms(content.nextPrograms || []);
        setLoading(false);
        hasInitializedRef.current = true;

        if (content.url.includes("tiktok.com")) {
            resolveTikTok(content.url).then(setTiktokA);
        } else {
            setTiktokA(null);
        }
    }, [currentChannel, programs, getScheduledContent]);

    // ---- 5. onTimeUpdate from active player — THIS drives transitions ----
    const handleActiveTimeUpdate = useCallback((time: number, duration?: number) => {
        setRealTime(time);
        if (duration && duration > 0) setRealDuration(duration);

        const remaining = (duration || realDuration) - time;

        // When 5 seconds remain — pre-load the next content into the buffer slot
        if (remaining <= 5 && remaining > 0 && !isSwappingRef.current) {
            const next = getScheduledContent(6000); // what plays in 6 seconds
            if (next && next.url !== loadedUrlRef.current && next.url !== bufferUrlRef.current) {
                bufferUrlRef.current = next.url;

                if (activeSlot === "A") {
                    setSlotB({ url: next.url, startTime: 0, title: next.title, isAd: next.isAd });
                    if (next.url.includes("tiktok.com")) {
                        resolveTikTok(next.url).then(setTiktokB);
                    } else {
                        setTiktokB(null);
                    }
                } else {
                    setSlotA({ url: next.url, startTime: 0, title: next.title, isAd: next.isAd });
                    if (next.url.includes("tiktok.com")) {
                        resolveTikTok(next.url).then(setTiktokA);
                    } else {
                        setTiktokA(null);
                    }
                }
            }
        }
    }, [activeSlot, getScheduledContent, realDuration]);

    // ---- 6. onEnded from active player — perform the swap ----
    const handleActiveEnded = useCallback(() => {
        if (isSwappingRef.current) return;
        isSwappingRef.current = true;

        const next = getScheduledContent(0);
        if (!next) { isSwappingRef.current = false; return; }

        const newSlot = activeSlot === "A" ? "B" : "A";
        const bufferContent = newSlot === "A" ? slotA : slotB;

        // If the buffer already has the right content, just swap
        if (bufferContent && bufferContent.url === next.url) {
            loadedUrlRef.current = next.url;
            bufferUrlRef.current = "";
            setActiveSlot(newSlot);
            setCurrentProgramTitle(next.title);
            setIsAdMode(next.isAd);
            setRealDuration(next.duration);
            setNextPrograms(next.nextPrograms || []);
        } else {
            // Load directly into the current slot
            loadedUrlRef.current = next.url;
            if (activeSlot === "A") {
                setSlotA({ url: next.url, startTime: next.startTime, title: next.title, isAd: next.isAd });
                if (next.url.includes("tiktok.com")) resolveTikTok(next.url).then(setTiktokA);
            } else {
                setSlotB({ url: next.url, startTime: next.startTime, title: next.title, isAd: next.isAd });
                if (next.url.includes("tiktok.com")) resolveTikTok(next.url).then(setTiktokB);
            }
            setCurrentProgramTitle(next.title);
            setIsAdMode(next.isAd);
            setRealDuration(next.duration);
            setNextPrograms(next.nextPrograms || []);
        }

        setRealTime(0);
        setTimeout(() => { isSwappingRef.current = false; }, 2000);
    }, [activeSlot, slotA, slotB, getScheduledContent]);

    // ---- 7. Lightweight sync check — only checks for DRIFT, does NOT touch players ----
    useEffect(() => {
        if (!currentChannel || programs.length === 0 || !hasInitializedRef.current) return;

        const driftCheck = () => {
            const now = getScheduledContent(0);
            if (!now) return;

            // Update EPG
            if (now.nextPrograms) setNextPrograms(now.nextPrograms);

            // Only force-correct if the content has CHANGED (e.g., user was away)
            if (now.url !== loadedUrlRef.current && !isSwappingRef.current) {
                loadedUrlRef.current = now.url;
                if (activeSlot === "A") {
                    setSlotA({ url: now.url, startTime: now.startTime, title: now.title, isAd: now.isAd });
                    if (now.url.includes("tiktok.com")) resolveTikTok(now.url).then(setTiktokA);
                    else setTiktokA(null);
                } else {
                    setSlotB({ url: now.url, startTime: now.startTime, title: now.title, isAd: now.isAd });
                    if (now.url.includes("tiktok.com")) resolveTikTok(now.url).then(setTiktokB);
                    else setTiktokB(null);
                }
                setCurrentProgramTitle(now.title);
                setIsAdMode(now.isAd);
                setRealDuration(now.duration);
            }
        };

        const iv = setInterval(driftCheck, 10000); // Check every 10s, not 3s
        return () => clearInterval(iv);
    }, [currentChannel, programs, activeSlot, getScheduledContent]);

    // ---- Helpers ----
    const handleChannelClick = (channel: Content) => {
        setLoading(true);
        setCurrentChannel(channel);
        setSlotA(null);
        setSlotB(null);
        setActiveSlot("A");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const getRemainingTime = () => {
        if (!realDuration) return "Calculando...";
        const diff = realDuration - realTime;
        if (diff <= 0) return "Terminando...";
        const m = Math.floor(diff / 60);
        const s = Math.floor(diff % 60);
        return m > 0 ? `Faltam ${m} min` : `Faltam ${s} seg`;
    };

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="min-h-screen bg-[#141414] text-white font-sans">
            <Header />
            <main className="pt-20 pb-10">
                {/* Player Area */}
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
                                <PlayerSlot
                                    id="A"
                                    content={slotA}
                                    tiktokUrl={tiktokA}
                                    active={activeSlot === "A"}
                                    channelThumb={currentChannel.thumbnail_url}
                                    onTimeUpdate={activeSlot === "A" ? handleActiveTimeUpdate : undefined}
                                    onEnded={activeSlot === "A" ? handleActiveEnded : undefined}
                                />
                                <PlayerSlot
                                    id="B"
                                    content={slotB}
                                    tiktokUrl={tiktokB}
                                    active={activeSlot === "B"}
                                    channelThumb={currentChannel.thumbnail_url}
                                    onTimeUpdate={activeSlot === "B" ? handleActiveTimeUpdate : undefined}
                                    onEnded={activeSlot === "B" ? handleActiveEnded : undefined}
                                />

                                {/* Logo Watermark */}
                                {currentChannel.channel_logo_url && (
                                    <div className="absolute bottom-4 left-4 z-50 pointer-events-none select-none">
                                        <img
                                            src={currentChannel.channel_logo_url}
                                            alt="Logo"
                                            className="h-8 md:h-14 w-auto object-contain opacity-70 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                                        />
                                    </div>
                                )}

                                {/* Live Badge */}
                                <div className="absolute top-4 left-4 z-40 flex items-center gap-2 pointer-events-none">
                                    <div className="flex items-center gap-1.5 bg-red-600/90 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white animate-pulse">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full" /> AO VIVO
                                    </div>
                                    <div className="bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-medium text-white/90">
                                        {isAdMode ? "INTERVALO" : "24h Online"}
                                    </div>
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
                                <h2 className="text-xl font-bold text-white mb-2 leading-tight">
                                    {isAdMode ? "Intervalo Comercial" : currentProgramTitle || currentChannel?.title}
                                </h2>
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
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Guia de Transmissão</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {nextPrograms.length > 0
                                    ? nextPrograms.map((prog, idx) => (
                                          <div key={idx} className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-2xl group hover:border-primary/50 transition-colors">
                                              <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                                                  {idx === 0 ? "Próximo" : "A seguir"}
                                              </span>
                                              <h3 className="text-sm font-bold text-zinc-300 mt-2 truncate group-hover:text-white">
                                                  {prog.title}
                                              </h3>
                                          </div>
                                      ))
                                    : programs.slice(0, 3).map((prog, idx) => (
                                          <div key={idx} className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-2xl group hover:border-primary/50 transition-colors">
                                              <span className="text-[9px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">
                                                  {idx === 0 ? "Próximo" : "A seguir"}
                                              </span>
                                              <h3 className="text-sm font-bold text-zinc-300 mt-2 truncate group-hover:text-white">{prog.title}</h3>
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
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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
