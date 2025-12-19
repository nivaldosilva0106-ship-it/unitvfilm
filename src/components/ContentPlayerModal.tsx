import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Crown, ArrowLeft, List, Film, Maximize, Minimize, Star, Plus, ChevronUp, ChevronRight } from "lucide-react";
import { Content } from "@/types/content";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { Button } from "./ui/button";
import { useRef, useEffect, useState, useMemo } from "react";
import ReactPlayerComponent from 'react-player';
const ReactPlayer = ReactPlayerComponent as any;
import { useAuth } from "@/contexts/AuthContext";
import { AdManager } from "./AdManager";
import { useNavigate } from "react-router-dom";
import { useContentProtection } from "@/hooks/useContentProtection";
import { incrementDailyUsage } from "@/lib/firebase";

interface ContentPlayerModalProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  videoUrls?: string[];
  title: string;
  isPremium?: boolean;
  image?: string;
  description?: string;
  rating?: number;
  episodeTitle?: string;
  suggestions?: Content[];
  internalPlayerUrl?: string;
  onPlayContent?: (content: Content) => void;
  onAddToMyList?: (content: Content) => void;
  category?: string;
  nextEpisode?: {
    title: string;
    season: number;
    episode: number;
    url: string;
  };
  onPlayNext?: () => void;
  isLastEpisode?: boolean;
}

