import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Crown, ArrowLeft } from "lucide-react";
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
  title: string;
  isPremium?: boolean;
}

export const ContentPlayerModal = ({ open, onClose, videoUrl, title, isPremium = false }: ContentPlayerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [showBackButton, setShowBackButton] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Ativar proteção de conteúdo quando o modal está aberto
  useContentProtection(open);

  // Gerar URL segura com timestamp para evitar cache
  const secureVideoUrl = useMemo(() => {
    if (!videoUrl) return '';
    const timestamp = Date.now();
    const separator = videoUrl.includes('?') ? '&' : '?';
    return `${videoUrl}${separator}_t=${timestamp}`;
  }, [videoUrl]);

  // Detectar se é mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Garante que o ESC feche o modal
  useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
  });

  // Para mobile: toggle ao clicar, esconde após 3s
  useEffect(() => {
    if (!isMobile || !showBackButton) return;
    const timer = setTimeout(() => setShowBackButton(false), 3000);
    return () => clearTimeout(timer);
  }, [showBackButton, isMobile]);

  // Foca o iframe quando o modal abre para permitir controle direto do player
  useEffect(() => {
    if (open && iframeRef.current && !isPremium) {
      setTimeout(() => {
        iframeRef.current?.focus();
      }, 100);
    }
  }, [open, isPremium]);

  if (!videoUrl) return null;

  // Admin tem acesso total, ou verifica se tem assinatura ativa
  const hasActiveSubscription = profile?.isPremium &&
    profile.subscriptionExpiresAt &&
    new Date(profile.subscriptionExpiresAt) > new Date();

  const isBlocked = isPremium && !isAdmin && !hasActiveSubscription;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
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
              className="relative w-full h-full group protected-content"
              onMouseEnter={() => !isMobile && setShowBackButton(true)}
              onMouseLeave={() => !isMobile && setShowBackButton(false)}
              onClick={() => isMobile && setShowBackButton(prev => !prev)}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* Botão Voltar - animação suave de fade */}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                variant="ghost"
                size="icon"
                className={`absolute top-6 left-6 z-50 w-12 h-12 text-white bg-black/50 hover:bg-black/70 backdrop-blur-md rounded-full shadow-lg border border-white/20 transition-all duration-500 ease-in-out ${showBackButton
                  ? 'opacity-100 translate-x-0 scale-100'
                  : 'opacity-0 -translate-x-4 scale-90 pointer-events-none'
                  } md:group-hover:opacity-100 md:group-hover:translate-x-0 md:group-hover:scale-100 md:group-hover:pointer-events-auto`}
                title="Voltar"
              >
                <ArrowLeft className="w-6 h-6" />
              </Button>

              {/* Overlay de proteção transparente sobre o iframe - Z-Index Alto */}
              <div
                className="absolute inset-0 z-[100] w-full h-full"
                style={{ background: 'transparent' }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
                }}
              />

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
