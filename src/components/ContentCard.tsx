import { Play, Info, Download, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { useRef } from "react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";

interface ContentCardProps {
  title: string;
  thumbnail: string;
  onPlay?: () => void;
  onPlay?: () => void;
  onInfo?: () => void;
  onDetails?: () => void; // New Handler for Poster Click
  onDownload?: () => void;
  isPremium?: boolean;
  isNew?: boolean;
  newSince?: string;
  category?: 'movie' | 'series' | 'tv';
  classification?: string; // e.g. '10', '12', '16', '18', 'L'
}

export const ContentCard = ({ title, thumbnail, onPlay, onInfo, onDetails, onDownload, isPremium, isNew, newSince, category, classification }: ContentCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  // Use only the sound helper, without installing key listeners
  const { playNavigationSound } = useKeyboardNavigation({ enabled: false });

  const isActuallyNew = isNew && newSince && (new Date().getTime() - new Date(newSince).getTime() < 86400000);

  const handleButtonClick = (cb?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    playNavigationSound('select');
    cb?.();
  };

  const handleButtonFocus = () => playNavigationSound('focus');

  return (
    <div
      ref={cardRef}
      className="relative group min-w-[140px] sm:min-w-[160px] cursor-pointer card-hover rounded-lg transition-all"
      onClick={() => onDetails?.()} // Poster Click -> Details
    >
      {isPremium && (
        <div className="absolute top-2 right-2 z-10 bg-primary/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
          <Lock className="w-3 h-3 text-primary-foreground" />
          <span className="text-xs font-semibold text-primary-foreground">Premium</span>
        </div>
      )}

      {/* Classification Badge */}
      {classification && (
        <div className={`absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm
                ${classification === 'L' ? 'bg-green-500' :
            classification === '10' ? 'bg-blue-400' :
              classification === '12' ? 'bg-yellow-400' :
                classification === '14' ? 'bg-orange-400' :
                  classification === '16' ? 'bg-red-500' :
                    classification === '18' ? 'bg-black' : 'bg-zinc-500'
          }`}>
          {classification}
        </div>
      )}

      <div className="relative overflow-hidden rounded-lg">
        <img
          src={thumbnail || "/placeholder.svg"}
          alt={title}
          className="w-full h-[200px] sm:h-[240px] object-cover"
          loading="lazy"
        />

        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 flex items-end p-3 ${isActuallyNew ? 'pb-9' : ''} opacity-0 group-hover:opacity-100 group-focus-within:opacity-100`}>
          <div className="w-full space-y-2">
            <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-2">{title}</h3>
            <div className="flex justify-center gap-2">
              <Button
                onClick={handleButtonClick(onPlay)}
                onFocus={handleButtonFocus}
                size="icon"
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-8 glow-effect-hover rounded-full"
                tabIndex={0}
              >
                <Play className="w-4 h-4" />
              </Button>
              <Button
                onClick={handleButtonClick(onInfo)}
                onMouseEnter={() => onInfo?.()} // Quick View on Hover
                onFocus={handleButtonFocus}
                size="icon"
                variant="secondary"
                className="h-8 w-8 rounded-full"
                tabIndex={0}
              >
                <Info className="w-4 h-4" />
              </Button>
              {onDownload && (
                <Button
                  onClick={handleButtonClick(onDownload)}
                  onFocus={handleButtonFocus}
                  size="icon"
                  variant="outline"
                  className="h-8 w-8 rounded-full"
                  tabIndex={0}
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {isActuallyNew && (
          <div className="absolute bottom-0 left-0 right-0 bg-[#E50914] py-1 z-20 flex justify-center items-center shadow-lg">
            <span className="text-[10px] font-extrabold text-white uppercase tracking-widest drop-shadow-md leading-none">
              {category === 'series' ? 'Nova Temporada' : 'Novidade'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};