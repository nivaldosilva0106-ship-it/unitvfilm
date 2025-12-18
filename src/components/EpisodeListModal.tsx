import { useRef, useState, useMemo } from "react";
import { X, Play, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Episode } from "@/types/content";
import { cn } from "@/lib/utils";

interface EpisodeListModalProps {
    isOpen: boolean;
    onClose: () => void;
    episodes: Episode[];
    currentEpisodeId?: string;
    onPlayEpisode: (episode: Episode) => void;
    className?: string;
}

export const EpisodeListModal = ({
    isOpen,
    onClose,
    episodes,
    currentEpisodeId,
    onPlayEpisode,
    className
}: EpisodeListModalProps) => {
    const [selectedSeason, setSelectedSeason] = useState<number>(1);

    // Group episodes by season
    const seasons = useMemo(() => {
        const uniqueSeasons = Array.from(new Set(episodes.map(e => e.season))).sort((a, b) => a - b);
        return uniqueSeasons;
    }, [episodes]);

    const filteredEpisodes = useMemo(() => {
        return episodes.filter(e => e.season === selectedSeason).sort((a, b) => a.episode - b.episode);
    }, [episodes, selectedSeason]);

    // Set initial season based on current episode
    useMemo(() => {
        if (currentEpisodeId) {
            const current = episodes.find(e => e.id === currentEpisodeId);
            if (current) {
                setSelectedSeason(current.season);
            }
        }
    }, [currentEpisodeId, episodes]);

    if (!isOpen) return null;

    return (
        <div
            className={cn(
                "absolute inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300",
                className
            )}
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl max-h-[80vh] bg-[#1a1a1a] rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#1a1a1a]">
                    <h3 className="text-lg font-bold text-white">Episódios</h3>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
                        <X className="w-5 h-5 text-gray-400" />
                    </Button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Season Sidebar (Desktop) / Topbar (Mobile) */}
                    <div className="w-24 md:w-48 border-r border-white/10 bg-[#141414] overflow-y-auto hidden md:block">
                        {seasons.map((season) => (
                            <button
                                key={season}
                                onClick={() => setSelectedSeason(season)}
                                className={cn(
                                    "w-full px-4 py-4 text-left text-sm font-medium transition-colors border-l-2",
                                    selectedSeason === season
                                        ? "bg-white/5 border-primary text-primary"
                                        : "border-transparent text-gray-400 hover:text-white hover:bg-white/5"
                                )}
                            >
                                Temporada {season}
                            </button>
                        ))}
                    </div>

                    {/* Episode List */}
                    <div className="flex-1 overflow-y-auto p-4 bg-[#1a1a1a]">
                        {/* Mobile Season Selector */}
                        <div className="md:hidden mb-4 overflow-x-auto flex gap-2 pb-2 scrollbar-none">
                            {seasons.map((season) => (
                                <button
                                    key={season}
                                    onClick={() => setSelectedSeason(season)}
                                    className={cn(
                                        "flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all",
                                        selectedSeason === season
                                            ? "bg-primary text-white"
                                            : "bg-white/10 text-gray-400 hover:bg-white/20"
                                    )}
                                >
                                    Temporada {season}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-2">
                            {filteredEpisodes.map((episode) => (
                                <div
                                    key={episode.id || `${episode.season}-${episode.episode}`}
                                    className="group flex gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
                                >
                                    {/* Thumbnail */}
                                    <div className="relative w-32 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-900">
                                        {episode.thumbnailUrl ? (
                                            <img src={episode.thumbnailUrl} alt={episode.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Play className="w-6 h-6 text-gray-600" />
                                            </div>
                                        )}

                                        {/* Play Overlay */}
                                        <button
                                            onClick={() => onPlayEpisode(episode)}
                                            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <div className="bg-primary text-white rounded-full p-2 shadow-lg scale-90 group-hover:scale-100 transition-transform">
                                                <Play className="w-4 h-4 fill-current ml-0.5" />
                                            </div>
                                        </button>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-gray-400">EP {episode.episode}</span>
                                            {episode.id === currentEpisodeId && (
                                                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                                    Reproduzindo
                                                </span>
                                            )}
                                        </div>
                                        <h4 className="text-white font-medium text-sm line-clamp-2 leading-tight mb-2">
                                            {episode.title}
                                        </h4>
                                        <p className="text-xs text-gray-500 line-clamp-1">
                                            {/* Description could go here if available */}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
