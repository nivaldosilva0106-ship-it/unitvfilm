import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Crown, ArrowLeft, List, Film, Maximize, Minimize, Star, Plus, ChevronUp } from "lucide-react";
import { Content, Episode } from "@/types/content";
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
import { NextEpisodeCard } from "./NextEpisodeCard";
import { EpisodeListModal } from "./EpisodeListModal"; // Import the modal

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
  episodes?: Episode[];
  internalPlayerUrl?: string; // Add internal player support
  onPlayContent?: (content: Content) => void;
  onAddToMyList?: (content: Content) => void;
  category?: string;
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
  episodes = [],
  internalPlayerUrl,
  onPlayContent,
  onAddToMyList,
  category
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

  // Next Episode & Modal State
  const [showEpisodeList, setShowEpisodeList] = useState(false);
  const [nextEpisode, setNextEpisode] = useState<Episode | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<Episode | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState(videoUrl);
  const [activeEpisodeTitle, setActiveEpisodeTitle] = useState(episodeTitle);

  const [accessState, setAccessState] = useState<{ granted: boolean; reason?: string | null }>({ granted: false });
  const hasIncrementedRef = useRef(false);

  // Update active state when props change (re-opening or different content)
  useEffect(() => {
    if (open) {
      setActiveVideoUrl(videoUrl);
      setActiveEpisodeTitle(episodeTitle);
    }
  }, [open, videoUrl, episodeTitle]);

  // Determine Next Episode logic
  useEffect(() => {
    if (episodes && episodes.length > 0) {
      const current = episodes.find(e => {
        // Match by title is somewhat risky if titles aren't unique, but URL is better.
        // If activeVideoUrl is set, try to match it.
        if (activeVideoUrl) return e.url === activeVideoUrl;
        return e.title === activeEpisodeTitle;
      });

      if (current) {
        setCurrentEpisode(current);
        let next = episodes.find(e => e.season === current.season && e.episode === current.episode + 1);
        if (!next) {
          next = episodes.find(e => e.season === current.season + 1 && e.episode === 1);
        }
        setNextEpisode(next || null);
      } else {
        setCurrentEpisode(null);
        setNextEpisode(null);
      }
    } else {
      setNextEpisode(null);
      setCurrentEpisode(null);
    }
  }, [episodes, activeVideoUrl, activeEpisodeTitle]);

  // Access Check Effect
  useEffect(() => {
    if (open) {
      hasIncrementedRef.current = false;
      const cat = category || (activeEpisodeTitle ? 'series' : 'movie');
      const contentMock = { isPremium, category: cat };

      const access = checkAccess(contentMock as any);

      if (access.allowed) {
        setAccessState({ granted: true });
        if (profile && !isAdmin && !hasIncrementedRef.current) {
          incrementDailyUsage(profile.id, cat === 'series' ? 'episode' : 'movie');
          hasIncrementedRef.current = true;
        }
      } else {
        setAccessState({ granted: false, reason: access.reason });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, title, activeEpisodeTitle, isPremium, category]);

  const watchingCardTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sources Logic
  const allSources = useMemo(() => {
    const sources = [];
    if (internalPlayerUrl) {
      sources.push({ name: 'Player Interno', url: internalPlayerUrl, type: 'internal' });
    }

    // Logic: If currentEpisode is identified, use its URL (activeVideoUrl). 
    // If not (e.g. movie mode), use videoUrls or activeVideoUrl.
    if (!currentEpisode && videoUrls && videoUrls.length > 0) {
      videoUrls.forEach((url, index) => {
        if (url) sources.push({ name: `Player ${index + 1}`, url, type: 'embed' });
      });
    } else {
      if (activeVideoUrl) sources.push({ name: 'Player Principal', url: activeVideoUrl, type: 'embed' });
    }
    // If we only have 1 source matching activeVideoUrl, that's fine.

    return sources;
  }, [internalPlayerUrl, activeVideoUrl, videoUrls, currentEpisode]);

  const hasMultipleSources = allSources.length > 1;
  const currentSource = allSources[currentSourceIndex] || allSources[0];

  useContentProtection(open);

  const secureVideoUrl = useMemo(() => {
    if (!currentSource || currentSource.type !== 'embed') return '';
    let url = currentSource.url;

    // Auto-play injection logic
    // If not already present, append autoplay=1
    if (url.includes('autoplay=0')) {
      url = url.replace('autoplay=0', 'autoplay=1');
    } else if (!url.includes('autoplay=')) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}autoplay=1`;
    }

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

  // Watching Card Logic
  useEffect(() => {
    if (open) {
      // Clear any existing timers
      if (watchingCardTimerRef.current) clearTimeout(watchingCardTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);

      const showCardDuration = 5000;
      const reShowInterval = 30 * 60 * 1000; // 30 minutes

      const showCard = () => {
        setShowWatchingCard(true);
        setCardProgress(100);

        const intervalTime = 50;
        const decrementAmount = (100 / showCardDuration) * intervalTime;

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

        // Hide after duration and schedule next show
        watchingCardTimerRef.current = setTimeout(() => {
          setShowWatchingCard(false);
          setCardProgress(100);
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

          // Schedule next appearance
          watchingCardTimerRef.current = setTimeout(showCard, reShowInterval);
        }, showCardDuration);
      };

      // Initial show after 2 seconds
      const initialDelay = setTimeout(showCard, 2000);

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
        clearTimeout(initialDelay);
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
  }, [open, activeVideoUrl, activeEpisodeTitle, title, videoUrl, suggestions]); // Reset on episode change

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

  const handleSwitchEpisode = (episode: Episode) => {
    setActiveVideoUrl(episode.url);
    setActiveEpisodeTitle(episode.title);
    setShowEpisodeList(false);
    setCurrentSourceIndex(0); // Reset source to primary for new episode
  };

  const isBlocked = !isAdmin && !accessState.granted;
  const blockedInfo = accessState.reason === 'premium_content' ?
    { title: 'Conteúdo Premium', desc: 'Este conteúdo é exclusivo para assinantes Premium.' } :
    accessState.reason === 'plan_limit' ?
      { title: 'Limite Diário Atingido', desc: 'Limite diário de visualizações atingido.' } :
      { title: 'Acesso Bloqueado', desc: 'Você não tem permissão para assistir.' };


  if (!currentSource && !isBlocked) return null;

  const displayTitle = activeEpisodeTitle ? `${title} - ${activeEpisodeTitle}` : title;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        ref={dialogContentRef}
        className="max-w-full w-screen h-screen p-0 bg-black border-none [&>button]:hidden protected-content outline-none"
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
                    navigate('/signup');
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
              className="relative w-full h-full bg-black flex items-center justify-center"
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
                {/* Title Badge visible on Desktop */}
                <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 bg-white/10 rounded-full">
                  <span className="text-sm text-white font-medium max-w-[200px] truncate">{displayTitle}</span>
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

              {/* Next Episode Card */}
              {nextEpisode && (
                <div className="absolute top-24 right-6 z-40 animate-in fade-in slide-in-from-right-10 duration-700">
                  <NextEpisodeCard
                    title={nextEpisode.title}
                    season={nextEpisode.season}
                    episode={nextEpisode.episode}
                    thumbnailUrl={nextEpisode.thumbnailUrl || image}
                    onClick={() => setShowEpisodeList(true)}
                  />
                </div>
              )}

              <EpisodeListModal
                isOpen={showEpisodeList}
                onClose={() => setShowEpisodeList(false)}
                episodes={episodes}
                currentEpisodeId={currentEpisode?.id}
                onPlayEpisode={handleSwitchEpisode}
              />

              {/* Watching Card */}
              <div
                className={`absolute bottom-24 left-6 z-50 max-w-xs bg-black/80 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 overflow-hidden transition-all duration-500 ease-out ${showWatchingCard ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}
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

              {/* Suggestions */}
              {displaySuggestions && displaySuggestions.length > 0 && !showEpisodeList && (
                <div className="absolute bottom-6 right-24 z-50">
                  <div className="group relative flex items-end justify-end">
                    <div className="absolute bottom-full right-0 mb-3 w-64 bg-black/90 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      <div className="p-3">
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-2 px-1 tracking-wider">
                          {episodes && currentEpisode && displaySuggestions[0].id.toString().startsWith('ep-') ? 'Próximos Episódios' : 'Mais sugestões'}
                        </p>
                        <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-white/20">
                          {displaySuggestions.slice(1, 6).map((item, idx) => (
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
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onPlayContent) {
                          onPlayContent(displaySuggestions[0]);
                        } else {
                          navigate(`/content/${displaySuggestions[0].id}`);
                        }
                      }}
                      className="flex items-center gap-3 bg-black/40 hover:bg-black/80 backdrop-blur-md border border-white/10 rounded-full pl-1 pr-4 py-1.5 cursor-pointer transition-all duration-300 group-hover:border-white/30 group-hover:scale-105"
                    >
                      <div className="relative flex-shrink-0">
                        <img
                          src={displaySuggestions[0].thumbnail_url}
                          alt={displaySuggestions[0].title}
                          className="w-9 h-9 rounded-full object-cover border border-white/20 shadow-md"
                        />
                        {displaySuggestions[0].isPremium && (
                          <div className="absolute -top-1 -right-1 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full p-0.5 shadow-sm">
                            <Crown className="w-2 h-2 text-black fill-black" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] text-primary uppercase font-bold tracking-wider leading-none mb-0.5">
                          {episodes && currentEpisode && displaySuggestions[0].id.toString().startsWith('ep-') ? 'Próximo Episódio' : 'Você já assistiu?'}
                        </span>
                        <h4 className="text-xs text-white font-bold max-w-[140px] truncate leading-tight">
                          {displaySuggestions[0].title}
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
                    url={currentSource.url}
                    width="100%"
                    height="100%"
                    controls
                    playing
                    style={{ position: 'absolute', top: 0, left: 0 }}
                    config={{
                      file: { attributes: { autoPlay: true } }
                    }}
                  />
                </div>
              ) : (
                <iframe
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
