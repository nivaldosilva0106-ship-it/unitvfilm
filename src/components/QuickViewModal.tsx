import { useEffect, useState } from 'react';
import { X, Play, Star, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Content } from '@/types/content';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import ReactPlayerComponent from 'react-player';
const ReactPlayer = ReactPlayerComponent as any;

interface QuickViewModalProps {
    content: Content | null;
    open: boolean;
    onClose: () => void;
    onPlay?: (content: Content) => void;
}

// Helper to extract YouTube video ID
const getYoutubeVideoId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

// Check if URL is a YouTube URL
const isYoutubeUrl = (url: string): boolean => {
    return url?.includes('youtube.com') || url?.includes('youtu.be');
};

export const QuickViewModal = ({ content, open, onClose, onPlay }: QuickViewModalProps) => {
    const navigate = useNavigate();
    const [muted, setMuted] = useState(true);
    const [showTrailer, setShowTrailer] = useState(false);
    const [imageOpacity, setImageOpacity] = useState(1);
    const [videoOpacity, setVideoOpacity] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Reset states when modal opens/closes
    useEffect(() => {
        if (open && content?.trailer_url) {
            setImageOpacity(1);
            setVideoOpacity(0);
            setShowTrailer(false);
            setMuted(true);
            setIsPlaying(false);

            // Auto-play trailer after 3 seconds
            const timer = setTimeout(() => {
                startTrailer(true);
            }, 3000);

            return () => clearTimeout(timer);
        } else {
            setShowTrailer(false);
            setImageOpacity(1);
            setVideoOpacity(0);
            setIsPlaying(false);
        }
    }, [open, content]);

    // Start trailer with smooth transition
    const startTrailer = (autoPlay: boolean = false) => {
        if (!content?.trailer_url) return;
        
        setShowTrailer(true);
        setIsPlaying(true);
        if (!autoPlay) setMuted(false);
        
        // Fade out image, fade in video
        setTimeout(() => {
            setImageOpacity(0);
            setVideoOpacity(1);
        }, 50);
    };

    const handlePlayTrailer = () => {
        startTrailer(false);
    };

    // Handle video end - fade back to image
    const handleVideoEnd = () => {
        setVideoOpacity(0);
        setImageOpacity(1);
        setIsPlaying(false);
        
        setTimeout(() => {
            setShowTrailer(false);
            setMuted(true);
        }, 1000);
    };

    const handlePlay = () => {
        if (onPlay && content) {
            onPlay(content);
        } else if (content) {
            navigate(`/content/${content.id}`);
        }
        onClose();
    };

    if (!content || !open) return null;

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

    const trailerUrl = content.trailer_url;
    const isYoutube = trailerUrl ? isYoutubeUrl(trailerUrl) : false;

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

                <div className="relative h-[400px] w-full bg-black">
                    {/* Backdrop image with fade transition */}
                    <img
                        src={content.backdrop_url || content.thumbnail_url}
                        alt={content.title}
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
                        style={{ opacity: imageOpacity }}
                    />

                    {/* Video overlay with ReactPlayer for YouTube support */}
                    {showTrailer && trailerUrl && (
                        <div 
                            className="absolute inset-0 w-full h-full transition-opacity duration-1000"
                            style={{ opacity: videoOpacity }}
                        >
                            <ReactPlayer
                                url={trailerUrl}
                                width="100%"
                                height="100%"
                                playing={isPlaying}
                                muted={muted}
                                onEnded={handleVideoEnd}
                                onError={handleVideoEnd}
                                controls={false}
                                style={{ position: 'absolute', top: 0, left: 0 }}
                            />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />

                    {/* Content Info Overlay */}
                    <div className="absolute bottom-0 left-0 p-8 w-full">
                        <h2 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">{content.title}</h2>

                        <div className="flex items-center gap-3 mb-6">
                            <Button onClick={handlePlay} className="bg-white text-black hover:bg-white/90 gap-2 font-bold px-8">
                                <Play className="w-5 h-5 fill-black" /> Assistir
                            </Button>

                            {content.trailer_url && (
                                <>
                                    <Button
                                        onClick={handlePlayTrailer}
                                        className="bg-white/20 hover:bg-white/30 text-white gap-2 font-bold px-6 backdrop-blur-sm transition-all"
                                    >
                                        <Play className="w-5 h-5" /> Trailer
                                    </Button>

                                    <button
                                        onClick={() => setMuted(!muted)}
                                        className="p-3 rounded-full border border-zinc-500 text-zinc-300 hover:border-white hover:text-white transition-all bg-black/30 backdrop-blur ml-auto"
                                    >
                                        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                <div className="p-8 pt-0 grid grid-cols-3 gap-8">
                    <div className="col-span-2 space-y-4">
                        <div className="flex items-center gap-3 text-sm font-medium">
                            <span className="text-green-500 font-bold">New</span>
                            <span className="text-zinc-400">{content.year || '2024'}</span>
                            <div className={cn("px-2 py-0.5 rounded textxs font-bold text-white", getClassificationColor(content.classification))}>
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
