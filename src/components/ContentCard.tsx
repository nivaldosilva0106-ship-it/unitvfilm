import { Play, Info, Download, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { useRef } from "react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { isContentAllowedForProfile } from "@/lib/utils";

interface ContentCardProps {
  title: string;
  thumbnail: string;
  onPlay?: () => void;
  onInfo?: () => void;
  onDetails?: () => void;
  onTrailer?: () => void;
  onDownload?: () => void;
  isPremium?: boolean;
  isNew?: boolean;
  newSince?: string;
  category?: 'movie' | 'series' | 'tv';
  classification?: string;
  hasInternalPlayer?: boolean;
  hasDownload?: boolean;
}

export const ContentCard = ({ 
  title, 
  thumbnail, 
  onPlay, 
  onInfo, 
  onDetails, 
  onTrailer, 
  onDownload, 
  isPremium, 
  isNew, 
  newSince, 
  category, 
  classification,
  hasInternalPlayer,
  hasDownload
}: ContentCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { playNavigationSound } = useKeyboardNavigation({ enabled: false });
  const { currentProfile } = useAuth();

  const isRestricted = !isContentAllowedForProfile(classification, currentProfile?.isKids || false);
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
      onClick={() => onDetails?.()}
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

      {/* Badges Row - Internal Player & Download */}
      <div className="absolute bottom-2 left-2 z-10 flex gap-1.5">
        {hasInternalPlayer && !isRestricted && (
          <div className="bg-primary/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg" title="Player Interno Disponível">
            <Play className="w-3 h-3 text-primary-foreground fill-primary-foreground" />
          </div>
        )}
        {hasDownload && !isRestricted && (
          <div className="bg-emerald-500/90 backdrop-blur-sm p-1.5 rounded-full shadow-lg" title="Download Disponível">
            <Download className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg">
        <img
          src={thumbnail || "/placeholder.svg"}
          alt={title}
          className={`w-full h-[200px] sm:h-[240px] object-cover ${isRestricted ? 'grayscale-[0.5] blur-[1px]' : ''}`}
          loading="lazy"
        />

        {isRestricted && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center p-4 text-center z-10">
            <Lock className="w-8 h-8 text-red-500 mb-2" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-tight">Restrito: Kids</span>
          </div>
        )}

        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 flex items-end p-3 ${isActuallyNew ? 'pb-9' : ''} ${isRestricted ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
          <div className="w-full space-y-2">
            <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-2">{title}</h3>
            <div className="flex justify-center gap-2">
              <Button
                onClick={handleButtonClick(onPlay)}
                onFocus={handleButtonFocus}
                size="icon"
                disabled={isRestricted}
                className={`bg-primary hover:bg-primary/90 text-primary-foreground h-8 w-8 glow-effect-hover rounded-full ${isRestricted ? 'opacity-50 cursor-not-allowed' : ''}`}
                tabIndex={0}
              >
                {isRestricted ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>
              <Button
                onClick={handleButtonClick(onInfo)}
                onMouseEnter={() => {
                  hoverTimeoutRef.current = setTimeout(() => {
                    onInfo?.();
                  }, 2000);
                }}
                onMouseLeave={() => {
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                  }
                }}
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