import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface NextEpisodeCardProps {
    thumbnailUrl?: string;
    season: number;
    episode: number;
    title: string;
    onClick: () => void;
    className?: string;
}

export const NextEpisodeCard = ({
    thumbnailUrl,
    season,
    episode,
    title,
    onClick,
    className
}: NextEpisodeCardProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const titleRef = useRef<HTMLDivElement>(null);
    const [shouldMarquee, setShouldMarquee] = useState(false);

    useEffect(() => {
        if (titleRef.current) {
            setShouldMarquee(titleRef.current.scrollWidth > titleRef.current.clientWidth);
        }
    }, [title]);

    return (
        <div
            role="button"
            onClick={onClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "group relative flex items-center gap-3 bg-black/80 hover:bg-black/90 backdrop-blur-md border border-white/10 hover:border-primary/50 rounded-xl p-2 pr-4 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-primary/20 hover:scale-105 overflow-hidden",
                className
            )}
        >
            {/* Thumbnail */}
            <div className="relative w-24 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-900">
                {thumbnailUrl ? (
                    <img
                        src={thumbnailUrl}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600 bg-gray-800">
                        <Play className="w-6 h-6" />
                    </div>
                )}
                <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />

                {/* Play Icon Overlay */}
                <div className={cn(
                    "absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                    "bg-black/40"
                )}>
                    <div className="bg-primary text-white rounded-full p-1 shadow-sm">
                        <Play className="w-3 h-3 fill-current" />
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col min-w-0 flex-1">
                {/* Header - Green */}
                <span className="text-[10px] font-bold text-primary tracking-wider uppercase mb-0.5">
                    Próximo Episódio
                </span>

                {/* Title - Marquee effect container */}
                <div className="relative overflow-hidden w-40 h-5">
                    <div
                        ref={titleRef}
                        className={cn(
                            "whitespace-nowrap text-sm font-semibold text-white",
                            shouldMarquee && isHovered && "animate-marquee"
                        )}
                        style={{
                            // Inline style for marquee if needed, or rely on global css
                        }}
                    >
                        <span className="mr-4">Assistir: {title}</span>
                        {shouldMarquee && isHovered && <span className="mr-4">Assistir: {title}</span>}
                    </div>
                </div>

                {/* Metadata - Gray */}
                <span className="text-[10px] font-medium text-gray-400 mt-0.5">
                    T{season} · EP{episode}
                </span>
            </div>

            <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 5s linear infinite;
        }
      `}</style>
        </div>
    );
};
