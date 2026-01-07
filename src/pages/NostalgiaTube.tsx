import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAllContents } from "@/lib/firebase";
import { Header } from "@/components/Header";
import { Content } from "@/types/content";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";

// Declare YouTube IFrame API types
declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: () => void;
    }
}

export default function NostalgiaTube(): JSX.Element {
    const { id } = useParams();
    const navigate = useNavigate();
    const [contents, setContents] = useState<Content[]>([]);
    const [currentContent, setCurrentContent] = useState<Content | null>(null);
    const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    // YouTube Player State
    const playerRef = useRef<any>(null);
    const [player, setPlayer] = useState<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [apiReady, setApiReady] = useState(false);

    // Load YouTube IFrame API
    useEffect(() => {
        if (!window.YT) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = () => {
                setApiReady(true);
            };
        } else {
            setApiReady(true);
        }
    }, []);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const all = await getAllContents();
                const nostalgiaItems = all.filter(c => c.category === 'nostalgia');
                setContents(nostalgiaItems);

                if (id) {
                    const found = nostalgiaItems.find(c => c.id === id);
                    if (found) {
                        setCurrentContent(found);
                        setCurrentEpisodeIndex(0);
                    }
                } else if (nostalgiaItems.length > 0) {
                    setCurrentContent(nostalgiaItems[0]);
                    navigate(`/nostalgia/${nostalgiaItems[0].id}`, { replace: true });
                }
            } catch (error) {
                console.error("Error fetching nostalgia content:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [id, navigate]);

    // Helper to extract YouTube ID
    const getYoutubeId = (url?: string) => {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const currentEpisode = currentContent?.episodes?.[currentEpisodeIndex];
    const videoUrl = currentEpisode?.url || currentContent?.video_url;
    const youtubeId = getYoutubeId(videoUrl);

    // Initialize YouTube Player
    useEffect(() => {
        if (apiReady && youtubeId && !player) {
            const newPlayer = new window.YT.Player('youtube-player', {
                videoId: youtubeId,
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    modestbranding: 1,
                    rel: 0,
                    showinfo: 0,
                    iv_load_policy: 3,
                    fs: 1,
                    enablejsapi: 1
                },
                events: {
                    onReady: () => {
                        // Player is ready - can now safely use player methods
                    },
                    onStateChange: (event: any) => {
                        setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
                    }
                }
            });
            setPlayer(newPlayer);
        } else if (player && youtubeId && typeof player.loadVideoById === 'function') {
            // Only call loadVideoById if the player is ready and has the method
            player.loadVideoById(youtubeId);
        }
    }, [apiReady, youtubeId, player]);

    // Player Controls
    const togglePlay = () => {
        if (player) {
            if (isPlaying) {
                player.pauseVideo();
            } else {
                player.playVideo();
            }
        }
    };

    const toggleMute = () => {
        if (player) {
            if (isMuted) {
                player.unMute();
                setIsMuted(false);
            } else {
                player.mute();
                setIsMuted(true);
            }
        }
    };

    const toggleFullscreen = () => {
        const iframe = document.getElementById('youtube-player');
        if (iframe) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                iframe.requestFullscreen();
            }
        }
    };

    const handlePostClick = (content: Content) => {
        navigate(`/nostalgia/${content.id}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#141414] text-white">
                <Header />
                <div className="flex items-center justify-center h-[calc(100vh-80px)]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#141414] text-white font-sans">
            <Header />

            <main className="pt-20 pb-10">
                {/* Header with Live Indicator */}
                <div className="container mx-auto px-4 mb-6">
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl md:text-4xl font-bold text-white">NostalgiaTube</h1>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                                <div className="absolute inset-0 w-3 h-3 bg-red-600 rounded-full animate-ping"></div>
                            </div>
                            <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">Live</span>
                        </div>
                    </div>
                </div>

                {/* Player Section - Full Width */}
                <div className="w-full bg-black mb-8">
                    <div className="relative w-full aspect-video group">
                        {youtubeId ? (
                            <>
                                <div id="youtube-player" className="absolute inset-0 w-full h-full"></div>

                                {/* Overlay to hide YouTube branding */}
                                <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10"></div>

                                {/* Custom Controls Overlay */}
                                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-4 z-20">
                                    <div className="flex items-center gap-4 w-full">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-white hover:bg-white/20"
                                            onClick={togglePlay}
                                        >
                                            {isPlaying ? (
                                                <Pause className="w-6 h-6 fill-current" />
                                            ) : (
                                                <Play className="w-6 h-6 fill-current" />
                                            )}
                                        </Button>

                                        <div className="flex-1">
                                            <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                                                <div className="h-full w-1/3 bg-primary"></div>
                                            </div>
                                        </div>

                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-white hover:bg-white/20"
                                            onClick={toggleMute}
                                        >
                                            {isMuted ? (
                                                <VolumeX className="w-6 h-6" />
                                            ) : (
                                                <Volume2 className="w-6 h-6" />
                                            )}
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-white hover:bg-white/20"
                                            onClick={toggleFullscreen}
                                        >
                                            <Maximize className="w-6 h-6" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                <p className="text-gray-500">Selecione um vídeo para assistir</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="container mx-auto px-4">
                    {/* Info Section */}
                    {currentContent && (
                        <div className="mb-8 p-6 bg-[#1a1a1a] rounded-xl border border-white/5">
                            <h2 className="text-2xl md:text-3xl font-bold mb-2 text-primary">{currentContent.title}</h2>
                            {currentEpisode && (
                                <h3 className="text-xl text-gray-300 mb-4">{currentEpisode.title}</h3>
                            )}

                            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-4">
                                {currentContent.year && <span>{currentContent.year}</span>}
                                {currentContent.duration && <span>{currentContent.duration}</span>}
                                {currentContent.genre && currentContent.genre.map((g, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-white/10 rounded-full text-xs">{g}</span>
                                ))}
                            </div>

                            <p className="text-gray-300 leading-relaxed mb-6">
                                {currentContent.description}
                            </p>

                            {currentContent.episodes && currentContent.episodes.length > 1 && (
                                <div className="space-y-2">
                                    <h3 className="font-semibold text-white mb-2">Episódios</h3>
                                    <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-thin scrollbar-thumb-primary/50 scrollbar-track-transparent">
                                        {currentContent.episodes.map((ep, idx) => {
                                            const epVideoId = getYoutubeId(ep.url);
                                            const epThumb = epVideoId
                                                ? `https://img.youtube.com/vi/${epVideoId}/mqdefault.jpg`
                                                : currentContent.thumbnail_url;

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setCurrentEpisodeIndex(idx)}
                                                    className={`flex-none w-60 group relative rounded-lg overflow-hidden border transition-all ${currentEpisodeIndex === idx
                                                        ? 'border-primary ring-1 ring-primary'
                                                        : 'border-white/10 hover:border-white/30'
                                                        }`}
                                                >
                                                    <div className="aspect-video w-full relative bg-zinc-900">
                                                        <img
                                                            src={epThumb}
                                                            alt={ep.title}
                                                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                        />
                                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Play className="w-8 h-8 text-white fill-current drop-shadow-lg" />
                                                        </div>
                                                        <div className="absolute bottom-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-white">
                                                            Ep {idx + 1}
                                                        </div>
                                                    </div>
                                                    <div className={`p-2 text-left w-full truncate text-sm font-medium ${currentEpisodeIndex === idx ? 'bg-primary/10 text-primary' : 'bg-[#222] text-gray-300'}`}>
                                                        {ep.title || `Episódio ${idx + 1}`}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* "Nostalgia" Section - Posts */}
                    <div className="mt-12">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <span className="text-primary">NOSTALGIA</span>
                        </h2>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                            {contents.map((item) => (
                                <div
                                    key={item.id}
                                    className="group relative cursor-pointer"
                                    onClick={() => handlePostClick(item)}
                                >
                                    <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/5 transition-transform duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-primary/20">
                                        <img
                                            src={item.thumbnail_url}
                                            alt={item.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Play className="w-12 h-12 text-white fill-current drop-shadow-lg scale-0 group-hover:scale-100 transition-transform duration-300 delay-75" />
                                        </div>
                                    </div>
                                    <h3 className="mt-3 text-sm font-medium leading-tight text-white group-hover:text-primary transition-colors line-clamp-2">
                                        {item.title}
                                    </h3>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