export const ContentPlayerModal = ({
  open,
  onClose,
  videoUrl,
  videoUrls,
  title,
  isPremium = false,
  image,
  description,
  rating,
  episodeTitle,
  suggestions = [],
  internalPlayerUrl,
  onPlayContent,
  onAddToMyList,
  category,
  nextEpisode,
  onPlayNext,
  isLastEpisode = false,
}: ContentPlayerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const { profile, isAdmin, checkAccess, plan } = useAuth();
  const navigate = useNavigate();

  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWatchingCard, setShowWatchingCard] = useState(false);
  const [cardProgress, setCardProgress] = useState(100);
  const [showSuggestionCard, setShowSuggestionCard] = useState(false);
  const [suggestedContent, setSuggestedContent] = useState<Content | null>(null);

  const [accessState, setAccessState] = useState<{ granted: boolean; reason?: string | null }>({ granted: false });
  const hasIncrementedRef = useRef(false);

  // Access Check Effect
  useEffect(() => {
    if (open) {
      hasIncrementedRef.current = false;

      // Infer category if missing
      const cat = category || (episodeTitle ? 'series' : 'movie');
      const contentMock = { isPremium, category: cat };

      const access = checkAccess(contentMock as any);

      if (access.allowed) {
        setAccessState({ granted: true });

        // Increment Usage (once per open)
        if (profile && !isAdmin && !hasIncrementedRef.current) {
          incrementDailyUsage(profile.id, cat === 'series' ? 'episode' : 'movie');
          hasIncrementedRef.current = true;
        }
      } else {
        setAccessState({ granted: false, reason: access.reason });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, episodeTitle, isPremium, category]); // Removed profile/isAdmin to prevent re-check after increment

  const watchingCardTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sources
  const allSources = useMemo(() => {
    const sources = [];
    if (internalPlayerUrl) {
      sources.push({ name: 'Player Interno', url: internalPlayerUrl, type: 'internal' });
    }
    const embeds = (videoUrls && videoUrls.length > 0 ? videoUrls : [videoUrl]);
    embeds.forEach((url, index) => {
      if (url) sources.push({ name: `Player ${index + 1}`, url, type: 'embed' });
    });
    return sources;
  }, [internalPlayerUrl, videoUrls, videoUrl]);

  const hasMultipleSources = allSources.length > 1;
  const currentSource = allSources[currentSourceIndex] || allSources[0];

  useContentProtection(open);

  const secureVideoUrl = useMemo(() => {
    if (!currentSource || currentSource.type !== 'embed') return '';
    const url = currentSource.url;
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_t=${timestamp}`;
  }, [currentSource]);

  useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
  });

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Watching Card Logic (Interval: Every 30 minutes = 1800000ms)
  useEffect(() => {
    if (open) {
      if (watchingCardTimerRef.current) clearTimeout(watchingCardTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);

      const showWatchingCardCycle = () => {
        setShowWatchingCard(true);
        setCardProgress(100);

        const duration = 5000;
        const intervalTime = 50;
        const decrementAmount = (100 / duration) * intervalTime;

        progressIntervalRef.current = setInterval(() => {
          setCardProgress(prev => {
            const newProgress = prev - decrementAmount;
            if (newProgress <= 0) {
              if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
              return 0;
            }
            return newProgress;
          });
        }, intervalTime);

        watchingCardTimerRef.current = setTimeout(() => {
          setShowWatchingCard(false);
          setCardProgress(100);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

          // Schedule next appearance in 30 minutes
          watchingCardTimerRef.current = setTimeout(showWatchingCardCycle, 1800000);
        }, duration);
      };

      // Initial Delay for Watching Card (2 seconds)
      const initialTimer = setTimeout(showWatchingCardCycle, 2000);

      // --- AUTO CLICKER LOGIC (ROBUST SEQUENCE) ---
      const fireAutoClicks = () => {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        const performClick = () => {
          // 1. Try generic element from point
          const el = document.elementFromPoint(centerX, centerY);
          if (el instanceof HTMLElement) {
            el.click();
            el.focus();
          }

          // 2. Target specific iframe or container
          if (iframeRef.current) {
            iframeRef.current.focus();
            // Note: Can't easily click INSIDE iframe cross-origin, but we can try aiming for the container
          }

          if (playerContainerRef.current) {
            // Dispatch multiple event types to simulate real interaction
            const events = ['mousedown', 'mouseup', 'click'];
            events.forEach(eventType => {
              const evt = new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: centerX,
                clientY: centerY
              });
              playerContainerRef.current?.dispatchEvent(evt);
            });
          }
        };

        // Fire sequence
        setTimeout(performClick, 500);
        setTimeout(performClick, 1500);
        setTimeout(performClick, 2500);
      };

      const autoClickTimer = setTimeout(fireAutoClicks, 100);


      // Suggestions Logic
      if (suggestions && suggestions.length > 0) {
        const candidates = suggestions.filter(s => s.title !== title && s.video_url !== videoUrl);
        if (candidates.length > 0) {
          setSuggestedContent(candidates[0]); // Pick first logic or random
          suggestionTimerRef.current = setTimeout(() => {
            setShowSuggestionCard(true);
            setTimeout(() => setShowSuggestionCard(false), 15000);
          }, 15000);
        }
      }

      return () => {
        clearTimeout(initialTimer);
        clearTimeout(autoClickTimer);
        if (watchingCardTimerRef.current) clearTimeout(watchingCardTimerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
      };
    } else {
      setShowWatchingCard(false);
      setCardProgress(100);
      setShowSuggestionCard(false);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
    }
  }, [open, title, videoUrl, suggestions]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await (dialogContentRef.current || playerContainerRef.current)?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const isBlocked = !isAdmin && !accessState.granted;

  // Blocked Message
  const getBlockedMessage = () => {
    switch (accessState.reason) {
      case 'premium_content':
        return { title: 'Conteúdo Premium', desc: 'Este conteúdo é exclusivo para assinantes Premium.' };
      case 'plan_limit':
        return { title: 'Limite Diário Atingido', desc: 'Você atingiu seu limite diário de visualizações gratuítas (ou do seu plano).' };
      case 'no_credits':
        return { title: 'Sem Créditos', desc: 'Sua conta não possui créditos ou plano ativo.' };
      default:
        return { title: 'Acesso Bloqueado', desc: 'Você não tem permissão para assistir.' };
    }
  };

  const blockedInfo = getBlockedMessage();

  if (!currentSource) return null;

  const displayTitle = episodeTitle ? `${title} - ${episodeTitle}` : title;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        ref={dialogContentRef}
        className="max-w-full w-screen h-screen p-0 bg-black border-none [&>button]:hidden protected-content"
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
      >
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-6 right-6 z-50 w-12 h-12 text-white bg-black/70 hover:bg-red-600 hover:scale-110 backdrop-blur-md transition-all rounded-full shadow-lg border-2 border-white/20"
        >
          <X className="w-7 h-7" />
        </Button>

        {isBlocked ? (
          <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-black via-primary/10 to-black">
            <div className="text-center max-w-md px-8">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/20 border-2 border-primary mb-6">
                <Crown className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4">
                {blockedInfo.title}
              </h2>
              <p className="text-muted-foreground mb-8 text-lg">
                {blockedInfo.desc} <br />
                Atualize seu plano para ter acesso ilimitado.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    onClose();
                    navigate('/signup'); // Direct to signup/plans
                  }}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Ver Planos
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  onClick={onClose}
                >
                  Voltar
                </Button>
              </div>
            </div>
            <AdManager placement="player" />
          </div>
        ) : (
          <>
            <AdManager placement="player" className="absolute top-20 left-1/2 -translate-x-1/2 z-40" />
            <div
              ref={playerContainerRef}
              className="relative w-full h-full"
              onContextMenu={(e) => e.preventDefault()}
            >
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  if (plan?.id === 'free') {
                    window.location.reload();
                  }
                }}
                variant="ghost"
                size="icon"
                className="absolute top-6 left-6 z-50 w-12 h-12 text-white bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full shadow-lg border border-white/20"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>

              <div className="absolute top-6 left-20 z-50 flex items-center gap-2 px-4 py-2 text-white bg-black/50 backdrop-blur-md rounded-full shadow-lg border border-white/20">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center glow-effect">
                    <Film className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg">
                    Uni<span className="text-primary">Tv</span>Film
                  </span>
                </div>
              </div>

              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                variant="ghost"
                size="icon"
                className="absolute top-6 right-[136px] z-50 w-12 h-12 text-white bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full shadow-lg border border-white/20"
              >
                {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
              </Button>

              {hasMultipleSources && (
                <div className="absolute top-6 right-20 z-50">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSourceMenu(prev => !prev);
                    }}
                    variant="ghost"
                    size="icon"
                    className="w-12 h-12 text-white bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full shadow-lg border border-white/20"
                  >
                    <List className="w-6 h-6" />
                  </Button>
                  {showSourceMenu && (
                    <div className="absolute top-14 right-0 bg-black/90 backdrop-blur-md rounded-lg shadow-xl border border-white/20 overflow-hidden min-w-[150px]">
                      {allSources.map((source, index) => (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentSourceIndex(index);
                            setShowSourceMenu(false);
                          }}
                          className={`w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center justify-between ${currentSourceIndex === index ? 'bg-primary/20' : ''}`}
                        >
                          <span>{source.name}</span>
                          {currentSourceIndex === index && <span className="text-primary">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Watching Card */}
              <div
                className={`absolute bottom-24 left-6 z-50 max-w-sm bg-black/80 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 overflow-hidden transition-all duration-500 ease-out ${showWatchingCard ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}
              >
                <div className="p-4">
                  <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">Você está assistindo</p>
                  <div className="flex gap-3">
                    {image && <img src={image} className="w-20 h-28 object-cover rounded-lg flex-shrink-0" />}
                    <div className="flex flex-col gap-1 min-w-0">
                      <h3 className="text-white font-bold text-sm line-clamp-2">{displayTitle}</h3>
                      {rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-yellow-500 text-xs font-medium">{rating.toFixed(1)}</span>
                        </div>
                      )}
                      {description && <p className="text-muted-foreground text-xs line-clamp-3 mt-1">{description}</p>}
                    </div>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div className="h-full bg-primary transition-all duration-75 ease-linear" style={{ width: `${cardProgress}%` }} />
                </div>
              </div>

              {/* NEXT EPISODE OVERLAY - TOP RIGHT (Left of Fullscreen) - COMPACT */}
              {(nextEpisode || isLastEpisode) && (
                <div className="absolute top-6 right-[200px] z-50">
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (nextEpisode && onPlayNext) {
                        onPlayNext();
                      }
                    }}
                    className={`group flex flex-col items-end gap-1 ${nextEpisode ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`bg-black/60 backdrop-blur-md border border-white/10 rounded-full pl-3 pr-5 py-2 shadow-2xl transition-all duration-300 max-w-[300px] flex items-center ${nextEpisode ? 'hover:bg-black/80 group-hover:scale-105 group-hover:border-primary/50' : 'border-red-500/30'}`}>
                      <div className="flex gap-3 items-center">
                        <div className="relative w-9 h-9 flex-shrink-0 rounded-full overflow-hidden bg-gray-900 border border-white/10 shadow-sm">
                          {image ? (
                            <img src={image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Film className="w-4 h-4 text-gray-600 m-auto mt-2.5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden flex flex-col justify-center text-right">
                          {nextEpisode ? (
                            <>
                              <span className="text-[10px] text-primary uppercase font-bold tracking-wider leading-none mb-1">Próximo: T{nextEpisode.season} E{nextEpisode.episode}</span>
                              <div className="relative overflow-hidden h-5 w-48">
                                <p className="text-xs text-white font-bold whitespace-nowrap animate-marquee leading-normal flex items-center h-full">
                                  {`Assistir: ${nextEpisode.title}`}
                                </p>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="text-[10px] text-red-500 uppercase font-bold tracking-wider leading-none mb-1">Final da Temporada</span>
                              <div className="relative overflow-hidden h-5 w-48 flex justify-end items-center">
                                <p className="text-xs text-white font-bold leading-normal">
                                  Não há mais episódios.
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* NEW NEXT EPISODE CENTER RIGHT BUTTON */}
              {nextEpisode && (
                <div className="absolute top-1/2 right-4 -translate-y-1/2 z-50">
                   <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPlayNext) onPlayNext();
                      }}
                       variant="ghost"
                       size="icon"
                       className="w-14 h-14 rounded-full bg-black/50 hover:bg-primary hover:text-white backdrop-blur-sm border border-white/10 shadow-lg transition-all duration-300 hover:scale-110 group"
                       title={`Próximo: ${nextEpisode.title}`}
                   >
                      <ChevronRight className="w-8 h-8 text-white group-hover:text-white" />
                   </Button>
                </div>
              )}

              {/* Interactive Suggestion Pill - Bottom Right */}
              {suggestions && suggestions.length > 0 && (
                <div className="absolute bottom-6 right-24 z-50">
                  <div className="group relative flex items-end justify-end">
                    {/* Suggestion List Dropdown (Up) */}
                    <div className="absolute bottom-full right-0 mb-3 w-64 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      <div className="p-3">
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-2 px-1 tracking-wider">Mais sugestões</p>
                        <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
                          {suggestions.slice(1, 6).map((item, idx) => (
                            <div
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onPlayContent) {
                                  onPlayContent(item);
                                } else {
                                  navigate(`/content/${item.id}`);
                                }
                              }}
                              className="flex gap-2 p-2 hover:bg-white/10 rounded-lg cursor-pointer transition-colors group/item"
                            >
                              <img src={item.thumbnail_url} className="w-10 h-14 object-cover rounded-md bg-gray-800 shadow-sm" />
                              <div className="flex flex-col justify-center min-w-0">
                                <span className="text-xs text-white font-medium line-clamp-2 group-hover/item:text-primary transition-colors">{item.title}</span>
                                {item.rating && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Star className="w-2 h-2 text-yellow-500 fill-yellow-500" />
                                    <span className="text-[10px] text-gray-400 font-medium">{item.rating.toFixed(1)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* The Main Pill Trigger */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPlayContent) {
                          onPlayContent(suggestions[0]);
                        } else {
                          navigate(`/content/${suggestions[0].id}`);
                        }
                      }}
                      className="flex items-center gap-3 bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-full pl-1 pr-4 py-1.5 cursor-pointer transition-all duration-300 group-hover:border-white/30 group-hover:scale-105"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={suggestions[0].thumbnail_url}
                          alt={suggestions[0].title}
                          className="w-9 h-9 rounded-full object-cover border border-white/20 shadow-md"
                        />
                        {suggestions[0].isPremium && (
                          <div className="absolute -top-1 -right-1 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full p-0.5 shadow-sm">
                            <Crown className="w-2 h-2 text-black fill-black" />
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[9px] text-primary uppercase font-bold tracking-wider leading-none mb-0.5">Você já assistiu?</span>
                        <h4 className="text-xs text-white font-bold max-w-[140px] truncate leading-tight">
                          {suggestions[0].title}
                        </h4>
                      </div>

                      <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors flex-shrink-0 ml-1" />
                    </div>
                  </div>
                </div>
              )}

              {currentSource?.type === 'internal' ? (
                <div className="absolute inset-0 w-full h-full bg-black">
                  <ReactPlayer
                    key={currentSource.url}
                    url={currentSource.url}
                    width="100%"
                    height="100%"
                    controls
                    playing
                    style={{ position: 'absolute', top: 0, left: 0 }}
                  />
                </div>
              ) : (
                <iframe
                  key={secureVideoUrl}
                  ref={iframeRef}
                  src={secureVideoUrl}
                  title={`Player - ${title}`}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  tabIndex={0}
                  referrerPolicy="no-referrer"
                  sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                />
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
