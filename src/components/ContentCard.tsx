import { Play, Info, Download, ShieldCheck, Crown } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useRef, memo } from "react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { useAuth } from "@/contexts/AuthContext";
import { isContentAllowedForProfile, getOptimizedImageUrl } from "@/lib/utils";
import { getProviderConfig } from "@/lib/providers";
import { useAppConfig } from "@/hooks/useAppConfig";

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
  category?: 'movie' | 'series' | 'tv' | 'nostalgia' | 'canais24h';
  classification?: string; // e.g. '10', '12', '16', '18', 'L'
  internal_player_url?: string;
  hasDownloads?: boolean;
  hasInternalPlayer?: boolean;
  hasDownload?: boolean;
  hideDownloadIcon?: boolean;
  watch_provider?: 'netflix' | 'amazon' | 'hbo' | 'disney' | 'apple' | 'hulu' | 'paramount' | 'starplus' | 'globoplay' | 'crunchyroll' | 'skyshowtime' | 'youtube' | 'other';
  providerLogos?: Record<string, string>;
}

export const ContentCard = memo(({
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
  internal_player_url,
  hasDownloads,
  hasInternalPlayer,
  hasDownload,
  hideDownloadIcon,
  watch_provider,
  providerLogos
}: ContentCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { playNavigationSound } = useKeyboardNavigation({ enabled: false });
  const { currentProfile } = useAuth();
  const { isLiteMode, imageQuality, enableTooltips, enableBackdropBlur } = useAppConfig();

  const isRestricted = !isContentAllowedForProfile(classification, currentProfile?.isKids || false);
  const isActuallyNew = isNew && newSince && (new Date().getTime() - new Date(newSince).getTime() < 86400000);
  const enableAnimations = !isLiteMode;

  const handleButtonClick = (cb?: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    playNavigationSound('select');



    cb?.();
  };

  const handleButtonFocus = () => playNavigationSound('focus');

  return (
    <div
      ref={cardRef}
      className={`relative group min-w-[140px] sm:min-w-[160px] cursor-pointer card-hover rounded-lg transition-all focus:outline-none focus:ring-4 focus:ring-primary ${isLiteMode ? 'focus:ring-yellow-400' : ''}`}
      onClick={(e) => {
        // In lite mode, we intercept all clicks directly into the play action.
        if (isLiteMode && onPlay) onPlay();
        else onDetails?.();
      }}
      tabIndex={isLiteMode ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          playNavigationSound('select');
          if (isLiteMode && onPlay) onPlay();
          else onDetails?.();
        }
      }}
      onFocus={handleButtonFocus}
    >
      {isPremium && (
        <div className={`absolute top-2 right-2 z-10 bg-gradient-to-r from-orange-500 to-amber-500 ${enableBackdropBlur ? 'backdrop-blur-sm' : ''} p-1.5 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/30`}>
          <Crown className="w-3.5 h-3.5 text-white drop-shadow-sm" />
        </div>
      )}

      {watch_provider && getProviderConfig(watch_provider, providerLogos) && (
        <div className="absolute top-2 left-2 z-10 bg-black/70 p-1.5 rounded-lg border border-white/10 shadow-xl transition-transform group-hover:scale-110">
          <img 
            src={getProviderConfig(watch_provider, providerLogos)?.logo} 
            alt={getProviderConfig(watch_provider, providerLogos)?.name} 
            className="h-8 w-auto object-contain" 
          />
        </div>
      )}

      {/* Classification Badge */}
      {classification && (
        <div className={`absolute ${watch_provider ? 'top-[54px]' : 'top-2'} left-2 z-10 px-1.5 py-0.5 rounded text-[10px] font-bold text-white shadow-sm
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
        {hasDownloads && !isRestricted && !hideDownloadIcon && (
          <div className="bg-emerald-500/90 p-1.5 rounded-full shadow-lg" title="Download Disponível">
            <Download className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg">
        <img
          src={getOptimizedImageUrl(thumbnail, 'poster', imageQuality)}
          alt={title}
          className={`w-full h-[200px] sm:h-[240px] object-cover ${isRestricted ? 'grayscale-[0.5] blur-[1px]' : ''} ${!isLiteMode ? 'transition-transform duration-500 group-hover:scale-110' : ''}`}
          loading="lazy"
        />

        {isRestricted && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-black/40 flex flex-col items-center justify-center p-4 text-center z-10">
            <div className="bg-gradient-to-br from-orange-500 to-red-500 p-3 rounded-xl shadow-lg shadow-orange-500/40 mb-2">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-bold text-orange-300 uppercase tracking-wider">Restrito: Kids</span>
          </div>
        )}

        <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity duration-300 flex items-end p-3 ${isActuallyNew ? 'pb-9' : ''} ${isRestricted ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
          <div className="w-full space-y-2">
            <h3 className="text-foreground font-semibold text-sm mb-2 line-clamp-2">{title}</h3>
                        {!isLiteMode && (
             <div className="flex justify-center items-center gap-3 pb-2">
                {enableTooltips ? (
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={handleButtonClick(onPlay)}
                          onFocus={handleButtonFocus}
                          size="icon"
                          disabled={isRestricted}
                          className={`h-11 w-11 bg-gradient-to-br from-primary via-primary to-primary/80 hover:to-primary text-primary-foreground ${enableAnimations ? 'glow-effect-hover scale-100 hover:scale-115 active:scale-90' : ''} rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-white/20 ${isRestricted ? 'opacity-50 cursor-not-allowed' : ''} ${internal_player_url && !isLiteMode ? 'animate-pulse ring-4 ring-primary/30' : ''}`}
                          tabIndex={0}
                        >
                          {isRestricted ? <ShieldCheck className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/95 backdrop-blur-xl border border-white/10 text-white font-bold px-3 py-1.5 shadow-2xl">
                        <p>{isRestricted ? 'Bloqueado' : internal_player_url ? 'Player Interno' : 'Assistir Now'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <Button
                    onClick={handleButtonClick(onPlay)}
                    onFocus={handleButtonFocus}
                    size="icon"
                    disabled={isRestricted}
                    className={`h-11 w-11 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-white/20 ${isRestricted ? 'opacity-50 cursor-not-allowed' : ''}`}
                    tabIndex={0}
                  >
                    {isRestricted ? <ShieldCheck className="w-5 h-5" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                  </Button>
                )}

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
                  className="h-11 w-11 rounded-full bg-white/5 hover:bg-white/20 backdrop-blur-xl border border-white/10 text-white transition-all duration-300 hover:scale-115 active:scale-90 shadow-xl"
                  tabIndex={0}
                >
                  <Info className="w-5 h-5" />
                </Button>

                {(onDownload || hasDownloads) && (
                  enableTooltips ? (
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={handleButtonClick(onDownload)}
                            onFocus={handleButtonFocus}
                            size="icon"
                            variant="outline"
                            className="h-11 w-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xl border border-white/10 text-white transition-all duration-300 hover:scale-115 active:scale-90 shadow-[0_4px_15px_rgba(0,0,0,0.4)]"
                            tabIndex={0}
                          >
                            {hasDownloads ? <Download className="w-5 h-5 text-[#0aff7a] drop-shadow-[0_0_8px_rgba(10,255,122,0.5)]" /> : <Download className="w-5 h-5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-black/95 backdrop-blur-xl border border-white/10 text-white font-bold px-3 py-1.5 shadow-2xl">
                          <p>{hasDownloads ? 'Baixar Agora' : 'Download'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <Button
                      onClick={handleButtonClick(onDownload)}
                      onFocus={handleButtonFocus}
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-xl border border-white/10 text-white transition-all duration-300 hover:scale-115 active:scale-90 shadow-xl"
                      tabIndex={0}
                    >
                      {hasDownloads ? <Download className="w-5 h-5 text-[#0aff7a] drop-shadow-[0_0_8px_rgba(10,255,122,0.5)]" /> : <Download className="w-5 h-5" />}
                    </Button>
                  )
                )}
              </div>
            )}
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
});

ContentCard.displayName = 'ContentCard';