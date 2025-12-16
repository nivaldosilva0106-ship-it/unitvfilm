import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Crown, ArrowLeft, List, Film, Maximize, Minimize } from "lucide-react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { Button } from "./ui/button";
import { useRef, useEffect, useState, useMemo } from "react";
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
}

export const ContentPlayerModal = ({ open, onClose, videoUrl, videoUrls, title, isPremium = false }: ContentPlayerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Get all available sources
  const availableSources = videoUrls && videoUrls.length > 0 ? videoUrls : [videoUrl];
  const hasMultipleSources = availableSources.length > 1;

  // Ativar proteção de conteúdo quando o modal está aberto
  useContentProtection(open);

  // Gerar URL segura com timestamp para evitar cache
  const secureVideoUrl = useMemo(() => {
    if (!availableSources[currentSourceIndex]) return '';
    const url = availableSources[currentSourceIndex];
    const timestamp = Date.now();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}_t=${timestamp}`;
  }, [availableSources, currentSourceIndex]);

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
  }, [open]);

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

  if (!videoUrl) return null;

  // Admin tem acesso total, ou verifica se tem assinatura ativa
  const hasActiveSubscription = profile?.isPremium &&
    profile.subscriptionExpiresAt &&
    new Date(profile.subscriptionExpiresAt) > new Date();

  const isBlocked = isPremium && !isAdmin && !hasActiveSubscription;

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
                      {availableSources.map((_, index) => (
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
                          <span>Player {index + 1}</span>
                          {currentSourceIndex === index && (
                            <span className="text-primary">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Fullscreen Toggle Button - Bottom Right */}
              <div className="absolute bottom-6 right-6 z-50">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                  }}
                  variant="ghost"
                  size="icon"
                  className="w-12 h-12 text-white bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full shadow-lg border border-white/20"
                  title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                >
                  {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
                </Button>
              </div>


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
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
