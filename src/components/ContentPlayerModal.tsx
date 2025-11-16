import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Crown } from "lucide-react";
import { useKeyboardNavigation } from "@/hooks/useKeyboardNavigation";
import { Button } from "./ui/button";
import { useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AdManager } from "./AdManager";
import { useNavigate } from "react-router-dom";

interface ContentPlayerModalProps {
  open: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
  isPremium?: boolean;
}

export const ContentPlayerModal = ({ open, onClose, videoUrl, title, isPremium = false }: ContentPlayerModalProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  
  // Garante que o ESC feche o modal
  useKeyboardNavigation({
    enabled: open,
    onEscape: onClose,
  });

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
      <DialogContent className="max-w-full w-screen h-screen p-0 bg-black border-none [&>button]:hidden">
        
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
            
            {/* Iframe Container - Fullscreen */}
            <div className="relative w-full h-full">
              <iframe
                ref={iframeRef}
                src={videoUrl}
                title={`Player - ${title}`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                tabIndex={0}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};