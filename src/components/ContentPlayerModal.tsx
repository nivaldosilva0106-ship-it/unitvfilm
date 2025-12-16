import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Crown, ArrowLeft, List, Film, Maximize, Minimize, Star, Play, Plus, ChevronUp } from "lucide-react";
import { Content } from "@/types/content";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { Button } from "./ui/button";
import { useRef, useEffect, useState, useMemo } from "react";
import ReactPlayer from 'react-player';
import { useAuth } from "@/contexts/AuthContext";
import { AdManager } from "./AdManager";
import { useNavigate } from "react-router-dom";
import { useContentProtection } from "@/hooks/useContentProtection";

interface ContentPlayerModalProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  videoUrls?: string[]; // Multiple video sources
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
  onAddToMyList
}: ContentPlayerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWatchingCard, setShowWatchingCard] = useState(false);
  const [cardProgress, setCardProgress] = useState(100);
  const [showSuggestionCard, setShowSuggestionCard] = useState(false);
  const [suggestedContent, setSuggestedContent] = useState<Content | null>(null);

  const watchingCardTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get all available sources
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

  // Ativar proteção de conteúdo quando o modal está aberto
  useContentProtection(open);

  // Gerar URL segura com timestamp para evitar cache (apenas para iframes/embeds)
  const secureVideoUrl = useMemo(() => {
    if (!currentSource || currentSource.type !== 'embed') return '';
    const url = currentSource.url;
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_t=${timestamp}`;
  }, [currentSource]);

  // Garante que o ESC feche o modal
  useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
  });

  // Listen to fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Show watching card automatically when modal opens and reset on close
  useEffect(() => {
    if (open) {
      // Clear any existing timers
      if (watchingCardTimerRef.current) {
        clearTimeout(watchingCardTimerRef.current);
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (suggestionTimerRef.current) {
        clearTimeout(suggestionTimerRef.current);
      }

      // Show the 'Watching' card automatically
      const showWatchingTimer = setTimeout(() => {
        setShowWatchingCard(true);
        setCardProgress(100);

        // Animate progress bar from 100% to 0% over 5 seconds
        const duration = 5000;
        const intervalTime = 50;
        const decrementAmount = (100 / duration) * intervalTime;

        progressIntervalRef.current = setInterval(() => {
          setCardProgress(prev => {
            const newProgress = prev - decrementAmount;
            if (newProgress <= 0) {
              if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
              }
              return 0;
            }
            return newProgress;
          });
        }, intervalTime);

        // Hide after 5 seconds
        watchingCardTimerRef.current = setTimeout(() => {
          setShowWatchingCard(false);
          setCardProgress(100);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        }, duration);
      }, 2000);

      // Handle Suggestion Card Logic
      if (suggestions && suggestions.length > 0) {
        // Filter out current content (by title or image as proxy for ID if needed)
        const candidates = suggestions.filter(s => s.title !== title && s.video_url !== videoUrl);

        if (candidates.length > 0) {
          // Select random suggestion
          const randomSuggestion = candidates[Math.floor(Math.random() * candidates.length)];
          setSuggestedContent(randomSuggestion);

          // Show suggestion after 15 seconds
          suggestionTimerRef.current = setTimeout(() => {
            setShowSuggestionCard(true);

            // Auto hide after 15 seconds (optional, to avoid permanent obstruction)
            setTimeout(() => setShowSuggestionCard(false), 15000);
          }, 15000);
        }
      }

      return () => {
        clearTimeout(showWatchingTimer);
        if (watchingCardTimerRef.current) clearTimeout(watchingCardTimerRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (suggestionTimerRef.current) clearTimeout(suggestionTimerRef.current);
      };
    } else {
      // Reset all states when modal closes
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
        // Try to fullscreen the dialog content for better compatibility
        await (dialogContentRef.current || playerContainerRef.current)?.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  // Admin tem acesso total, ou verifica se tem assinatura ativa
  const hasActiveSubscription = profile?.isPremium &&
    profile.subscriptionExpiresAt &&
    new Date(profile.subscriptionExpiresAt) > new Date();

  const isBlocked = isPremium && !isAdmin && !hasActiveSubscription;

  // Mantém o foco no iframe para evitar pause do embed
  useEffect(() => {
    if (!open || isBlocked) return;

    const focusIframe = () => {
      if (iframeRef.current) {
        iframeRef.current.focus();
      }
    };

    // Foco inicial após render
    const initialFocusTimer = setTimeout(focusIframe, 200);

    // Re-foca quando clica no container (não no iframe)
    const handleContainerClick = (e: MouseEvent) => {
      if (e.target === playerContainerRef.current) {
        focusIframe();
      }
    };

    playerContainerRef.current?.addEventListener('click', handleContainerClick);

    return () => {
      clearTimeout(initialFocusTimer);
      playerContainerRef.current?.removeEventListener('click', handleContainerClick);
    };
  }, [open, isBlocked]);

  // Prevenir que eventos de mouse interfiram com o player
  useEffect(() => {
    if (!open) return;

    // Desabilita eventos que possam interferir com o player
    const handleVisibilityChange = () => {
      // Não faz nada - deixa o player continuar
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [open]);

  if (!currentSource) return null;

  // Display title with episode if available
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

        {/* Close Button */}
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute top-6 right-6 z-50 w-12 h-12 text-white bg-black/70 hover:bg-red-600 hover:scale-110 backdrop-blur-md transition-all rounded-full shadow-lg border-2 border-white/20"
          title="Fechar Player (ESC)"
        >
          <X className="w-7 h-7" />
        </Button>

        {isBlocked ? (
          // Tela de Bloqueio Premium
          <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-black via-primary/10 to-black">
            <div className="text-center max-w-md px-8">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/20 border-2 border-primary mb-6">
                <Crown className="w-12 h-12 text-primary" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-4">
                Conteúdo Premium
              </h2>
              <p className="text-muted-foreground mb-8 text-lg">
                {profile?.isPremium && !hasActiveSubscription
                  ? 'Sua assinatura expirou. Renove para continuar assistindo.'
                  : 'Este conteúdo está disponível apenas para assinantes ativos. Complete o pagamento para ter acesso ilimitado.'}
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    onClose();
                    navigate('/payment');
                  }}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  {profile?.isPremium ? 'Renovar Assinatura' : 'Ativar Assinatura'}
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
            {/* Anúncio antes do player */}
            <AdManager placement="player" className="absolute top-20 left-1/2 -translate-x-1/2 z-40" />

            {/* Iframe Container - Fullscreen com proteção */}
            <div
              ref={playerContainerRef}
              className="relative w-full h-full"
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* Botão Voltar - sempre visível */}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                variant="ghost"
                size="icon"
                className="absolute top-6 left-6 z-50 w-12 h-12 text-white bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full shadow-lg border border-white/20"
                title="Voltar"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>

              {/* Logo UniTvFilm - sempre visível */}
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

              {/* Fullscreen Toggle Button - Same line as source selector */}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFullscreen();
                }}
                variant="ghost"
                size="icon"
                className="absolute top-6 right-[136px] z-50 w-12 h-12 text-white bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full shadow-lg border border-white/20"
                title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
              >
                {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
              </Button>

              {/* Source Selector Button - Only show if multiple sources */}
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
                    title="Fontes de Vídeo"
                  >
                    <List className="w-6 h-6" />
                  </Button>

                  {/* Source Dropdown Menu */}
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
                          className={`w-full px-4 py-3 text-left text-white hover:bg-white/10 transition-colors flex items-center justify-between ${currentSourceIndex === index ? 'bg-primary/20' : ''
                            }`}
                        >
                          <span>{source.name}</span>
                          {currentSourceIndex === index && (
                            <span className="text-primary">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* "Você está assistindo" Card */}
              <div
                className={`absolute bottom-24 left-6 z-50 max-w-sm bg-black/80 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 overflow-hidden transition-all duration-500 ease-out ${showWatchingCard
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-full pointer-events-none'
                  }`}
              >
                <div className="p-4">
                  <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-2">
                    Você está assistindo
                  </p>
                  <div className="flex gap-3">
                    {image && (
                      <img
                        src={image}
                        alt={title}
                        className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex flex-col gap-1 min-w-0">
                      <h3 className="text-white font-bold text-sm line-clamp-2">
                        {displayTitle}
                      </h3>
                      {rating && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-yellow-500 text-xs font-medium">{rating.toFixed(1)}</span>
                        </div>
                      )}
                      {description && (
                        <p className="text-muted-foreground text-xs line-clamp-3 mt-1">
                          {description}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Animated Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                  <div
                    className="h-full bg-primary transition-all duration-75 ease-linear"
                    style={{ width: `${cardProgress}%` }}
                  />
                </div>
              </div>



              {/* Interactive Suggestion Pill - Bottom Right (Left of Fullscreen) */}
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
                    url={currentSource.url}
                    width="100%"
                    height="100%"
                    controls={true}
                    playing={true}
                    style={{ position: 'absolute', top: 0, left: 0 }}

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
